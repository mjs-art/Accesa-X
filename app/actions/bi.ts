import { createClient } from '@/lib/supabase/client'

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

// Client-side call — uses browser Supabase client (same pattern as get-dashboard-data)
export async function getBiData(): Promise<{ data: BiData } | { error: string }> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke('get-bi-data')
  if (error) {
    // Try to extract the actual error body from the Edge Function response
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await (error as any).context?.json?.()
      if (body?.error) return { error: `[${body.error}]` }
    } catch { /* ignore parse errors */ }
    return { error: error.message ?? 'Error desconocido' }
  }
  if (!data) return { error: 'Sin datos' }
  return { data: data as BiData }
}
