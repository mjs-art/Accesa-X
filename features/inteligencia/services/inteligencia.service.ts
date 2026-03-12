import type { ISyncJobRepository } from '../repositories/sync-job.repository'
import type { SyncJob } from '../types/inteligencia.types'

export class InteligenciaService {
  constructor(private readonly syncJobRepo: ISyncJobRepository) {}

  async getSyncStatus(companyId: string): Promise<SyncJob | null> {
    return this.syncJobRepo.findLatestByCompanyId(companyId)
  }

  async getActiveSyncJob(companyId: string): Promise<SyncJob | null> {
    return this.syncJobRepo.findActiveByCompanyId(companyId)
  }

  async getSyncJobById(jobId: string): Promise<SyncJob | null> {
    return this.syncJobRepo.findById(jobId)
  }

  async isSyncCompleted(companyId: string): Promise<boolean> {
    const job = await this.syncJobRepo.findLatestByCompanyId(companyId)
    return job?.status === 'completed'
  }
}
