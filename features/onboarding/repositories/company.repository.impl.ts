import type { SupabaseClient } from '@supabase/supabase-js'
import type { ICompanyRepository, CreateCompanyInput } from './company.repository'
import type { Company, OnboardingStep } from '../types/onboarding.types'

export class SupabaseCompanyRepository implements ICompanyRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByUserId(userId: string): Promise<Company | null> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return this.toDomain(data as Record<string, unknown>)
  }

  async create(input: CreateCompanyInput): Promise<Company> {
    const { data, error } = await this.supabase
      .from('companies')
      .insert({
        user_id: input.userId,
        nombre_razon_social: input.nombreRazonSocial.trim(),
        rfc: input.rfc.toUpperCase().trim(),
        industria: input.industria,
        tamano_empresa: input.tamanoEmpresa,
        onboarding_step: 'verificacion-fiscal',
        onboarding_completed: false,
      })
      .select()
      .single()

    if (error) {
      throw new Error(error.code === '23505' ? 'RFC_DUPLICATE' : error.message)
    }
    return this.toDomain(data as Record<string, unknown>)
  }

  async updateOnboardingStep(companyId: string, step: OnboardingStep): Promise<void> {
    const { error } = await this.supabase
      .from('companies')
      .update({ onboarding_step: step })
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  }

  async markOnboardingComplete(companyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('companies')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 'completed' as OnboardingStep,
      })
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  }

  private toDomain(row: Record<string, unknown>): Company {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      nombreRazonSocial: row.nombre_razon_social as string,
      rfc: row.rfc as string,
      industria: row.industria as string,
      tamanoEmpresa: row.tamano_empresa as string,
      syntageValidatedAt: row.syntage_validated_at as string | null,
      onboardingStep: ((row.onboarding_step as OnboardingStep) ?? 'empresa'),
      onboardingCompleted: (row.onboarding_completed as boolean) ?? false,
      onboardingCompletedAt: row.onboarding_completed_at as string | null,
      createdAt: row.created_at as string,
    }
  }
}
