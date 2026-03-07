import type { SupabaseClient } from '@supabase/supabase-js'
import type { IOnboardingCreditRepository } from './credit-application.repository'

export class SupabaseCreditApplicationRepository implements IOnboardingCreditRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createInitial(companyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('credit_applications')
      .insert({
        company_id: companyId,
        tipo_credito: 'empresarial',
        status: 'submitted',
        monto_solicitado: 0,
      })

    if (error) throw new Error(error.message)
  }
}
