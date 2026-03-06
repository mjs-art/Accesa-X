import type { IAdminRepository } from '../repositories/admin.repository'
import type {
  CreditApplication,
  ApplicationStatus,
  ApplicationDetail,
  InternalNote,
  AdminCompanyWithApps,
} from '../types/admin.types'

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

  async getApplicationWithDetails(id: string): Promise<ApplicationDetail | null> {
    return this.adminRepo.getApplicationWithDetails(id)
  }

  async changeStatus(
    id: string,
    newStatus: ApplicationStatus,
    adminId: string,
    adminEmail: string,
    auditText: string,
  ): Promise<void> {
    await this.adminRepo.updateStatus(id, newStatus)
    await this.adminRepo.addNote({
      creditApplicationId: id,
      adminId,
      authorEmail: adminEmail,
      note: `[SISTEMA] ${auditText}`,
    })
  }

  async addNote(creditApplicationId: string, adminId: string, authorEmail: string, note: string): Promise<void> {
    return this.adminRepo.addNote({ creditApplicationId, adminId, authorEmail, note })
  }

  async getNotes(applicationId: string): Promise<InternalNote[]> {
    return this.adminRepo.getNotesByApplicationId(applicationId)
  }

  async getAdminCompanies(): Promise<AdminCompanyWithApps[]> {
    return this.adminRepo.getAdminCompanies()
  }

  async getSignedDownloadUrl(storagePath: string): Promise<string | null> {
    return this.adminRepo.getSignedDownloadUrl(storagePath)
  }
}
