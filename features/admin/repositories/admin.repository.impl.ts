import type { SupabaseClient } from '@supabase/supabase-js'
import type { IAdminRepository } from './admin.repository'
import type { CreditApplication, CreditType, ApplicationStatus } from '../types/admin.types'

export class SupabaseAdminRepository implements IAdminRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getApplications(): Promise<CreditApplication[]> {
    const { data, error } = await this.supabase
      .from('credit_applications')
      .select(
        'id, tipo_credito, monto_solicitado, plazo_meses, status, created_at, companies(nombre_razon_social, rfc)'
      )
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return (data as Record<string, unknown>[]).map((row) => this.toDomain(row))
  }

  async getApplicationById(id: string): Promise<CreditApplication | null> {
    const { data, error } = await this.supabase
      .from('credit_applications')
      .select(
        'id, tipo_credito, monto_solicitado, plazo_meses, status, created_at, companies(nombre_razon_social, rfc)'
      )
      .eq('id', id)
      .single()

    if (error || !data) return null
    return this.toDomain(data as Record<string, unknown>)
  }

  async updateStatus(id: string, status: ApplicationStatus): Promise<void> {
    const { error } = await this.supabase
      .from('credit_applications')
      .update({ status })
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  private toDomain(row: Record<string, unknown>): CreditApplication {
    const companies = row.companies as Record<string, unknown> | null
    return {
      id: row.id as string,
      tipoCredito: row.tipo_credito as CreditType,
      montoSolicitado: row.monto_solicitado as number,
      plazoMeses: row.plazo_meses as number,
      status: row.status as ApplicationStatus,
      createdAt: row.created_at as string,
      company: companies
        ? {
            nombreRazonSocial: companies.nombre_razon_social as string,
            rfc: companies.rfc as string,
          }
        : null,
    }
  }
}
