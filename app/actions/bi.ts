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

export async function getBiData(): Promise<{ data: BiData } | { error: string }> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autenticado' }

  const { data, error } = await supabase.functions.invoke('get-bi-data', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) return { error: error.message ?? 'Error desconocido' }
  if (!data) return { error: 'Sin datos' }
  return { data: data as BiData }
}
