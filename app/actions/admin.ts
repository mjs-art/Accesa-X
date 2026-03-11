'use server'

import { createClient } from '@/lib/supabase/server'
import { SupabaseAdminRepository } from '@/features/admin/repositories/admin.repository.impl'
import { AdminService } from '@/features/admin/services/admin.service'
import type { ApplicationStatus } from '@/features/admin/types/admin.types'
import {
  sendSolicitudAprobadaEmail,
  sendSolicitudRechazadaEmail,
  sendDocsPendientesEmail,
  sendFondosLiberadosEmail,
} from '@/app/actions/email'

function buildService(supabase: Awaited<ReturnType<typeof createClient>>) {
  return new AdminService(new SupabaseAdminRepository(supabase))
}

export async function getApplicationsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const applications = await service.getApplications()
  return { success: true, applications }
}

export async function getApplicationWithDetailsAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const application = await service.getApplicationWithDetails(id)
  if (!application) return { error: 'Solicitud no encontrada' }
  return { success: true, application }
}

export async function changeApplicationStatusAction(
  id: string,
  newStatus: ApplicationStatus,
  auditText: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const service = buildService(supabase)
    await service.changeStatus(id, newStatus, user.id, user.email ?? 'admin', auditText)

    // Send email notification to applicant (fire-and-forget)
    void sendStatusEmail(supabase, id, newStatus, auditText)

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al actualizar estado' }
  }
}

async function sendStatusEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  newStatus: ApplicationStatus,
  auditText: string,
) {
  const notifyStatuses: ApplicationStatus[] = ['aprobado', 'rechazado', 'docs_pendientes', 'fondos_liberados']
  if (!notifyStatuses.includes(newStatus)) return

  // Get application + company + owner email
  const { data: app } = await supabase
    .from('credit_applications')
    .select('monto_solicitado, tipo_credito, company_id')
    .eq('id', applicationId)
    .single()
  if (!app) return

  const { data: company } = await supabase
    .from('companies')
    .select('nombre_razon_social, user_id')
    .eq('id', app.company_id)
    .single()
  if (!company) return

  const { data: authUser } = await supabase.auth.admin.getUserById(company.user_id)
  const email = authUser?.user?.email
  if (!email) return

  const empresa = company.nombre_razon_social
  const monto = app.monto_solicitado ?? 0
  const tipo = app.tipo_credito as 'proyecto' | 'factoraje'

  if (newStatus === 'aprobado') {
    await sendSolicitudAprobadaEmail(email, empresa, monto, tipo, applicationId)
  } else if (newStatus === 'rechazado') {
    const motivo = auditText.replace(/^Solicitud RECHAZADA\. Razón: /, '')
    await sendSolicitudRechazadaEmail(email, empresa, monto, motivo, applicationId)
  } else if (newStatus === 'docs_pendientes') {
    const notas = auditText.replace(/^Documentos adicionales requeridos: /, '')
    await sendDocsPendientesEmail(email, empresa, notas, applicationId)
  } else if (newStatus === 'fondos_liberados') {
    await sendFondosLiberadosEmail(email, empresa, monto, applicationId)
  }
}

export async function addNoteAction(creditApplicationId: string, note: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const service = buildService(supabase)
    await service.addNote(creditApplicationId, user.id, user.email ?? 'admin', note)
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al agregar nota' }
  }
}

export async function getNotesAction(applicationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const notes = await service.getNotes(applicationId)
  return { success: true, notes }
}

export async function getAdminCompaniesAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const companies = await service.getAdminCompanies()
  return { success: true, companies }
}

export async function getSignedDownloadUrlAction(storagePath: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const signedUrl = await service.getSignedDownloadUrl(storagePath)
  if (!signedUrl) return { error: 'No se pudo generar el enlace' }
  return { success: true, signedUrl }
}

// ── Análisis financiero de una empresa (para admin) ────────────────────────────

export interface AdminFinancialAnalisis {
  dso: number
  dpo: number
  dsoStatus: 'verde' | 'amarillo' | 'rojo'
  dpoStatus: 'verde' | 'amarillo' | 'rojo'
  capitalTrabajo: number
  totalPorCobrar: number
  totalPorPagar: number
  concentracionTop: number
  topClienteNombre: string
  concentracionStatus: 'verde' | 'amarillo' | 'rojo'
  ratioGastos: number
  ingresosMes: number
  gastosMes: number
  ratioStatus: 'verde' | 'amarillo' | 'rojo'
  totalIngresos12m: number
  synced: boolean
}

