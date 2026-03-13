// Lógica de sincronización en background para sync-sat-full
// Se ejecuta via EdgeRuntime.waitUntil() — continúa aunque el cliente cierre el tab

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  fetchAllPages,
  fetchEntityId,
  triggerExtractions,
  checkCredential,
  fetchAnnualReturns,
  type SyntageInvoice,
  type SyntageAnnualReturn,
} from './_syntage.ts'

type SupabaseClient = ReturnType<typeof createClient>

type SyncPhase =
  | 'queued'
  | 'credential_check'
  | 'entity_resolution'
  | 'trigger_extractions'
  | 'fetch_cfdis_emitidos'
  | 'fetch_cfdis_recibidos'
  | 'upsert_cfdis'
  | 'fetch_annual_returns'
  | 'completed'

interface Company {
  id:          string
  rfc:         string
  credentialId: string
}

// Actualiza la fase y progreso del job en sat_sync_jobs
async function updatePhase(
  client: SupabaseClient,
  jobId: string,
  phase: SyncPhase,
  pct: number,
  extras?: Record<string, unknown>,
): Promise<void> {
  await client.from('sat_sync_jobs').update({
    phase,
    progress_pct: pct,
    status:       phase === 'completed' ? 'completed' : 'running',
    started_at:   phase === 'credential_check'
                  ? new Date().toISOString()
                  : undefined,
    completed_at: phase === 'completed'
                  ? new Date().toISOString()
                  : undefined,
    ...extras,
  }).eq('id', jobId)
}

// Marca el job como fallido
async function markFailed(
  client: SupabaseClient,
  jobId: string,
  message: string,
): Promise<void> {
  await client.from('sat_sync_jobs').update({
    status:        'failed',
    failed_at:     new Date().toISOString(),
    error_message: message,
  }).eq('id', jobId)
}

