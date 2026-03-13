'use server'

import { createClient } from '@/lib/supabase/server'

export interface ClienteDetalle {
  rfc: string
  nombre: string
  totalFacturado: number
  numFacturas: number
  porCobrar: number
  ultimaFactura: string | null
  porcentajeDelTotal: number
}

export interface FacturaCliente {
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

export interface ClienteDetalleResult {
  client: ClienteDetalle
  invoices: FacturaCliente[]
  totalEmpresa: number
}

export async function getClientDetailAction(
  clientRfc: string
): Promise<ClienteDetalleResult | { error: string }> {
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

  // Facturas emitidas a este cliente
  const { data: cfdis, error: cfdiError } = await supabase
    .from('sat_cfdis')
    .select('id, cfdi_uuid, total, subtotal, issued_at, cfdi_status')
    .eq('company_id', comp.id)
    .eq('issuer_rfc', comp.rfc.toUpperCase().trim())
    .eq('receiver_rfc', clientRfc.toUpperCase().trim())
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

  // First concept (descripcion + clave) per CFDI
  const { data: concepts } = cfdiIds.length > 0
    ? await supabase.from('sat_cfdi_concepts').select('cfdi_id, descripcion, clav_prod_serv, linea').in('cfdi_id', cfdiIds).eq('linea', 1)
    : { data: [] }

  const conceptMap = new Map<string, { descripcion: string; clav_prod_serv: string | null }>()
  for (const c of (concepts ?? []) as unknown as Array<{ cfdi_id: string; descripcion: string; clav_prod_serv: string | null }>) {
    conceptMap.set(c.cfdi_id, c)
  }

  // Client name from sat_taxpayers
  const { data: taxpayer } = await supabase
    .from('sat_taxpayers')
    .select('razon_social')
    .eq('rfc', clientRfc.toUpperCase().trim())
    .single()
  const clientNombre = (taxpayer as unknown as { razon_social: string | null } | null)?.razon_social ?? clientRfc

  const invoices: FacturaCliente[] = cfdiRows.map(r => {
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

  const totalFacturado = invoices.reduce((s, i) => s + i.total, 0)
  const porCobrar = invoices.reduce((s, i) => s + (i.dueAmount ?? 0), 0)

  // Total emitido por la empresa (para porcentaje)
  const { data: allEmitidos } = await supabase
    .from('sat_cfdis')
    .select('total')
    .eq('company_id', comp.id)
    .eq('issuer_rfc', comp.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')

  const totalEmpresa = ((allEmitidos ?? []) as unknown as Array<{ total: number | null }>)
    .reduce((s, r) => s + (r.total ?? 0), 0)

  const porcentajeDelTotal = totalEmpresa > 0
    ? Math.round((totalFacturado / totalEmpresa) * 1000) / 10
    : 0

  return {
    client: {
      rfc: clientRfc.toUpperCase(),
      nombre: clientNombre,
      totalFacturado,
      numFacturas: invoices.length,
      porCobrar,
      ultimaFactura: cfdiRows[0]?.issued_at ?? null,
      porcentajeDelTotal,
    },
    invoices,
    totalEmpresa,
  }
}