function monthKeyAdmin(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function daysSinceAdmin(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export async function getCompanyFinancialAnalisisAction(
  companyId: string,
  companyRfc: string
): Promise<AdminFinancialAnalisis | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Sin permisos' }

  const { count } = await supabase
    .from('cfdis').select('id', { count: 'exact', head: true }).eq('company_id', companyId)

  if (!count || count === 0) {
    return {
      dso: 0, dpo: 0, dsoStatus: 'verde', dpoStatus: 'verde',
      capitalTrabajo: 0, totalPorCobrar: 0, totalPorPagar: 0,
      concentracionTop: 0, topClienteNombre: '—', concentracionStatus: 'verde',
      ratioGastos: 0, ingresosMes: 0, gastosMes: 0, ratioStatus: 'verde',
      totalIngresos12m: 0, synced: false,
    }
  }

  const since12m = new Date()
  since12m.setMonth(since12m.getMonth() - 11)
  since12m.setDate(1)

  const [emitidosRes, recibidosRes, cxcRes, cxpRes] = await Promise.all([
    supabase.from('cfdis').select('total, issued_at, receiver_rfc, receiver_name')
      .eq('company_id', companyId).eq('issuer_rfc', companyRfc)
      .eq('cfdi_type', 'I').eq('cfdi_status', 'vigente')
      .gte('issued_at', since12m.toISOString()),
    supabase.from('cfdis').select('total, issued_at')
      .eq('company_id', companyId).eq('receiver_rfc', companyRfc)
      .eq('cfdi_type', 'I').eq('cfdi_status', 'vigente')
      .gte('issued_at', since12m.toISOString()),
    supabase.from('cfdis').select('due_amount, issued_at')
      .eq('company_id', companyId).eq('issuer_rfc', companyRfc)
      .eq('cfdi_type', 'I').eq('cfdi_status', 'vigente').gt('due_amount', 0),
    supabase.from('cfdis').select('due_amount, issued_at')
      .eq('company_id', companyId).eq('receiver_rfc', companyRfc)
      .eq('cfdi_type', 'I').eq('cfdi_status', 'vigente').gt('due_amount', 0),
  ])

  const emitidos = emitidosRes.data ?? []
  const recibidos = recibidosRes.data ?? []
  const cxcRows = cxcRes.data ?? []
  const cxpRows = cxpRes.data ?? []

  const now = new Date()
  const cutoff90 = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const currentKey = monthKeyAdmin(now.toISOString())

  let totalIngresos12m = 0, ingresos90 = 0, ingresosMes = 0
  const byCliente: Record<string, { nombre: string; total: number }> = {}

  for (const r of emitidos) {
    const t = r.total ?? 0
    totalIngresos12m += t
    if (new Date(r.issued_at) >= cutoff90) ingresos90 += t
    if (monthKeyAdmin(r.issued_at) === currentKey) ingresosMes += t
    const rfc = r.receiver_rfc?.toUpperCase() ?? 'DESCONOCIDO'
    if (!byCliente[rfc]) byCliente[rfc] = { nombre: r.receiver_name ?? rfc, total: 0 }
    byCliente[rfc].total += t
  }

  let gastos90 = 0, gastosMes = 0
  for (const r of recibidos) {
    const t = r.total ?? 0
    if (new Date(r.issued_at) >= cutoff90) gastos90 += t
    if (monthKeyAdmin(r.issued_at) === currentKey) gastosMes += t
  }

  const totalPorCobrar = cxcRows.reduce((s, r) => s + (r.due_amount ?? 0), 0)
  const totalPorPagar = cxpRows.reduce((s, r) => s + (r.due_amount ?? 0), 0)
  const dso = ingresos90 > 0 ? Math.round((totalPorCobrar / ingresos90) * 90) : 0
  const dpo = gastos90 > 0 ? Math.round((totalPorPagar / gastos90) * 90) : 0

  const topCliente = Object.entries(byCliente).sort((a, b) => b[1].total - a[1].total)[0]
  const concentracionTop = totalIngresos12m > 0 && topCliente
    ? Math.round((topCliente[1].total / totalIngresos12m) * 100) : 0
  const ratioRaw = ingresosMes > 0 ? gastosMes / ingresosMes : 0

  return {
    dso, dpo,
    dsoStatus: dso <= 30 ? 'verde' : dso <= 60 ? 'amarillo' : 'rojo',
    dpoStatus: dpo <= 45 ? 'verde' : dpo <= 75 ? 'amarillo' : 'rojo',
    capitalTrabajo: totalPorCobrar - totalPorPagar,
    totalPorCobrar, totalPorPagar,
    concentracionTop, topClienteNombre: topCliente?.[1].nombre ?? '—',
    concentracionStatus: concentracionTop < 30 ? 'verde' : concentracionTop < 50 ? 'amarillo' : 'rojo',
    ratioGastos: Math.round(ratioRaw * 100),
    ingresosMes, gastosMes,
    ratioStatus: ratioRaw < 0.7 ? 'verde' : ratioRaw < 0.9 ? 'amarillo' : 'rojo',
    totalIngresos12m, synced: true,
  }
}

// ── Docs de financiamiento (para admin) ───────────────────────────────────────

export async function getFinanciamientoDocumentosAction(applicationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data } = await supabase
    .from('financiamiento_documentos')
    .select('*')
    .eq('credit_application_id', applicationId)
    .order('uploaded_at')

  return { docs: data ?? [] }
}

