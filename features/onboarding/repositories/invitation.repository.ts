import type { OnboardingInvitation, InvitationType } from '../types/onboarding.types'

export interface CreateInvitationInput {
  companyId: string
  invitationType: InvitationType
  inviteeEmail: string
  inviteeName?: string
  token: string
  expiresAt: string
}

export interface IInvitationRepository {
  findPendingByCompanyId(companyId: string): Promise<OnboardingInvitation[]>
  findByToken(token: string): Promise<OnboardingInvitation | null>
  create(input: CreateInvitationInput): Promise<OnboardingInvitation>
  markAccepted(token: string): Promise<void>
  markExpired(token: string): Promise<void>
}
