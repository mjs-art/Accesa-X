import type { SupabaseClient } from '@supabase/supabase-js'
import type { ISyncJobRepository } from './sync-job.repository'
import type { SyncJob, SyncStatus, SyncPhase } from '../types/inteligencia.types'

export class SupabaseSyncJobRepository implements ISyncJobRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findLatestByCompanyId(companyId: string): Promise<SyncJob | null> {
    const { data, error } = await this.supabase
      .from('sat_sync_jobs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return this.toDomain(data as Record<string, unknown>)
  }

  async findById(jobId: string): Promise<SyncJob | null> {
    const { data, error } = await this.supabase
      .from('sat_sync_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !data) return null
    return this.toDomain(data as Record<string, unknown>)
  }

  async findActiveByCompanyId(companyId: string): Promise<SyncJob | null> {
    const { data, error } = await this.supabase
      .from('sat_sync_jobs')
      .select('*')
      .eq('company_id', companyId)
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return this.toDomain(data as Record<string, unknown>)
  }

  private toDomain(row: Record<string, unknown>): SyncJob {
    return {
      id:            row.id            as string,
      companyId:     row.company_id    as string,
      status:        row.status        as SyncStatus,
      phase:         row.phase         as SyncPhase,
      progressPct:   (row.progress_pct as number) ?? 0,
      cfdisFetched:  (row.cfdis_fetched  as number) ?? 0,
      cfdisUpserted: (row.cfdis_upserted as number) ?? 0,
      startedAt:     row.started_at   as string | null,
      completedAt:   row.completed_at as string | null,
      failedAt:      row.failed_at    as string | null,
      errorMessage:  row.error_message as string | null,
      createdAt:     row.created_at   as string,
    }
  }
}