// Proceso completo de sincronización — 8 fases
export async function runSync(
  adminClient: SupabaseClient,
  jobId: string,
  company: Company,
  apiKey: string,
  baseUrl: string,
): Promise<void> {
  try {
    // ── Fase 1: Verificar credencial ────────────────────────────────
    await updatePhase(adminClient, jobId, 'credential_check', 5)

    const credStatus = await checkCredential(company.credentialId, apiKey, baseUrl)
    if (credStatus !== 'valid') {
      await markFailed(adminClient, jobId, `Credencial SAT inválida (${credStatus}). Reconecta tu empresa.`)
      return
    }

    // ── Fase 2: Resolver entity UUID ────────────────────────────────
    await updatePhase(adminClient, jobId, 'entity_resolution', 15)

    const entityId = await fetchEntityId(company.rfc, apiKey, baseUrl)
    if (!entityId) {
      await markFailed(adminClient, jobId, 'No se encontró la entidad en Syntage para este RFC.')
      return
    }
    const entityIri = `/entities/${entityId}`

    // ── Fase 3: Disparar extracciones ───────────────────────────────
    await updatePhase(adminClient, jobId, 'trigger_extractions', 20)

    const emitidosUrl = new URL(`${baseUrl}/taxpayers/${encodeURIComponent(company.rfc)}/invoices`)
    emitidosUrl.searchParams.set('isIssuer', 'true')
    emitidosUrl.searchParams.set('type', 'I')
    emitidosUrl.searchParams.set('order[issuedAt]', 'desc')

    await triggerExtractions(entityIri, apiKey, baseUrl)

    // ── Fase 4: Descargar facturas emitidas ─────────────────────────
    await updatePhase(adminClient, jobId, 'fetch_cfdis_emitidos', 30)

    const emitidos = await fetchAllPages<SyntageInvoice>(emitidosUrl, apiKey)

    // ── Fase 5: Descargar facturas recibidas ────────────────────────
    await updatePhase(adminClient, jobId, 'fetch_cfdis_recibidos', 50, {
      cfdis_fetched: emitidos.length,
    })

    const recibidosUrl = new URL(`${baseUrl}/taxpayers/${encodeURIComponent(company.rfc)}/invoices`)
    recibidosUrl.searchParams.set('isReceiver', 'true')
    recibidosUrl.searchParams.set('type', 'I')
    recibidosUrl.searchParams.set('order[issuedAt]', 'desc')

    const recibidos = await fetchAllPages<SyntageInvoice>(recibidosUrl, apiKey)

    const allInvoices = [...emitidos, ...recibidos]

    await updatePhase(adminClient, jobId, 'upsert_cfdis', 60, {
      cfdis_fetched: allInvoices.length,
    })

    // ── Fase 6: Guardar en DB ────────────────────────────────────────
    // ORDEN CRÍTICO: sat_taxpayers → sat_cfdis → sat_cfdi_payment_state → sat_cfdi_concepts

    // 6a. Upsert sat_taxpayers (catálogo RFC)
    const taxpayerMap = new Map<string, string | null>()
    for (const inv of allInvoices) {
      const issuerRfc = inv.issuer?.rfc?.toUpperCase().trim()
      const receiverRfc = inv.receiver?.rfc?.toUpperCase().trim()
      if (issuerRfc) taxpayerMap.set(issuerRfc, inv.issuer?.name ?? null)
      if (receiverRfc) taxpayerMap.set(receiverRfc, inv.receiver?.name ?? null)
    }

    const taxpayerRows = Array.from(taxpayerMap.entries()).map(([rfc, razon_social]) => ({
      rfc,
      razon_social,
      updated_at: new Date().toISOString(),
    }))

    if (taxpayerRows.length > 0) {
      const BATCH_TP = 500
      for (let i = 0; i < taxpayerRows.length; i += BATCH_TP) {
        await adminClient.from('sat_taxpayers').upsert(
          taxpayerRows.slice(i, i + BATCH_TP),
          { onConflict: 'rfc', ignoreDuplicates: false },
        )
      }
    }

    // 6b. Upsert sat_cfdis
    const now = new Date().toISOString()
    const BATCH = 200
    let totalUpserted = 0

    // Deduplicar por cfdi_uuid para esta empresa
    const seen = new Set<string>()
    const uniqueInvoices: SyntageInvoice[] = []
    for (const inv of allInvoices) {
      const uuid = (inv.uuid ?? inv.id).toUpperCase()
      if (!seen.has(uuid)) {
        seen.add(uuid)
        uniqueInvoices.push(inv)
      }
    }

    // Guardar en lotes y recolectar IDs insertados para payment_state + concepts
    const cfdiIdByUuid = new Map<string, string>()

    for (let i = 0; i < uniqueInvoices.length; i += BATCH) {
      const batch = uniqueInvoices.slice(i, i + BATCH)

      const cfdiRows = batch.map((inv) => ({
        company_id:      company.id,
        cfdi_uuid:       (inv.uuid ?? inv.id).toUpperCase(),
        cfdi_type:       'I' as const,
        issuer_rfc:      inv.issuer?.rfc?.toUpperCase().trim() ?? '',
        receiver_rfc:    inv.receiver?.rfc?.toUpperCase().trim() ?? '',
        subtotal:        inv.subtotal ?? inv.total ?? null,
        total:           inv.total ?? null,
        issued_at:       inv.issuedAt,
        expires_at:      inv.expiresAt ?? null,
        cfdi_status:     inv.status?.toLowerCase() === 'cancelado' ? 'cancelado' : 'vigente',
        blacklist_status: inv.blacklistStatus ?? null,
        raw_json:        inv,
        synced_at:       now,
      }))

      const { data: upserted, error: cfdiErr } = await adminClient
        .from('sat_cfdis')
        .upsert(cfdiRows, { onConflict: 'company_id,cfdi_uuid', ignoreDuplicates: false })
        .select('id, cfdi_uuid')

      if (cfdiErr) {
        console.error('sat_cfdis upsert error batch', i, cfdiErr)
        continue
      }

      for (const row of (upserted ?? [])) {
        cfdiIdByUuid.set(row.cfdi_uuid, row.id)
      }

      totalUpserted += upserted?.length ?? batch.length
    }

    // 6c. Upsert sat_cfdi_payment_state
    const paymentRows = uniqueInvoices
      .filter((inv) => {
        const uuid = (inv.uuid ?? inv.id).toUpperCase()
        return cfdiIdByUuid.has(uuid)
      })
      .map((inv) => {
        const uuid = (inv.uuid ?? inv.id).toUpperCase()
        return {
          cfdi_id:       cfdiIdByUuid.get(uuid)!,
          company_id:    company.id,
          paid_amount:   inv.paidAmount ?? 0,
          due_amount:    inv.dueAmount ?? null,
          fully_paid_at: inv.fullyPaidAt ?? null,
          as_of:         now,
        }
      })

    if (paymentRows.length > 0) {
      for (let i = 0; i < paymentRows.length; i += BATCH) {
        await adminClient.from('sat_cfdi_payment_state').upsert(
          paymentRows.slice(i, i + BATCH),
          { onConflict: 'cfdi_id', ignoreDuplicates: false },
        )
      }
    }

    // 6d. Upsert sat_cfdi_concepts (primer concepto por CFDI)
    const conceptRows = uniqueInvoices
      .filter((inv) => {
        const uuid = (inv.uuid ?? inv.id).toUpperCase()
        return cfdiIdByUuid.has(uuid) && inv.concepts && inv.concepts.length > 0
      })
      .flatMap((inv) => {
        const uuid = (inv.uuid ?? inv.id).toUpperCase()
        const cfdiId = cfdiIdByUuid.get(uuid)!
        return (inv.concepts ?? []).slice(0, 5).map((c, idx) => ({
          cfdi_id:        cfdiId,
          company_id:     company.id,
          linea:          idx + 1,
          clav_prod_serv: c.claveProdServ ?? null,
          descripcion:    c.description   ?? '',
          cantidad:       c.quantity      ?? null,
          unidad:         c.unit          ?? null,
          valor_unitario: c.unitValue     ?? null,
          importe:        c.amount        ?? 0,
        }))
      })

    if (conceptRows.length > 0) {
      for (let i = 0; i < conceptRows.length; i += BATCH) {
        await adminClient.from('sat_cfdi_concepts').upsert(
          conceptRows.slice(i, i + BATCH),
          { onConflict: 'cfdi_id,linea', ignoreDuplicates: false },
        )
      }
    }

    await updatePhase(adminClient, jobId, 'upsert_cfdis', 70, {
      cfdis_upserted: totalUpserted,
    })

    // ── Fase 7: Declaraciones anuales ───────────────────────────────
    await updatePhase(adminClient, jobId, 'fetch_annual_returns', 90)

    try {
      const returns = await fetchAnnualReturns(entityId, apiKey, baseUrl)

      if (returns.length > 0) {
        const returnRows = returns.map((r) => ({
          company_id:           company.id,
          ejercicio:            r.ejercicio ?? null,
          periodo:              r.periodo ?? 'anual',
          tipo_declaracion:     r.tipoDeclaracion ?? 'normal',
          ingresos_acumulables: r.ingresosAcumulables ?? null,
          deducciones_totales:  r.deduccionesTotales ?? null,
          utilidad_fiscal:      r.utilidadFiscal ?? null,
          isr_causado:          r.isrCausado ?? null,
          isr_a_cargo:          r.isrACargo ?? null,
          raw_json:             r.rawData ?? r,
          synced_at:            now,
        })).filter((r) => r.ejercicio !== null)

        if (returnRows.length > 0) {
          await adminClient
            .from('sat_annual_returns')
            .upsert(returnRows, {
              onConflict: 'company_id,ejercicio,periodo,tipo_declaracion',
              ignoreDuplicates: false,
            })
        }
      }
    } catch (annualErr) {
      // Declaraciones son opcionales — no fallar el job por esto
      console.warn('Annual returns fetch failed (non-critical):', annualErr)
    }

    // ── Fase 8: Completado ──────────────────────────────────────────
    await updatePhase(adminClient, jobId, 'completed', 100, {
      cfdis_upserted: totalUpserted,
    })

    // Actualizar companies.syntage_validated_at
    await adminClient
      .from('companies')
      .update({ syntage_validated_at: now })
      .eq('id', company.id)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('sync-sat-full runSync error:', message)
    await markFailed(adminClient, jobId, message)
  }
}
