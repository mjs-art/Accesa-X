import type { SupabaseClient } from '@supabase/supabase-js'
import type { IDashboardRepository, DashboardResult } from './dashboard.repository'
import type { DashboardCompany } from '../types/dashboard.types'

export class SupabaseDashboardRepository implements IDashboardRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getCompany(userId: string): Promise<DashboardCompany | null> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('id, nombre_razon_social, rfc, syntage_validated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    const row = data as Record<string, unknown>
    return {
      id: row.id as string,
      nombreRazonSocial: row.nombre_razon_social as string,
      rfc: row.rfc as string,
      syntageValidatedAt: row.syntage_validated_at as string | null,
    }
  }

  async getDashboardData(): Promise<DashboardResult> {
    const { data, error } = await this.supabase.functions.invoke('get-dashboard-data')

    if (error || !data?.verified) {
      return { verified: false, resumen: null, clientes: [] }
    }

    return {
      verified: true,
      resumen: data.resumen ?? null,
      clientes: data.clientes ?? [],
    }
  }

  async syncSatData(): Promise<void> {
    const { error } = await this.supabase.functions.invoke('sync-sat-data')
    if (error) throw new Error('SYNC_FAILED')
  }
}
