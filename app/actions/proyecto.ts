'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendSolicitudRecibidaEmail } from '@/app/actions/email'

// ── Configuración ──────────────────────────────────────────────────────────────
const AUTO_APPROVAL_LIMIT = 2_000_000  // MXN — ajustar según criterio de negocio
const MONTO_MINIMO = 500_000
const MONTO_MAXIMO = 20_000_000

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Tipos exportados ───────────────────────────────────────────────────────────

export interface OrdenCompraAnalysis {
  resumen: string
  monto_total: number
  moneda: string
  cliente_nombre: string
  cliente_rfc: string | null
  fecha_documento: string | null
  fecha_entrega: string | null
  descripcion_servicio: string
  viabilidad_score: number
  viabilidad_razon: string
  riesgos: { descripcion: string; nivel: 'alto' | 'medio' | 'bajo' }[]
}

export type ProyectoStatus =
  | 'borrador' | 'submitted' | 'en_revision' | 'docs_pendientes'
  | 'aprobado' | 'fondos_liberados' | 'en_ejecucion' | 'liquidado' | 'rechazado'

export interface SolicitudProyecto {
  id: string
  status: ProyectoStatus
  project_name: string | null
  descripcion_proyecto: string | null
  monto_total: number | null
  monto_solicitado: number | null
  porcentaje_anticipo: number | null
  // Pagador final
  client_name: string | null
  client_rfc: string | null
  pagador_contacto_nombre: string | null
  pagador_contacto_correo: string | null
  // Proveedor principal (de project_vendors)
  proveedor?: {
    id: string
    vendor_name: string
    vendor_rfc: string
    clabe: string
    monto_asignado: number
    clabe_verificada: boolean
    rfc_verificado: boolean
  } | null
  // Documentos
  documentos?: Array<{
    id: string
    tipo: string
    storage_path: string
    nombre_archivo: string | null
    uploaded_at: string
  }>
  // Meta
  auto_aprobado: boolean
  analyst_notes: string | null
  condiciones_aceptadas_at: string | null
  fecha_desembolso: string | null
  fecha_liquidacion_est: string | null
  fecha_liquidacion_real: string | null
  created_at: string
}

export interface CreateProyectoInput {
  project_name: string
  descripcion_proyecto: string
  monto_total: number
  porcentaje_anticipo: number  // 80 | 85 | 90
  // Pagador
  client_name: string
  client_rfc: string
  pagador_contacto_nombre: string
  pagador_contacto_correo: string
  // Proveedor
  proveedor_nombre: string
  proveedor_rfc: string
  proveedor_clabe: string
  proveedor_monto: number
}

// ── Crear borrador ─────────────────────────────────────────────────────────────

export async function createProyectoAction(
  input: CreateProyectoInput
): Promise<{ id: string } | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  // Validaciones básicas
  if (input.monto_total < MONTO_MINIMO)
    return { error: `El monto mínimo es $${MONTO_MINIMO.toLocaleString('es-MX')} MXN` }
  if (input.monto_total > MONTO_MAXIMO)
    return { error: `El monto máximo es $${MONTO_MAXIMO.toLocaleString('es-MX')} MXN` }

  const montoFinanciado = Math.round(input.monto_total * (input.porcentaje_anticipo / 100))

  // Crear solicitud
  const { data: app, error: appErr } = await supabase
    .from('credit_applications')
    .insert({
      company_id: company.id,
      tipo_credito: 'proyecto',
      status: 'borrador',
      monto_solicitado: montoFinanciado,
      monto_total: input.monto_total,
      plazo_meses: 0,  // se define al aprobar según fecha liquidación
      destino: input.descripcion_proyecto,
      project_name: input.project_name,
      descripcion_proyecto: input.descripcion_proyecto,
      porcentaje_anticipo: input.porcentaje_anticipo,
      client_name: input.client_name,
      client_rfc: input.client_rfc.toUpperCase(),
      pagador_contacto_nombre: input.pagador_contacto_nombre,
      pagador_contacto_correo: input.pagador_contacto_correo,
    })
    .select('id')
    .single()

  if (appErr || !app) return { error: appErr?.message ?? 'Error al crear solicitud' }

  // Crear proveedor
  const { error: pvErr } = await supabase
    .from('project_vendors')
    .insert({
      credit_application_id: app.id,
      company_id: company.id,
      vendor_name: input.proveedor_nombre,
      vendor_rfc: input.proveedor_rfc.toUpperCase(),
      clabe: input.proveedor_clabe,
      monto_asignado: input.proveedor_monto,
    })

  if (pvErr) {
    // Rollback aplicación
    await supabase.from('credit_applications').delete().eq('id', app.id)
    return { error: pvErr.message }
  }

  revalidatePath('/dashboard/credito')
  return { id: app.id }
}

// ── Enviar solicitud (borrador → en_revision) ─────────────────────────────────

