import type { IDashboardRepository } from '../repositories/dashboard.repository'
import type { DashboardCompany, DashboardData } from '../types/dashboard.types'

export class DashboardService {
  constructor(private readonly dashboardRepo: IDashboardRepository) {}

  async getCompany(userId: string): Promise<DashboardCompany | null> {
    return this.dashboardRepo.getCompany(userId)
  }

  async getDashboardData(userId: string): Promise<DashboardData | null> {
    const company = await this.dashboardRepo.getCompany(userId)
    if (!company) return null

    const result = await this.dashboardRepo.getDashboardData()
    return {
      company,
      resumen: result.resumen,
      clientes: result.clientes,
      verified: result.verified,
    }
  }

  async syncSatData(): Promise<void> {
    return this.dashboardRepo.syncSatData()
  }
}
