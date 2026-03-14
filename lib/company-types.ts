export const ACTIVE_COMPANY_COOKIE = 'active_company_id'

export interface AccessibleCompany {
  id: string
  name: string
  rfc: string
  role: 'owner' | 'admin' | 'viewer'
}
