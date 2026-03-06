export type CreditType = 'empresarial' | 'factoraje' | 'contrato'

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'en_revision'
  | 'aprobado'
  | 'rechazado'

export interface AdminCompany {
  nombreRazonSocial: string
  rfc: string
}

export interface CreditApplication {
  id: string
  tipoCredito: CreditType
  montoSolicitado: number
  plazoMeses: number
  status: ApplicationStatus
  createdAt: string
  company: AdminCompany | null
}
