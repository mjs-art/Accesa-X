export type CreditType = 'proyecto' | 'factoraje'

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'en_revision'
  | 'docs_pendientes'
  | 'aprobado'
  | 'fondos_liberados'
  | 'en_ejecucion'
  | 'liquidado'
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

export interface AnalysisResult {
  resumen: string
  monto_total: number
  moneda: string
  fecha_inicio: string | null
  fecha_fin: string | null
  fechas_pago: string[]
  entregables: string[]
  riesgos: { descripcion: string; nivel: 'alto' | 'medio' | 'bajo' }[]
  cliente_nombre: string
  viabilidad_score: number
  viabilidad_razon: string
}

export interface ApplicationContract {
  storagePath: string
  montoContrato: number | null
  analysisResult: AnalysisResult | null
}

export interface ApplicationCompanyDetail {
  id: string
  nombreRazonSocial: string
  rfc: string
  industria: string | null
  tamanoEmpresa: string | null
  estatusSat: string | null
}

export interface ApplicationDetail {
  id: string
  tipoCredito: string
  montoSolicitado: number
  plazoMeses: number
  destino: string
  status: string
  createdAt: string
  resolvedAt: string | null
  clientRfc: string | null
  clientName: string | null
  projectName: string | null
  notificacionDeudor: boolean
  porcentajeAnticipo: number | null
  analystNotes: string | null
  company: ApplicationCompanyDetail | null
  contract: ApplicationContract | null
}

export interface InternalNote {
  id: string
  note: string
  authorEmail: string
  createdAt: string
}

export interface AdminCreditApp {
  id: string
  tipoCredito: string
  montoSolicitado: number
  status: string
}

export interface AdminCompanyWithApps {
  id: string
  nombreRazonSocial: string
  rfc: string
  industria: string | null
  tamanoEmpresa: string | null
  estatusSat: string | null
  createdAt: string
  creditApplications: AdminCreditApp[]
}

export interface AddNoteInput {
  creditApplicationId: string
  adminId: string
  authorEmail: string
  note: string
}
