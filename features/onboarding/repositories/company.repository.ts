import type { Company, OnboardingStep } from '../types/onboarding.types'

export interface CreateCompanyInput {
  userId: string
  nombreRazonSocial: string
  rfc: string
  industria: string
  tamanoEmpresa: string
}

export interface ICompanyRepository {
  findByUserId(userId: string): Promise<Company | null>
  create(input: CreateCompanyInput): Promise<Company>
  updateOnboardingStep(companyId: string, step: OnboardingStep): Promise<void>
  markOnboardingComplete(companyId: string): Promise<void>
}
