'use server'

import { createClient } from '@/lib/supabase/server'

export interface Proveedor {
  rfc: string
  nombre: string
  totalComprado: number
  numFacturas: number
  porPagar: number
  ultimaFactura: string | null
}

export interface ProveedoresResult {
  proveedores: Proveedor[]
  totalGasto: number
  totalPorPagar: number
}

export async function getProveedoresAction(): Promise<ProveedoresResult | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, rfc')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (companyError || !company) return { error: 'Empresa no encontrada' }

  const comp = company as unknown as { id: string; rfc: string }

  // Query sat_cfdis directly (RLS filters to own company)
  const { data: cfdis, error: cfdiError } = await supabase
    .from('sat_cfdis')
    .select('issuer_rfc, total, issued_at, cfdi_status, id')
    .eq('company_id', comp.id)
    .eq('receiver_rfc', comp.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .order('issued_at', { ascending: false })

  if (cfdiError) return { error: cfdiError.message }

  const cfdiRows = (cfdis ?? []) as unknown as Array<{
    id: string
    issuer_rfc: string | null
    total: number | null
    issued_at: string | null
    cfdi_status: string
  }>

  // Get issuer names from sat_taxpayers
  const issuerRfcs = Array.from(new Set(cfdiRows.map(r => r.issuer_rfc).filter(Boolean)))
  const { data: taxpayers } = await supabase
    .from('sat_taxpayers')
    .select('rfc, razon_social')
    .in('rfc', issuerRfcs as string[])

  const nameByRfc = new Map<string, string>()
  for (const t of (taxpayers ?? []) as unknown as Array<{ rfc: string; razon_social: string | null }>) {
    if (t.razon_social) nameByRfc.set(t.rfc, t.razon_social)
  }

  // Get payment state (due_amount) for these cfdis
  const cfdiIds = cfdiRows.map(r => r.id)
  const { data: paymentStates } = await supabase
    .from('sat_cfdi_payment_state')
    .select('cfdi_id, due_amount')
    .in('cfdi_id', cfdiIds)

  const dueByUuid = new Map<string, number>()
  for (const ps of (paymentStates ?? []) as unknown as Array<{ cfdi_id: string; due_amount: number | null }>) {
    dueByUuid.set(ps.cfdi_id, ps.due_amount ?? 0)
  }

  const rows = cfdiRows.map(r => ({
    issuer_rfc: r.issuer_rfc,
    issuer_name: r.issuer_rfc ? (nameByRfc.get(r.issuer_rfc) ?? null) : null,
    total: r.total,
    due_amount: dueByUuid.get(r.id) ?? 0,
    issued_at: r.issued_at,
  }))

  const map = new Map<string, Proveedor>()
  for (const inv of rows) {
    const rfc = inv.issuer_rfc?.toUpperCase() ?? 'DESCONOCIDO'
    const existing = map.get(rfc)
    if (existing) {
      existing.totalComprado += inv.total ?? 0
      existing.numFacturas += 1
      existing.porPagar += inv.due_amount
      if (!existing.ultimaFactura || (inv.issued_at ?? '') > existing.ultimaFactura) {
        existing.ultimaFactura = inv.issued_at
      }
    } else {
      map.set(rfc, {
        rfc,
        nombre: inv.issuer_name ?? rfc,
        totalComprado: inv.total ?? 0,
        numFacturas: 1,
        porPagar: inv.due_amount,
        ultimaFactura: inv.issued_at ?? null,
      })
    }
  }

  const proveedores = Array.from(map.values()).sort((a, b) => b.totalComprado - a.totalComprado)
  return {
    proveedores,
    totalGasto: proveedores.reduce((s, p) => s + p.totalComprado, 0),
    totalPorPagar: proveedores.reduce((s, p) => s + p.porPagar, 0),
  }
}

export interface ProveedorDetalle {
  rfc: string
  nombre: string
  totalComprado: number
  numFacturas: number
  porPagar: number
  ultimaFactura: string | null
  porcentajeDelTotal: number
}

export interface FacturaProveedor {
  uuid: string
  total: number
  subtotal: number
  paidAmount: number | null
  dueAmount: number | null
  fullyPaidAt: string | null
  issuedAt: string
  status: string
  descripcion: string
  claveProdServ: string | null
}

export interface ProveedorDetalleResult {
  proveedor: ProveedorDetalle
  invoices: FacturaProveedor[]
  totalGastoEmpresa: number
}

