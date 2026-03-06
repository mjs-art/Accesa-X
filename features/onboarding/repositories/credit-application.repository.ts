export interface IOnboardingCreditRepository {
  createInitial(companyId: string): Promise<void>
}
