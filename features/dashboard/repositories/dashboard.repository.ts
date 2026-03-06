import type { DashboardCompany, Resumen, Cliente } from '../types/dashboard.types'

export interface DashboardResult {
  verified: boolean
  resumen: Resumen | null
  clientes: Cliente[]
}

export interface IDashboardRepository {
  getCompany(userId: string): Promise<DashboardCompany | null>
  getDashboardData(): Promise<DashboardResult>
  syncSatData(): Promise<void>
}
