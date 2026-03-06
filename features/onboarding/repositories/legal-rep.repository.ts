import type { LegalRepresentative } from '../types/onboarding.types'

export interface CreateLegalRepInput {
  companyId: string
  esElUsuario: boolean
  nombres?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  curp?: string
  rfcPersonal?: string
  email?: string
  telefono?: string
  telefonoVerificado?: boolean
}

export interface ILegalRepRepository {
  findByCompanyId(companyId: string): Promise<LegalRepresentative | null>
  create(input: CreateLegalRepInput): Promise<LegalRepresentative>
  updateTelefonoVerificado(legalRepId: string, verified: boolean): Promise<void>
}