// ── Proveedor del proyecto (para admin) ───────────────────────────────────────

export async function getProjectVendorAdminAction(applicationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data } = await supabase
    .from('project_vendors')
    .select('*')
    .eq('credit_application_id', applicationId)
    .limit(1)
    .single()

  return { vendor: data ?? null }
}

export async function verificarProveedorAdminAction(
  vendorId: string,
  campo: 'clabe' | 'rfc'
): Promise<{ ok: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Sin permisos' }

  const update = campo === 'clabe'
    ? { clabe_verificada: true, verificado_por: user.id, verificado_at: new Date().toISOString() }
    : { rfc_verificado: true, verificado_por: user.id, verificado_at: new Date().toISOString() }

  const { error } = await supabase.from('project_vendors').update(update).eq('id', vendorId)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── CFDIs de factoraje (para admin) ───────────────────────────────────────────

export interface AdminFactorajeCfdi {
  id: string
  cfdi_id: string
  monto_nominal: number
  aforo_pct: number
  monto_a_dispersar: number
  receiver_rfc: string
  receiver_name: string | null
  issued_at: string
  cfdi_uuid: string
}

export async function getFactorajeCfdisAdminAction(
  applicationId: string
): Promise<AdminFactorajeCfdi[] | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Sin permisos' }

  const { data: rows, error } = await supabase
    .from('factoraje_cfdis')
    .select('id, cfdi_id, monto_nominal, aforo_pct, monto_a_dispersar')
    .eq('credit_application_id', applicationId)

  if (error) return { error: error.message }
  if (!rows?.length) return []

  const { data: cfdis } = await supabase
    .from('cfdis')
    .select('id, cfdi_uuid, receiver_rfc, receiver_name, issued_at')
    .in('id', rows.map(r => r.cfdi_id))

  const cfdiMap: Record<string, { cfdi_uuid: string; receiver_rfc: string; receiver_name: string | null; issued_at: string }> = {}
  for (const c of (cfdis ?? [])) cfdiMap[c.id] = c

  return rows.map(r => ({
    ...r,
    cfdi_uuid: cfdiMap[r.cfdi_id]?.cfdi_uuid ?? '',
    receiver_rfc: cfdiMap[r.cfdi_id]?.receiver_rfc ?? '',
    receiver_name: cfdiMap[r.cfdi_id]?.receiver_name ?? null,
    issued_at: cfdiMap[r.cfdi_id]?.issued_at ?? '',
  }))
}

export async function getFinanciamientoSignedUrlAction(storagePath: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase.storage
    .from('financiamiento-docs')
    .createSignedUrl(storagePath, 3600)

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
