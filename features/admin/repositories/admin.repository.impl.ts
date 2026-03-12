import type { SupabaseClient } from '@supabase/supabase-js'
import type { IAdminRepository } from './admin.repository'
import type {
  CreditApplication,
  CreditType,
  ApplicationStatus,
  ApplicationDetail,
  ApplicationCompanyDetail,
  ApplicationContract,
  AnalysisResult,
  OrdenCompraAnalysis,
  InternalNote,
  AddNoteInput,
  AdminCompanyWithApps,
  AdminCreditApp,
} from '../types/admin.types'

export class SupabaseAdminRepository implements IAdminRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getApplications(): Promise<CreditApplication[]> {
    const { data, error } = await this.supabase
      .from('credit_applications')
      .select(
        'id, tipo_credito, monto_solicitado, plazo_meses, status, created_at, companies(nombre_razon_social, rfc)'
      )
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return (data as Record<string, unknown>[]).map((row) => this.toDomain(row))
  }

  async getApplicationById(id: string): Promise<CreditApplication | null> {
    const { data, error } = await this.supabase
      .from('credit_applications')
      .select(
        'id, tipo_credito, monto_solicitado, plazo_meses, status, created_at, companies(nombre_razon_social, rfc)'
      )
      .eq('id', id)
      .single()

    if (error || !data) return null
    return this.toDomain(data as Record<string, unknown>)
  }

  async updateStatus(id: string, status: ApplicationStatus): Promise<void> {
    const { error } = await this.supabase
      .from('credit_applications')
      .update({ status })
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  async getApplicationWithDetails(id: string): Promise<ApplicationDetail | null> {
    const { data, error } = await this.supabase
      .from('credit_applications')
      .select(`
        id, tipo_credito, monto_solicitado, plazo_meses, destino, status, created_at,
        resolved_at, client_rfc, client_name, project_name,
        notificacion_deudor, porcentaje_anticipo, analyst_notes, orden_compra_analysis,
        companies ( id, nombre_razon_social, rfc, industria, tamano_empresa, estatus_sat ),
        contracts:contract_id ( storage_path, monto_contrato, analysis_result )
      `)
      .eq('id', id)
      .single()

    if (error || !data) return null
    return this.toDetailDomain(data as Record<string, unknown>)
  }

  async addNote(input: AddNoteInput): Promise<void> {
    const { error } = await this.supabase.from('internal_notes').insert({
      credit_application_id: input.creditApplicationId,
      admin_id: input.adminId,
      author_email: input.authorEmail,
      note: input.note,
    })
    if (error) throw new Error(error.message)
  }

  async getNotesByApplicationId(applicationId: string): Promise<InternalNote[]> {
    const { data, error } = await this.supabase
      .from('internal_notes')
      .select('id, note, author_email, created_at')
      .eq('credit_application_id', applicationId)
      .order('created_at', { ascending: true })

    if (error || !data) return []
    return (data as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      note: row.note as string,
      authorEmail: row.author_email as string,
      createdAt: row.created_at as string,
    }))
  }

  async getAdminCompanies(): Promise<AdminCompanyWithApps[]> {
    const { data, error } = await this.supabase
      .from('companies')
      .select(`
        id, nombre_razon_social, rfc, industria, tamano_empresa, estatus_sat, created_at,
        credit_applications ( id, tipo_credito, monto_solicitado, status )
      `)
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return (data as Record<string, unknown>[]).map((row) => {
      const apps = (row.credit_applications as Record<string, unknown>[] | null) ?? []
      return {
        id: row.id as string,
        nombreRazonSocial: row.nombre_razon_social as string,
        rfc: row.rfc as string,
        industria: row.industria as string | null,
        tamanoEmpresa: row.tamano_empresa as string | null,
        estatusSat: row.estatus_sat as string | null,
        createdAt: row.created_at as string,
        creditApplications: apps.map((a): AdminCreditApp => ({
          id: a.id as string,
          tipoCredito: a.tipo_credito as string,
          montoSolicitado: a.monto_solicitado as number,
          status: a.status as string,
        })),
      }
    })
  }

  async getSignedDownloadUrl(storagePath: string): Promise<string | null> {
    const { data } = await this.supabase.storage
      .from('contracts')
      .createSignedUrl(storagePath, 120)
    return data?.signedUrl ?? null
  }

  private toDomain(row: Record<string, unknown>): CreditApplication {
    const companies = row.companies as Record<string, unknown> | null
    return {
      id: row.id as string,
      tipoCredito: row.tipo_credito as CreditType,
      montoSolicitado: row.monto_solicitado as number,
      plazoMeses: row.plazo_meses as number,
      status: row.status as ApplicationStatus,
      createdAt: row.created_at as string,
      company: companies
        ? {
            nombreRazonSocial: companies.nombre_razon_social as string,
            rfc: companies.rfc as string,
          }
        : null,
    }
  }

  private toDetailDomain(row: Record<string, unknown>): ApplicationDetail {
    const c = row.companies as Record<string, unknown> | null
    const ct = row.contracts as Record<string, unknown> | null

    const company: ApplicationCompanyDetail | null = c
      ? {
          id: c.id as string,
          nombreRazonSocial: c.nombre_razon_social as string,
          rfc: c.rfc as string,
          industria: c.industria as string | null,
          tamanoEmpresa: c.tamano_empresa as string | null,
          estatusSat: c.estatus_sat as string | null,
        }
      : null

    const contract: ApplicationContract | null = ct
      ? {
          storagePath: ct.storage_path as string,
          montoContrato: ct.monto_contrato as number | null,
          analysisResult: ct.analysis_result as AnalysisResult | null,
        }
      : null

    return {
      id: row.id as string,
      tipoCredito: row.tipo_credito as string,
      montoSolicitado: row.monto_solicitado as number,
      plazoMeses: row.plazo_meses as number,
      destino: row.destino as string,
      status: row.status as string,
      createdAt: row.created_at as string,
      resolvedAt: row.resolved_at as string | null,
      clientRfc: row.client_rfc as string | null,
      clientName: row.client_name as string | null,
      projectName: row.project_name as string | null,
      notificacionDeudor: (row.notificacion_deudor as boolean) ?? false,
      porcentajeAnticipo: row.porcentaje_anticipo as number | null,
      analystNotes: row.analyst_notes as string | null,
      company,
      contract,
      ordenCompraAnalysis: (row.orden_compra_analysis as OrdenCompraAnalysis | null) ?? null,
    }
  }
}
