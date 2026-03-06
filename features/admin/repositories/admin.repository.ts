import type { CreditApplication, ApplicationStatus } from '../types/admin.types'

export interface IAdminRepository {
  getApplications(): Promise<CreditApplication[]>
  getApplicationById(id: string): Promise<CreditApplication | null>
  updateStatus(id: string, status: ApplicationStatus): Promise<void>
}
