import type {
  LegalRepDocument,
  ShareholderDocument,
  CompanyDocument,
  CompanyDocumentType,
} from '../types/onboarding.types'

export interface CreateLegalRepDocInput {
  legalRepId: string
  companyId: string
  documentType: 'id_oficial' | 'comprobante_domicilio'
  fileUrl: string
  storagePath: string
}

export interface CreateShareholderDocInput {
  shareholderId: string
  companyId: string
  documentType: 'id_oficial' | 'comprobante_domicilio'
  fileUrl: string
  storagePath: string
}

export interface CreateCompanyDocInput {
  companyId: string
  documentType: CompanyDocumentType
  fileUrl: string
  storagePath: string
}

export interface IDocumentRepository {
  createLegalRepDoc(input: CreateLegalRepDocInput): Promise<LegalRepDocument>
  createShareholderDoc(input: CreateShareholderDocInput): Promise<ShareholderDocument>
  createCompanyDoc(input: CreateCompanyDocInput): Promise<CompanyDocument>
  getCompanyDocs(companyId: string): Promise<CompanyDocument[]>
  countCompanyDocs(companyId: string): Promise<number>
}
