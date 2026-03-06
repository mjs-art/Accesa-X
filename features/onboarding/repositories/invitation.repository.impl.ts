import type { SupabaseClient } from '@supabase/supabase-js'
import type { IInvitationRepository, CreateInvitationInput } from './invitation.repository'
import type { OnboardingInvitation, InvitationType, InvitationStatus } from '../types/onboarding.types'

export class SupabaseInvitationRepository implements IInvitationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findPendingByCompanyId(companyId: string): Promise<OnboardingInvitation[]> {
    const { data, error } = await this.supabase
      .from('onboarding_invitations')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return (data as Record<string, unknown>[]).map((row) => this.toDomain(row))
  }

  async create(input: CreateInvitationInput): Promise<OnboardingInvitation> {
    const { data, error } = await this.supabase
      .from('onboarding_invitations')
      .insert({
        company_id: input.companyId,
        invitation_type: input.invitationType,
        invitee_email: input.inviteeEmail,
        invitee_name: input.inviteeName ?? null,
        token: input.token,
        expires_at: input.expiresAt,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return this.toDomain(data as Record<string, unknown>)
  }

  async findByToken(token: string): Promise<OnboardingInvitation | null> {
    const { data, error } = await this.supabase
      .from('onboarding_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !data) return null
    return this.toDomain(data as Record<string, unknown>)
  }

  async markAccepted(token: string): Promise<void> {
    const { error } = await this.supabase
      .from('onboarding_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('token', token)

    if (error) throw new Error(error.message)
  }

  async markExpired(token: string): Promise<void> {
    const { error } = await this.supabase
      .from('onboarding_invitations')
      .update({ status: 'expired' })
      .eq('token', token)

    if (error) throw new Error(error.message)
  }

  private toDomain(row: Record<string, unknown>): OnboardingInvitation {
    return {
      id: row.id as string,
      companyId: row.company_id as string,
      invitationType: row.invitation_type as InvitationType,
      inviteeEmail: row.invitee_email as string,
      inviteeName: row.invitee_name as string | null,
      token: row.token as string,
      expiresAt: row.expires_at as string,
      acceptedAt: row.accepted_at as string | null,
      status: row.status as InvitationStatus,
      createdAt: row.created_at as string,
    }
  }
}
