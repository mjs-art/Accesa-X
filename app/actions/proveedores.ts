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

  const { data, error } = await supabase.functions.invoke('get-proveedores-data')
  if (error) return { error: error.message ?? 'Error desconocido' }
  if (!data) return { error: 'Sin datos' }
  return data as ProveedoresResult
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

  const { data, error } = await supabase.functions.invoke('get-proveedor-data', {
    body: { proveedorRfc },
  })

  if (error) return { error: 'No se pudieron obtener los datos del proveedor.' }
  return data as ProveedorDetalleResult
}
