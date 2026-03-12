import type { SyncJob } from '../types/inteligencia.types'

export interface ISyncJobRepository {
  findLatestByCompanyId(companyId: string): Promise<SyncJob | null>
  findById(jobId: string): Promise<SyncJob | null>
  findActiveByCompanyId(companyId: string): Promise<SyncJob | null>
}
