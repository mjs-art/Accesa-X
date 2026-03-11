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

  const { data, error } = await supabase.functions.invoke('get-client-data', {
    body: { clientRfc },
  })

  if (error) return { error: 'No se pudieron obtener los datos del cliente.' }
  return data as ClienteDetalleResult
}
