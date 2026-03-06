import type { SupabaseClient } from '@supabase/supabase-js'
import type { IShareholderRepository, CreateShareholderInput } from './shareholder.repository'
import type { Shareholder } from '../types/onboarding.types'

export class SupabaseShareholderRepository implements IShareholderRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByCompanyId(companyId: string): Promise<Shareholder[]> {
    const { data, error } = await this.supabase
      .from('shareholders')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (error || !data) return []
    return (data as Record<string, unknown>[]).map((row) => this.toDomain(row))
  }

  async create(input: CreateShareholderInput): Promise<Shareholder> {
    const { data, error } = await this.supabase
      .from('shareholders')
      .insert({
        company_id: input.companyId,
        es_persona_moral: input.esPersonaMoral,
        posee_mas_25_porciento: input.poseeMas25Porciento,
        porcentaje_participacion: input.porcentajeParticipacion ?? null,
        nombres: input.nombres ?? null,
        apellido_paterno: input.apellidoPaterno ?? null,
        apellido_materno: input.apellidoMaterno ?? null,
        curp: input.curp ?? null,
        fecha_nacimiento: input.fechaNacimiento ?? null,
        ocupacion: input.ocupacion ?? null,
        telefono: input.telefono ? `+52${input.telefono}` : null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return this.toDomain(data as Record<string, unknown>)
  }

  async delete(shareholderId: string): Promise<void> {
    const { error } = await this.supabase
      .from('shareholders')
      .delete()
      .eq('id', shareholderId)

    if (error) throw new Error(error.message)
  }

  async deleteByCompanyId(companyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('shareholders')
      .delete()
      .eq('company_id', companyId)

    if (error) throw new Error(error.message)
  }

  async countByCompanyId(companyId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('shareholders')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    if (error) return 0
    return count ?? 0
  }

  private toDomain(row: Record<string, unknown>): Shareholder {
    return {
      id: row.id as string,
      companyId: row.company_id as string,
      esPersonaMoral: row.es_persona_moral as boolean,
      poseeMas25Porciento: row.posee_mas_25_porciento as boolean,
      porcentajeParticipacion: row.porcentaje_participacion as number | null,
      nombres: row.nombres as string | null,
      apellidoPaterno: row.apellido_paterno as string | null,
      apellidoMaterno: row.apellido_materno as string | null,
      curp: row.curp as string | null,
      fechaNacimiento: row.fecha_nacimiento as string | null,
      ocupacion: row.ocupacion as string | null,
      telefono: row.telefono as string | null,
      createdAt: row.created_at as string,
    }
  }
}
