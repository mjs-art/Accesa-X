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

export interface UpsertLegalRepFromInvitationInput {
  nombres?: string | null
  apellidoPaterno?: string | null
  apellidoMaterno?: string | null
  curp?: string | null
  rfcPersonal?: string | null
  email?: string | null
  telefono?: string | null
}

export interface ILegalRepRepository {
  findByCompanyId(companyId: string): Promise<LegalRepresentative | null>
  create(input: CreateLegalRepInput): Promise<LegalRepresentative>
  upsert(input: CreateLegalRepInput): Promise<LegalRepresentative>
  updateTelefonoVerificado(legalRepId: string, verified: boolean): Promise<void>
  upsertFromInvitation(companyId: string, input: UpsertLegalRepFromInvitationInput): Promise<void>
}
