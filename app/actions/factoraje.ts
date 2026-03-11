'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendSolicitudRecibidaEmail } from '@/app/actions/email'

const AUTO_APPROVAL_LIMIT = 2_000_000

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type FactorajeStatus =
  | 'borrador' | 'submitted' | 'en_revision' | 'docs_pendientes'
  | 'aprobado' | 'fondos_liberados' | 'en_ejecucion' | 'liquidado' | 'rechazado'

export interface CfdiDisponible {
  id: string
  cfdi_uuid: string
  receiver_rfc: string
  receiver_name: string | null
  total: number
  due_amount: number
  issued_at: string
  descripcion: string | null
}

export interface FactorajeCfdiRow {
  id: string
  cfdi_id: string
  monto_nominal: number
  aforo_pct: number
  monto_a_dispersar: number
  cfdi?: CfdiDisponible
}

export interface SolicitudFactoraje {
  id: string
  status: FactorajeStatus
  monto_solicitado: number | null
  notificacion_deudor: boolean
  analyst_notes: string | null
  condiciones_aceptadas_at: string | null
  auto_aprobado: boolean
  created_at: string
  cfdis?: FactorajeCfdiRow[]
}

// ── Helper ─────────────────────────────────────────────────────────────────────

async function getCompanyContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: company } = await supabase
    .from('companies')
    .select('id, rfc')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!company) return null
  return { supabase, user, company }
}

// ── Obtener CFDIs disponibles para factoraje ───────────────────────────────────

export async function getCfdisDisponiblesAction(): Promise<CfdiDisponible[] | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { data, error } = await supabase
    .from('cfdis')
    .select('id, cfdi_uuid, receiver_rfc, receiver_name, total, due_amount, issued_at, descripcion')
    .eq('company_id', company.id)
    .eq('issuer_rfc', company.rfc)
    .eq('cfdi_type', 'I')
    .eq('cfdi_status', 'vigente')
    .gt('due_amount', 0)
    .order('issued_at', { ascending: false })

  if (error) return { error: error.message }
  return (data ?? []) as CfdiDisponible[]
}

// ── Crear solicitud de factoraje (borrador) ────────────────────────────────────

export async function createFactorajeAction(
  cfdiIds: string[],
  aforo_pct: number,
  notificacion_deudor: boolean
): Promise<{ id: string } | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  if (cfdiIds.length === 0) return { error: 'Selecciona al menos una factura' }
  if (![80, 85, 90].includes(aforo_pct)) return { error: 'Aforo inválido' }

  const { data: cfdis, error: cErr } = await supabase
    .from('cfdis')
    .select('id, due_amount')
    .in('id', cfdiIds)
    .eq('company_id', company.id)

  if (cErr || !cfdis?.length) return { error: 'No se encontraron las facturas seleccionadas' }

  const totalNominal = cfdis.reduce((s, c) => s + (c.due_amount ?? 0), 0)
  const montoSolicitado = Math.round(totalNominal * (aforo_pct / 100))

  const { data: app, error: appErr } = await supabase
    .from('credit_applications')
    .insert({
      company_id: company.id,
      tipo_credito: 'factoraje',
      status: 'borrador',
      monto_solicitado: montoSolicitado,
      plazo_meses: 0,
      notificacion_deudor,
      auto_aprobado: false,
    })
    .select('id')
    .single()

  if (appErr || !app) return { error: appErr?.message ?? 'Error al crear solicitud' }

  const rows = cfdis.map(c => ({
    credit_application_id: app.id,
    cfdi_id: c.id,
    monto_nominal: c.due_amount ?? 0,
    aforo_pct,
    monto_a_dispersar: Math.round((c.due_amount ?? 0) * (aforo_pct / 100)),
  }))

  const { error: fcErr } = await supabase.from('factoraje_cfdis').insert(rows)
  if (fcErr) {
    await supabase.from('credit_applications').delete().eq('id', app.id)
    return { error: fcErr.message }
  }

  revalidatePath('/dashboard/credito')
  return { id: app.id }
}

// ── Enviar solicitud (borrador → en_revision / aprobado) ──────────────────────

export async function submitFactorajeAction(
  applicationId: string
): Promise<{ status: FactorajeStatus; auto_aprobado: boolean } | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { data: app } = await supabase
    .from('credit_applications')
    .select('id, monto_solicitado, status')
    .eq('id', applicationId)
    .eq('company_id', company.id)
    .single()

  if (!app) return { error: 'Solicitud no encontrada' }
  if (app.status !== 'borrador') return { error: 'Solo puedes enviar borradores' }

  const autoAprobado = (app.monto_solicitado ?? 0) <= AUTO_APPROVAL_LIMIT
  const newStatus: FactorajeStatus = autoAprobado ? 'aprobado' : 'en_revision'

  const { error } = await supabase
    .from('credit_applications')
    .update({
      status: newStatus,
      auto_aprobado: autoAprobado,
      condiciones_aceptadas_at: new Date().toISOString(),
    })
    .eq('id', applicationId)

  if (error) return { error: error.message }

  // Fire-and-forget email
  void (async () => {
    const { data: co } = await supabase.from('companies').select('nombre_razon_social, user_id').eq('id', company.id).single()
    if (co) {
      const { data: au } = await supabase.auth.admin.getUserById(co.user_id)
      if (au?.user?.email)
        await sendSolicitudRecibidaEmail(au.user.email, co.nombre_razon_social, app.monto_solicitado ?? 0, 'factoraje', applicationId)
    }
  })()

  revalidatePath('/dashboard/credito')
  revalidatePath(`/dashboard/credito/${applicationId}`)
  return { status: newStatus, auto_aprobado: autoAprobado }
}

// ── Listar solicitudes ─────────────────────────────────────────────────────────

export async function getFactorajesAction(): Promise<SolicitudFactoraje[] | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { data, error } = await supabase
    .from('credit_applications')
    .select('id, status, monto_solicitado, notificacion_deudor, analyst_notes, condiciones_aceptadas_at, auto_aprobado, created_at')
    .eq('company_id', company.id)
    .eq('tipo_credito', 'factoraje')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return (data ?? []) as SolicitudFactoraje[]
}

// ── Detalle de una solicitud ───────────────────────────────────────────────────

export async function getFactorajeAction(id: string): Promise<SolicitudFactoraje | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { data: app, error } = await supabase
    .from('credit_applications')
    .select('id, status, monto_solicitado, notificacion_deudor, analyst_notes, condiciones_aceptadas_at, auto_aprobado, created_at')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (error || !app) return { error: 'Solicitud no encontrada' }

  const { data: fcRows } = await supabase
    .from('factoraje_cfdis')
    .select('id, cfdi_id, monto_nominal, aforo_pct, monto_a_dispersar')
    .eq('credit_application_id', id)

  const cfdiIds = (fcRows ?? []).map(r => r.cfdi_id)
  const cfdiMap: Record<string, CfdiDisponible> = {}

  if (cfdiIds.length > 0) {
    const { data: cfdisData } = await supabase
      .from('cfdis')
      .select('id, cfdi_uuid, receiver_rfc, receiver_name, total, due_amount, issued_at, descripcion')
      .in('id', cfdiIds)

    for (const c of (cfdisData ?? [])) {
      cfdiMap[c.id] = c as CfdiDisponible
    }
  }

  return {
    ...app,
    cfdis: (fcRows ?? []).map(r => ({
      ...r,
      cfdi: cfdiMap[r.cfdi_id] ?? undefined,
    })),
  } as SolicitudFactoraje
}
