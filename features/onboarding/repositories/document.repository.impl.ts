import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  IDocumentRepository,
  CreateLegalRepDocInput,
  CreateShareholderDocInput,
  CreateCompanyDocInput,
} from './document.repository'
import type {
  LegalRepDocument,
  ShareholderDocument,
  CompanyDocument,
  DocumentStatus,
} from '../types/onboarding.types'

export class SupabaseDocumentRepository implements IDocumentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createLegalRepDoc(input: CreateLegalRepDocInput): Promise<LegalRepDocument> {
    const { data, error } = await this.supabase
      .from('legal_rep_documents')
      .insert({
        legal_rep_id: input.legalRepId,
        company_id: input.companyId,
        document_type: input.documentType,
        file_url: input.fileUrl,
        storage_path: input.storagePath,
        status: 'uploaded',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return this.toLegalRepDocDomain(data as Record<string, unknown>)
  }

  async createShareholderDoc(input: CreateShareholderDocInput): Promise<ShareholderDocument> {
    const { data, error } = await this.supabase
      .from('shareholder_documents')
      .insert({
        shareholder_id: input.shareholderId,
        company_id: input.companyId,
        document_type: input.documentType,
        file_url: input.fileUrl,
        storage_path: input.storagePath,
        status: 'uploaded',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return this.toShareholderDocDomain(data as Record<string, unknown>)
  }

  async createCompanyDoc(input: CreateCompanyDocInput): Promise<CompanyDocument> {
    const { data, error } = await this.supabase
      .from('company_documents')
      .insert({
        company_id: input.companyId,
        document_type: input.documentType,
        file_url: input.fileUrl,
        storage_path: input.storagePath,
        status: 'uploaded',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return this.toCompanyDocDomain(data as Record<string, unknown>)
  }

  async upsertCompanyDoc(input: CreateCompanyDocInput): Promise<CompanyDocument> {
    const { data: existing } = await this.supabase
      .from('company_documents')
      .select('id')
      .eq('company_id', input.companyId)
      .eq('document_type', input.documentType)
      .limit(1)
      .single()

    const fields = {
      file_url: input.fileUrl,
      storage_path: input.storagePath,
      status: 'uploaded',
    }

    if (existing) {
      const { data, error } = await this.supabase
        .from('company_documents')
        .update(fields)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return this.toCompanyDocDomain(data as Record<string, unknown>)
    } else {
      const { data, error } = await this.supabase
        .from('company_documents')
        .insert({ company_id: input.companyId, document_type: input.documentType, ...fields })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return this.toCompanyDocDomain(data as Record<string, unknown>)
    }
  }

  async getCompanyDocs(companyId: string): Promise<CompanyDocument[]> {
    const { data, error } = await this.supabase
      .from('company_documents')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (error || !data) return []
    return (data as Record<string, unknown>[]).map((row) => this.toCompanyDocDomain(row))
  }

  async countCompanyDocs(companyId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('company_documents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    if (error) return 0
    return count ?? 0
  }

  private toLegalRepDocDomain(row: Record<string, unknown>): LegalRepDocument {
    return {
      id: row.id as string,
      legalRepId: row.legal_rep_id as string,
      companyId: row.company_id as string,
      documentType: row.document_type as 'id_oficial' | 'comprobante_domicilio',
      fileUrl: row.file_url as string | null,
      storagePath: row.storage_path as string | null,
      status: row.status as DocumentStatus,
      createdAt: row.created_at as string,
    }
  }

  private toShareholderDocDomain(row: Record<string, unknown>): ShareholderDocument {
    return {
      id: row.id as string,
      shareholderId: row.shareholder_id as string,
      companyId: row.company_id as string,
      documentType: row.document_type as 'id_oficial' | 'comprobante_domicilio',
      fileUrl: row.file_url as string | null,
      storagePath: row.storage_path as string | null,
      status: row.status as DocumentStatus,
      createdAt: row.created_at as string,
    }
  }

  private toCompanyDocDomain(row: Record<string, unknown>): CompanyDocument {
    return {
      id: row.id as string,
      companyId: row.company_id as string,
      documentType: row.document_type as CompanyDocument['documentType'],
      fileUrl: row.file_url as string | null,
      storagePath: row.storage_path as string | null,
      status: row.status as DocumentStatus,
      createdAt: row.created_at as string,
    }
  }
}
