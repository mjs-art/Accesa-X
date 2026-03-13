import type { ICompanyRepository } from '../repositories/company.repository'
import type { ILegalRepRepository } from '../repositories/legal-rep.repository'
import type { IShareholderRepository } from '../repositories/shareholder.repository'
import type { IInvitationRepository } from '../repositories/invitation.repository'
import type { IDocumentRepository } from '../repositories/document.repository'
import type { Company, LegalRepresentative, Shareholder, OnboardingStep } from '../types/onboarding.types'
import type { CompanyFormData } from '../schemas/company.schema'
import type { LegalRepFormData } from '../schemas/legal-rep.schema'
import type { ShareholderFormData } from '../schemas/shareholder.schema'

export const REQUIRED_COMPANY_DOC_TYPES = [
  'acta_constitutiva',
  'actas_asamblea',
  'documento_poderes',
  'estado_cuenta_bancario',
] as const

export interface OnboardingSummary {
  company: Company | null
  legalRepComplete: boolean
  shareholderCount: number
  uploadedDocTypes: string[]
  onboardingComplete: boolean
}

export class OnboardingService {
  constructor(
    private readonly companyRepo: ICompanyRepository,
    private readonly legalRepRepo: ILegalRepRepository,
    private readonly shareholderRepo: IShareholderRepository,
    private readonly invitationRepo: IInvitationRepository,
    private readonly documentRepo: IDocumentRepository,
  ) {}

  async getCurrentStep(userId: string): Promise<OnboardingStep> {
    const company = await this.companyRepo.findByUserId(userId)
    return company?.onboardingStep ?? 'empresa'
  }

  async getCompany(userId: string): Promise<Company | null> {
    return this.companyRepo.findByUserId(userId)
  }

  async saveEmpresa(userId: string, data: CompanyFormData): Promise<Company> {
    return this.companyRepo.create({
      userId,
      nombreRazonSocial: data.nombreRazonSocial,
      rfc: data.rfc,
      industria: data.industria,
      tamanoEmpresa: data.tamanoEmpresa,
    })
  }

  async advanceToStep(companyId: string, step: OnboardingStep): Promise<void> {
    await this.companyRepo.updateOnboardingStep(companyId, step)
  }

  async saveLegalRep(companyId: string, data: LegalRepFormData): Promise<LegalRepresentative> {
    const legalRep = await this.legalRepRepo.upsert({
      companyId,
      esElUsuario: data.esElUsuario,
      nombres: data.nombres || undefined,
      apellidoPaterno: data.apellidoPaterno || undefined,
      apellidoMaterno: data.apellidoMaterno || undefined,
      curp: data.curp || undefined,
      rfcPersonal: data.rfcPersonal || undefined,
      email: data.email || undefined,
      telefono: data.telefono || undefined,
      telefonoVerificado: false,
    })
    await this.companyRepo.updateOnboardingStep(companyId, 'legal-rep-docs')
    return legalRep
  }

  async saveShareholders(companyId: string, shareholders: ShareholderFormData[]): Promise<Shareholder[]> {
    if (shareholders.length === 0) {
      throw new Error('SHAREHOLDERS_REQUIRED')
    }
    // Replace strategy: delete all existing then insert fresh
    await this.shareholderRepo.deleteByCompanyId(companyId)
    const saved: Shareholder[] = []
    for (const s of shareholders) {
      const shareholder = await this.shareholderRepo.create({
        companyId,
        esPersonaMoral: s.esPersonaMoral,
        poseeMas25Porciento: s.poseeMas25Porciento,
        porcentajeParticipacion: s.porcentajeParticipacion,
        nombres: s.nombres || undefined,
        apellidoPaterno: s.apellidoPaterno || undefined,
        apellidoMaterno: s.apellidoMaterno || undefined,
        curp: s.curp || undefined,
        fechaNacimiento: s.fechaNacimiento || undefined,
        ocupacion: s.ocupacion || undefined,
        telefono: s.telefono || undefined,
      })
      saved.push(shareholder)
    }
    await this.companyRepo.updateOnboardingStep(companyId, 'company-docs')
    return saved
  }

  async completeOnboarding(companyId: string): Promise<void> {
    await this.companyRepo.markOnboardingComplete(companyId)
  }

  async getSummary(userId: string): Promise<OnboardingSummary> {
    const company = await this.companyRepo.findByUserId(userId)
    if (!company) {
      return { company: null, legalRepComplete: false, shareholderCount: 0, uploadedDocTypes: [], onboardingComplete: false }
    }
    const [legalRep, shareholderCount, companyDocs] = await Promise.all([
      this.legalRepRepo.findByCompanyId(company.id),
      this.shareholderRepo.countByCompanyId(company.id),
      this.documentRepo.getCompanyDocs(company.id),
    ])
    const legalRepComplete = !!(
      legalRep &&
      legalRep.nombres?.trim() &&
      legalRep.apellidoPaterno?.trim() &&
      legalRep.curp?.trim() &&
      legalRep.rfcPersonal?.trim() &&
      legalRep.email?.trim()
    )
    return {
      company,
      legalRepComplete,
      shareholderCount,
      uploadedDocTypes: companyDocs.map((d) => d.documentType),
      onboardingComplete: company.onboardingStep === 'completed',
    }
  }

  async getPendingInvitations(companyId: string) {
    return this.invitationRepo.findPendingByCompanyId(companyId)
  }
}
