import type {
  CreditApplication,
  ApplicationStatus,
  ApplicationDetail,
  InternalNote,
  AddNoteInput,
  AdminCompanyWithApps,
} from '../types/admin.types'

export interface IAdminRepository {
  getApplications(): Promise<CreditApplication[]>
  getApplicationById(id: string): Promise<CreditApplication | null>
  updateStatus(id: string, status: ApplicationStatus): Promise<void>
  getApplicationWithDetails(id: string): Promise<ApplicationDetail | null>
  addNote(input: AddNoteInput): Promise<void>
  getNotesByApplicationId(applicationId: string): Promise<InternalNote[]>
  getAdminCompanies(): Promise<AdminCompanyWithApps[]>
  getSignedDownloadUrl(storagePath: string): Promise<string | null>
}