export async function submitProyectoAction(
  applicationId: string
): Promise<{ status: ProyectoStatus; auto_aprobado: boolean } | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  // Verificar que la solicitud pertenece a esta empresa
  const { data: app } = await supabase
    .from('credit_applications')
    .select('id, monto_solicitado, status')
    .eq('id', applicationId)
    .eq('company_id', company.id)
    .single()

  if (!app) return { error: 'Solicitud no encontrada' }
  if (app.status !== 'borrador') return { error: 'Solo puedes enviar borradores' }

  // Verificar documentos requeridos
  const { data: docs } = await supabase
    .from('financiamiento_documentos')
    .select('tipo')
    .eq('credit_application_id', applicationId)

  const tiposSubidos = new Set((docs ?? []).map(d => d.tipo))
  if (!tiposSubidos.has('orden_compra')) return { error: 'Falta subir la Orden de Compra' }
  if (!tiposSubidos.has('correo_pagador')) return { error: 'Falta subir el correo de confirmación del pagador' }

  // Reglas de auto-aprobación
  const autoAprobado = (app.monto_solicitado ?? 0) <= AUTO_APPROVAL_LIMIT

  const newStatus: ProyectoStatus = autoAprobado ? 'aprobado' : 'en_revision'

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
        await sendSolicitudRecibidaEmail(au.user.email, co.nombre_razon_social, app.monto_solicitado ?? 0, 'proyecto', applicationId)
    }
  })()

  revalidatePath('/dashboard/credito')
  revalidatePath(`/dashboard/credito/${applicationId}`)
  return { status: newStatus, auto_aprobado: autoAprobado }
}

// ── Obtener lista de solicitudes ───────────────────────────────────────────────

export async function getProyectosAction(): Promise<SolicitudProyecto[] | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { data, error } = await supabase
    .from('credit_applications')
    .select('*')
    .eq('company_id', company.id)
    .eq('tipo_credito', 'proyecto')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return (data ?? []) as SolicitudProyecto[]
}

// ── Obtener detalle de una solicitud ──────────────────────────────────────────

export async function getProyectoAction(
  id: string
): Promise<SolicitudProyecto | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { data: app, error } = await supabase
    .from('credit_applications')
    .select('*')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (error || !app) return { error: 'Solicitud no encontrada' }

  const [pvRes, docsRes] = await Promise.all([
    supabase.from('project_vendors').select('*').eq('credit_application_id', id).limit(1).single(),
    supabase.from('financiamiento_documentos').select('*').eq('credit_application_id', id),
  ])

  return {
    ...app,
    proveedor: pvRes.data ?? null,
    documentos: docsRes.data ?? [],
  } as SolicitudProyecto
}

// ── Subir documento ───────────────────────────────────────────────────────────

export async function uploadDocumentoAction(
  applicationId: string,
  tipo: 'orden_compra' | 'correo_pagador' | 'contrato' | 'factura_aceptada',
  formData: FormData
): Promise<{ path: string } | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, user, company } = ctx

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No se recibió archivo' }
  if (file.size > 20 * 1024 * 1024) return { error: 'El archivo excede 20 MB' }

  const ext = file.name.split('.').pop() ?? 'pdf'
  const path = `${user.id}/${applicationId}/${tipo}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('financiamiento-docs')
    .upload(path, file, { upsert: true })

  if (uploadErr) return { error: uploadErr.message }

  // Registrar en DB (upsert por tipo)
  const { data: existing } = await supabase
    .from('financiamiento_documentos')
    .select('id')
    .eq('credit_application_id', applicationId)
    .eq('tipo', tipo)
    .single()

  if (existing) {
    await supabase
      .from('financiamiento_documentos')
      .update({ storage_path: path, nombre_archivo: file.name, mime_type: file.type, tamanio_bytes: file.size, uploaded_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('financiamiento_documentos')
      .insert({
        credit_application_id: applicationId,
        company_id: company.id,
        tipo, storage_path: path, nombre_archivo: file.name, mime_type: file.type, tamanio_bytes: file.size,
      })
  }

  return { path }
}

// ── Obtener URL firmada para ver documento ────────────────────────────────────

export async function getDocumentUrlAction(path: string): Promise<{ url: string } | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase } = ctx

  const { data, error } = await supabase.storage
    .from('financiamiento-docs')
    .createSignedUrl(path, 3600)  // 1 hora

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

// ── Admin: resolver solicitud ─────────────────────────────────────────────────

export async function resolverSolicitudAction(
  applicationId: string,
  action: 'aprobar' | 'rechazar' | 'pedir_docs',
  notas?: string
): Promise<{ ok: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Sin permisos' }

  const statusMap = {
    aprobar: 'aprobado',
    rechazar: 'rechazado',
    pedir_docs: 'docs_pendientes',
  } as const

  const { error } = await supabase
    .from('credit_applications')
    .update({
      status: statusMap[action],
      analista_id: user.id,
      analyst_notes: notas ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', applicationId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/solicitudes/${applicationId}`)
  revalidatePath('/admin/solicitudes')
  return { ok: true }
}

// ── Admin: verificar CLABE/RFC del proveedor ──────────────────────────────────

export async function verificarProveedorAction(
  proveedorId: string,
  campo: 'clabe' | 'rfc'
): Promise<{ ok: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Sin permisos' }

  const update = campo === 'clabe'
    ? { clabe_verificada: true, verificado_por: user.id, verificado_at: new Date().toISOString() }
    : { rfc_verificado: true, verificado_por: user.id, verificado_at: new Date().toISOString() }

  const { error } = await supabase
    .from('project_vendors')
    .update(update)
    .eq('id', proveedorId)

  if (error) return { error: error.message }
  return { ok: true }
}

// ── Analizar orden de compra con Claude ────────────────────────────────────────

export async function analyzeOrdenCompraAction(
  applicationId: string,
  storagePath: string
): Promise<{ analysis: OrdenCompraAnalysis } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase.functions.invoke('analyze-orden-compra', {
    body: { application_id: applicationId, storage_path: storagePath },
  })

  if (error) return { error: error.message ?? 'Error al analizar documento' }
  if (!data?.success) return { error: data?.error ?? 'Sin respuesta del análisis' }
  return { analysis: data.analysis as OrdenCompraAnalysis }
}