export async function getProveedorDetailAction(
  proveedorRfc: string
): Promise<ProveedorDetalleResult | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, rfc')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (companyError || !company) return { error: 'Empresa no encontrada' }
  const comp = company as unknown as { id: string; rfc: string }

  // Facturas recibidas de este proveedor
  const { data: cfdis, error: cfdiError } = await supabase
    .from('sat_cfdis')
    .select('id, cfdi_uuid, total, subtotal, issued_at, cfdi_status')
    .eq('company_id', comp.id)
    .eq('receiver_rfc', comp.rfc.toUpperCase().trim())
    .eq('issuer_rfc', proveedorRfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .order('issued_at', { ascending: false })

  if (cfdiError) return { error: cfdiError.message }

  const cfdiRows = (cfdis ?? []) as unknown as Array<{
    id: string; cfdi_uuid: string; total: number | null
    subtotal: number | null; issued_at: string; cfdi_status: string
  }>

  // Payment state
  const cfdiIds = cfdiRows.map(r => r.id)
  const { data: paymentStates } = cfdiIds.length > 0
    ? await supabase.from('sat_cfdi_payment_state').select('cfdi_id, paid_amount, due_amount, fully_paid_at').in('cfdi_id', cfdiIds)
    : { data: [] }

  const psMap = new Map<string, { paid_amount: number | null; due_amount: number | null; fully_paid_at: string | null }>()
  for (const ps of (paymentStates ?? []) as unknown as Array<{ cfdi_id: string; paid_amount: number | null; due_amount: number | null; fully_paid_at: string | null }>) {
    psMap.set(ps.cfdi_id, ps)
  }

  // First concept per CFDI
  const { data: concepts } = cfdiIds.length > 0
    ? await supabase.from('sat_cfdi_concepts').select('cfdi_id, descripcion, clav_prod_serv, linea').in('cfdi_id', cfdiIds).eq('linea', 1)
    : { data: [] }

  const conceptMap = new Map<string, { descripcion: string; clav_prod_serv: string | null }>()
  for (const c of (concepts ?? []) as unknown as Array<{ cfdi_id: string; descripcion: string; clav_prod_serv: string | null }>) {
    conceptMap.set(c.cfdi_id, c)
  }

  // Provider name
  const { data: taxpayer } = await supabase
    .from('sat_taxpayers')
    .select('razon_social')
    .eq('rfc', proveedorRfc.toUpperCase().trim())
    .single()
  const proveedorNombre = (taxpayer as unknown as { razon_social: string | null } | null)?.razon_social ?? proveedorRfc

  const invoices: FacturaProveedor[] = cfdiRows.map(r => {
    const ps = psMap.get(r.id)
    const concept = conceptMap.get(r.id)
    return {
      uuid: r.cfdi_uuid,
      total: r.total ?? 0,
      subtotal: r.subtotal ?? 0,
      paidAmount: ps?.paid_amount ?? null,
      dueAmount: ps?.due_amount ?? null,
      fullyPaidAt: ps?.fully_paid_at ?? null,
      issuedAt: r.issued_at,
      status: r.cfdi_status,
      descripcion: concept?.descripcion ?? '',
      claveProdServ: concept?.clav_prod_serv ?? null,
    }
  })

  const totalComprado = invoices.reduce((s, i) => s + i.total, 0)
  const porPagar = invoices.reduce((s, i) => s + (i.dueAmount ?? 0), 0)

  // Total gasto empresa (para porcentaje)
  const { data: allRecibidos } = await supabase
    .from('sat_cfdis')
    .select('total')
    .eq('company_id', comp.id)
    .eq('receiver_rfc', comp.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')

  const totalGastoEmpresa = ((allRecibidos ?? []) as unknown as Array<{ total: number | null }>)
    .reduce((s, r) => s + (r.total ?? 0), 0)

  const porcentajeDelTotal = totalGastoEmpresa > 0
    ? Math.round((totalComprado / totalGastoEmpresa) * 1000) / 10
    : 0

  return {
    proveedor: {
      rfc: proveedorRfc.toUpperCase(),
      nombre: proveedorNombre,
      totalComprado,
      numFacturas: invoices.length,
      porPagar,
      ultimaFactura: cfdiRows[0]?.issued_at ?? null,
      porcentajeDelTotal,
    },
    invoices,
    totalGastoEmpresa,
  }
}
