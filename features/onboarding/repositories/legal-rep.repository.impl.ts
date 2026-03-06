import type { SupabaseClient } from '@supabase/supabase-js'
import type { ILegalRepRepository, CreateLegalRepInput, UpsertLegalRepFromInvitationInput } from './legal-rep.repository'
import type { LegalRepresentative } from '../types/onboarding.types'

export class SupabaseLegalRepRepository implements ILegalRepRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByCompanyId(companyId: string): Promise<LegalRepresentative | null> {
    const { data, error } = await this.supabase
      .from('legal_representatives')
      .select('*')
      .eq('company_id', companyId)
      .limit(1)
      .single()

    if (error || !data) return null
    return this.toDomain(data as Record<string, unknown>)
  }

  async create(input: CreateLegalRepInput): Promise<LegalRepresentative> {
    const { data, error } = await this.supabase
      .from('legal_representatives')
      .insert({
        company_id: input.companyId,
        es_el_usuario: input.esElUsuario,
        nombres: input.nombres ?? null,
        apellido_paterno: input.apellidoPaterno ?? null,
        apellido_materno: input.apellidoMaterno ?? null,
        curp: input.curp ?? null,
        rfc_personal: input.rfcPersonal ?? null,
        email: input.email ?? null,
        telefono: input.telefono ? `+52${input.telefono}` : null,
        telefono_verificado: input.telefonoVerificado ?? false,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return this.toDomain(data as Record<string, unknown>)
  }

  async upsert(input: CreateLegalRepInput): Promise<LegalRepresentative> {
    const { data: existing } = await this.supabase
      .from('legal_representatives')
      .select('id')
      .eq('company_id', input.companyId)
      .limit(1)
      .single()

    const fields = {
      es_el_usuario: input.esElUsuario,
      nombres: input.nombres ?? null,
      apellido_paterno: input.apellidoPaterno ?? null,
      apellido_materno: input.apellidoMaterno ?? null,
      curp: input.curp ?? null,
      rfc_personal: input.rfcPersonal ?? null,
      email: input.email ?? null,
      telefono: input.telefono ? `+52${input.telefono}` : null,
      telefono_verificado: input.telefonoVerificado ?? false,
    }

    if (existing) {
      const { data, error } = await this.supabase
        .from('legal_representatives')
        .update(fields)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return this.toDomain(data as Record<string, unknown>)
    } else {
      const { data, error } = await this.supabase
        .from('legal_representatives')
        .insert({ company_id: input.companyId, ...fields })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return this.toDomain(data as Record<string, unknown>)
    }
  }

  async updateTelefonoVerificado(legalRepId: string, verified: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('legal_representatives')
      .update({ telefono_verificado: verified })
      .eq('id', legalRepId)

    if (error) throw new Error(error.message)
  }

  async upsertFromInvitation(companyId: string, input: UpsertLegalRepFromInvitationInput): Promise<void> {
    const { data: existing } = await this.supabase
      .from('legal_representatives')
      .select('id')
      .eq('company_id', companyId)
      .eq('es_el_usuario', false)
      .single()

    const fields = {
      nombres: input.nombres ?? null,
      apellido_paterno: input.apellidoPaterno ?? null,
      apellido_materno: input.apellidoMaterno ?? null,
      curp: input.curp ?? null,
      rfc_personal: input.rfcPersonal ?? null,
      email: input.email ?? null,
      telefono: input.telefono ? `+52${input.telefono}` : null,
    }

    if (existing) {
      const { error } = await this.supabase
        .from('legal_representatives')
        .update(fields)
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await this.supabase
        .from('legal_representatives')
        .insert({ company_id: companyId, es_el_usuario: false, telefono_verificado: false, ...fields })
      if (error) throw new Error(error.message)
    }
  }

  private toDomain(row: Record<string, unknown>): LegalRepresentative {
    return {
      id: row.id as string,
      companyId: row.company_id as string,
      esElUsuario: row.es_el_usuario as boolean,
      nombres: row.nombres as string | null,
      apellidoPaterno: row.apellido_paterno as string | null,
      apellidoMaterno: row.apellido_materno as string | null,
      curp: row.curp as string | null,
      rfcPersonal: row.rfc_personal as string | null,
      email: row.email as string | null,
      telefono: row.telefono as string | null,
      telefonoVerificado: (row.telefono_verificado as boolean) ?? false,
      createdAt: row.created_at as string,
    }
  }
}
