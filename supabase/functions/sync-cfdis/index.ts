import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SYNTAGE_API_KEY = Deno.env.get('SYNTAGE_API_KEY')!
const SYNTAGE_BASE_URL = Deno.env.get('SYNTAGE_BASE_URL')!

interface SyntageInvoice {
  id: string
  uuid?: string
  type: string
  status: string
  total: number
  subtotal?: number
  issuedAt: string
  expiresAt?: string | null
  paidAmount?: number
  dueAmount?: number
  fullyPaidAt?: string | null
  receiver: { rfc: string; name: string }
  issuer: { rfc: string; name: string }
  blacklistStatus?: string | null
  concepts?: { claveProdServ?: string; description?: string }[]
}

interface SyntageResponse {
  'hydra:member': SyntageInvoice[]
  'hydra:totalItems': number
}

// Trae todas las páginas de Syntage para un query dado
async function fetchAllPages(baseUrl: URL, apiKey: string): Promise<SyntageInvoice[]> {
  const all: SyntageInvoice[] = []
  let page = 1
  const itemsPerPage = 300

  while (true) {
    const url = new URL(baseUrl.toString())
    url.searchParams.set('itemsPerPage', String(itemsPerPage))
    url.searchParams.set('page', String(page))

    const res = await fetch(url.toString(), { headers: { 'X-API-Key': apiKey } })
    if (!res.ok) {
      console.error(`Syntage error p${page}:`, res.status, await res.text())
      break
    }

    const data: SyntageResponse = await res.json()
    const items = data['hydra:member'] ?? []
    all.push(...items)

    const total = data['hydra:totalItems'] ?? 0
    if (all.length >= total || items.length < itemsPerPage) break
    page++
  }

  return all
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    // Verificar usuario
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonError('Unauthorized', 401)

    // Obtener empresa con service role (no toca RLS)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc, estatus_sat')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) return jsonError('Empresa no encontrada', 404)
    if (!company.estatus_sat) return json({ synced: 0, message: 'SAT no conectado' })

    const rfc = encodeURIComponent(company.rfc)

    // Fetch emitidos y recibidos en paralelo
    const emitidosUrl = new URL(`${SYNTAGE_BASE_URL}/taxpayers/${rfc}/invoices`)
    emitidosUrl.searchParams.set('isIssuer', 'true')
    emitidosUrl.searchParams.set('type', 'I')
    emitidosUrl.searchParams.set('order[issuedAt]', 'desc')

    const recibidosUrl = new URL(`${SYNTAGE_BASE_URL}/taxpayers/${rfc}/invoices`)
    recibidosUrl.searchParams.set('isReceiver', 'true')
    recibidosUrl.searchParams.set('type', 'I')
    recibidosUrl.searchParams.set('order[issuedAt]', 'desc')

    const [emitidos, recibidos] = await Promise.all([
      fetchAllPages(emitidosUrl, SYNTAGE_API_KEY),
      fetchAllPages(recibidosUrl, SYNTAGE_API_KEY),
    ])

    // Construir filas para upsert
    const now = new Date().toISOString()
    const rows = [...emitidos, ...recibidos].map((inv) => ({
      company_id:      company.id,
      cfdi_uuid:       (inv.uuid ?? inv.id).toUpperCase(),
      cfdi_type:       'I' as const,
      issuer_rfc:      inv.issuer?.rfc?.toUpperCase() ?? '',
      issuer_name:     inv.issuer?.name ?? null,
      receiver_rfc:    inv.receiver?.rfc?.toUpperCase() ?? '',
      receiver_name:   inv.receiver?.name ?? null,
      subtotal:        inv.subtotal ?? inv.total ?? null,
      total:           inv.total ?? null,
      paid_amount:     inv.paidAmount ?? 0,
      due_amount:      inv.dueAmount ?? null,
      fully_paid_at:   inv.fullyPaidAt ?? null,
      issued_at:       inv.issuedAt,
      expires_at:      inv.expiresAt ?? null,
      cfdi_status:     (inv.status?.toLowerCase() === 'cancelado' ? 'cancelado' : 'vigente') as 'vigente' | 'cancelado',
      blacklist_status: inv.blacklistStatus ?? null,
      clav_prod_serv:  inv.concepts?.[0]?.claveProdServ ?? null,
      descripcion:     inv.concepts?.[0]?.description ?? null,
      raw_json:        inv,
      synced_at:       now,
    }))

    if (rows.length === 0) {
      return json({ synced: 0, message: 'Sin CFDIs en Syntage' })
    }

    // Upsert en lotes de 200 para no saturar el request
    const BATCH = 200
    let totalUpserted = 0

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error: upsertError, count } = await adminClient
        .from('cfdis')
        .upsert(batch, {
          onConflict: 'company_id,cfdi_uuid',
          ignoreDuplicates: false, // actualizar due_amount, paid_amount, etc.
          count: 'exact',
        })

      if (upsertError) {
        console.error('Upsert error batch', i, upsertError)
        return jsonError(`Error guardando CFDIs: ${upsertError.message}`, 500)
      }
      totalUpserted += count ?? batch.length
    }

    return json({
      synced: totalUpserted,
      emitidos: emitidos.length,
      recibidos: recibidos.length,
      message: `${totalUpserted} CFDIs sincronizados`,
    })
  } catch (err) {
    console.error('sync-cfdis error:', err)
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500)
  }
})

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
