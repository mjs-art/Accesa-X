import type { Shareholder } from '../types/onboarding.types'

export interface CreateShareholderInput {
  companyId: string
  esPersonaMoral: boolean
  poseeMas25Porciento: boolean
  porcentajeParticipacion?: number
  nombres?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  curp?: string
  fechaNacimiento?: string
  ocupacion?: string
  telefono?: string
}

export interface IShareholderRepository {
  findByCompanyId(companyId: string): Promise<Shareholder[]>
  create(input: CreateShareholderInput): Promise<Shareholder>
  delete(shareholderId: string): Promise<void>
  deleteByCompanyId(companyId: string): Promise<void>
  countByCompanyId(companyId: string): Promise<number>
}
