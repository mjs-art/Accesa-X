import type { IAdminRepository } from '../repositories/admin.repository'
import type { CreditApplication, ApplicationStatus } from '../types/admin.types'

export class AdminService {
  constructor(private readonly adminRepo: IAdminRepository) {}

  async getApplications(): Promise<CreditApplication[]> {
    return this.adminRepo.getApplications()
  }

  async getApplicationById(id: string): Promise<CreditApplication | null> {
    return this.adminRepo.getApplicationById(id)
  }

  async updateStatus(id: string, status: ApplicationStatus): Promise<void> {
    return this.adminRepo.updateStatus(id, status)
  }
}
