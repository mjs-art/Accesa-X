export interface DashboardCompany {
  id: string
  nombreRazonSocial: string
  rfc: string
  syntageValidatedAt: string | null
}

export interface Resumen {
  totalFacturado: number
  clientesUnicos: number
  facturasEmitidas: number
}

export interface Cliente {
  rfc: string
  nombre: string
  totalFacturado: number
  facturas: number
  ultimaFactura: string
}

export interface DashboardData {
  company: DashboardCompany
  resumen: Resumen | null
  clientes: Cliente[]
  verified: boolean
}
