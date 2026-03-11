'use server'

import { createClient } from '@/lib/supabase/server'

export interface MesData {
  mes: string
  label: string
  total: number
}

export interface TopCliente {
  rfc: string
  nombre: string
  total: number
  facturas: number
}

export interface TopProveedor {
  rfc: string
  nombre: string
  total: number
  facturas: number
}

export interface CxCCliente {
  rfc: string
  nombre: string
  totalPendiente: number
  facturas: number
  facturasMasAntigua: string | null
}

export interface CxPProveedor {
  rfc: string
  nombre: string
  totalPendiente: number
  facturas: number
  facturasMasAntigua: string | null
}

export interface BiData {
  verified: boolean
  ingresos: {
    total: number
    mensual: MesData[]
    topClientes: TopCliente[]
  }
  gastos: {
    total: number
    mensual: MesData[]
    topProveedores: TopProveedor[]
  }
  cxc: {
    total: number
    clientes: CxCCliente[]
  }
  cxp: {
    total: number
    proveedores: CxPProveedor[]
  }
}

export async function getBiData(): Promise<{ data: BiData } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase.functions.invoke('get-bi-data')
  if (error) {
    // Extract actual error body from Edge Function response
    let detail = error.message ?? 'Error desconocido'
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await (error as any).context?.json()
      if (body?.error) detail = body.error
    } catch { /* ignore */ }
    return { error: detail }
  }
  if (!data) return { error: 'Sin datos' }
  return { data: data as BiData }
}
