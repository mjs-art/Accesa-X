export type OnboardingStep =
  | 'empresa'
  | 'verificacion-fiscal'
  | 'legal-rep'
  | 'legal-rep-docs'
  | 'shareholders'
  | 'company-docs'
  | 'confirmation'
  | 'completed'

export type DocumentStatus = 'uploaded' | 'validating' | 'approved' | 'rejected'

export interface Company {
  id: string
  userId: string
  nombreRazonSocial: string
  rfc: string
  industria: string
  tamanoEmpresa: string
  syntageValidatedAt: string | null
  onboardingStep: OnboardingStep
  onboardingCompleted: boolean
  onboardingCompletedAt: string | null
  createdAt: string
}

export interface LegalRepresentative {
  id: string
  companyId: string
  esElUsuario: boolean
  nombres: string | null
  apellidoPaterno: string | null
  apellidoMaterno: string | null
  curp: string | null
  rfcPersonal: string | null
  email: string | null
  telefono: string | null
  telefonoVerificado: boolean
  createdAt: string
}

export interface LegalRepDocument {
  id: string
  legalRepId: string
  companyId: string
  documentType: 'id_oficial' | 'comprobante_domicilio'
  fileUrl: string | null
  storagePath: string | null
  status: DocumentStatus
  createdAt: string
}

export interface Shareholder {
  id: string
  companyId: string
  esPersonaMoral: boolean
  poseeMas25Porciento: boolean
  porcentajeParticipacion: number | null
  nombres: string | null
  apellidoPaterno: string | null
  apellidoMaterno: string | null
  curp: string | null
  fechaNacimiento: string | null
  ocupacion: string | null
  telefono: string | null
  createdAt: string
}

export interface ShareholderDocument {
  id: string
  shareholderId: string
  companyId: string
  documentType: 'id_oficial' | 'comprobante_domicilio'
  fileUrl: string | null
  storagePath: string | null
  status: DocumentStatus
  createdAt: string
}

export type CompanyDocumentType =
  | 'acta_constitutiva'
  | 'actas_asamblea'
  | 'documento_poderes'
  | 'estado_cuenta_bancario'
  | 'documento_adicional'

export interface CompanyDocument {
  id: string
  companyId: string
  documentType: CompanyDocumentType
  fileUrl: string | null
  storagePath: string | null
  status: DocumentStatus
  createdAt: string
}

export type InvitationType = 'legal_rep' | 'shareholder'
export type InvitationStatus = 'pending' | 'accepted' | 'expired'

export interface OnboardingInvitation {
  id: string
  companyId: string
  invitationType: InvitationType
  inviteeEmail: string
  inviteeName: string | null
  token: string
  expiresAt: string
  acceptedAt: string | null
  status: InvitationStatus
  createdAt: string
}
