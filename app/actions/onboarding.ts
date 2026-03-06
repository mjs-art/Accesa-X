'use server'

import { createClient } from '@/lib/supabase/server'
import { companySchema } from '@/features/onboarding/schemas/company.schema'
import { legalRepSchema } from '@/features/onboarding/schemas/legal-rep.schema'
import { shareholderSchema } from '@/features/onboarding/schemas/shareholder.schema'
import { OnboardingService } from '@/features/onboarding/services/onboarding.service'
import { SupabaseCompanyRepository } from '@/features/onboarding/repositories/company.repository.impl'
import { SupabaseLegalRepRepository } from '@/features/onboarding/repositories/legal-rep.repository.impl'
import { SupabaseShareholderRepository } from '@/features/onboarding/repositories/shareholder.repository.impl'
import { SupabaseInvitationRepository } from '@/features/onboarding/repositories/invitation.repository.impl'
import { SupabaseDocumentRepository } from '@/features/onboarding/repositories/document.repository.impl'
import type { OnboardingStep, CompanyDocumentType } from '@/features/onboarding/types/onboarding.types'
import type { ShareholderFormData } from '@/features/onboarding/schemas/shareholder.schema'

function buildService(supabase: Awaited<ReturnType<typeof createClient>>) {
  return new OnboardingService(
    new SupabaseCompanyRepository(supabase),
    new SupabaseLegalRepRepository(supabase),
    new SupabaseShareholderRepository(supabase),
    new SupabaseInvitationRepository(supabase),
  )
}

export async function saveEmpresaAction(formData: unknown) {
  const parsed = companySchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const service = buildService(supabase)
    const company = await service.saveEmpresa(user.id, parsed.data)
    return { success: true, company }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    if (msg === 'RFC_DUPLICATE') {
      return { error: 'Ya existe una empresa registrada con ese RFC.' }
    }
    return { error: 'Error al guardar. Intenta de nuevo.' }
  }
}

export async function saveLegalRepAction(companyId: string, formData: unknown) {
  const parsed = legalRepSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const service = buildService(supabase)
    const legalRep = await service.saveLegalRep(companyId, parsed.data)
    return { success: true, legalRep }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return { error: msg }
  }
}

export async function getLegalRepAction(companyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const repo = new SupabaseLegalRepRepository(supabase)
  const legalRep = await repo.findByCompanyId(companyId)
  return { success: true, legalRep }
}

export async function saveLegalRepDocAction(
  legalRepId: string,
  companyId: string,
  documentType: 'id_oficial' | 'comprobante_domicilio',
  fileUrl: string,
  storagePath: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const repo = new SupabaseDocumentRepository(supabase)
    const doc = await repo.createLegalRepDoc({ legalRepId, companyId, documentType, fileUrl, storagePath })
    return { success: true, doc }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al guardar documento' }
  }
}

export async function saveCompanyDocAction(
  companyId: string,
  documentType: CompanyDocumentType,
  fileUrl: string,
  storagePath: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const repo = new SupabaseDocumentRepository(supabase)
    const doc = await repo.createCompanyDoc({ companyId, documentType, fileUrl, storagePath })
    return { success: true, doc }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al guardar documento' }
  }
}

export async function saveShareholdersAction(companyId: string, shareholders: unknown[]) {
  const parsed = shareholders.map((s) => shareholderSchema.safeParse(s))
  const errors = parsed.filter((r) => !r.success)
  if (errors.length > 0) {
    return { error: 'Datos de accionistas inválidos' }
  }

  const validData = parsed.map((r) => (r as { success: true; data: ShareholderFormData }).data)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const service = buildService(supabase)
    const saved = await service.saveShareholders(companyId, validData)
    return { success: true, shareholders: saved }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    if (msg === 'SHAREHOLDERS_REQUIRED') {
      return { error: 'Debes agregar al menos un accionista.' }
    }
    return { error: msg }
  }
}

export async function advanceToStepAction(companyId: string, step: OnboardingStep) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const service = buildService(supabase)
    await service.advanceToStep(companyId, step)
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function completeOnboardingAction(companyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const service = buildService(supabase)
    await service.completeOnboarding(companyId)

    // Crear credit_application
    await supabase.from('credit_applications').insert({
      company_id: companyId,
      tipo_credito: 'empresarial',
      status: 'submitted',
    })

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function getShareholdersAction(companyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const repo = new SupabaseShareholderRepository(supabase)
  const shareholders = await repo.findByCompanyId(companyId)
  return { success: true, shareholders }
}

export async function getCompanyDocsAction(companyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const repo = new SupabaseDocumentRepository(supabase)
  const docs = await repo.getCompanyDocs(companyId)
  return { success: true, docs }
}

export async function getOnboardingStateAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const company = await service.getCompany(user.id)
  return { success: true, company }
}

export async function getProfileDataAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' as string }

  const companyRepo = new SupabaseCompanyRepository(supabase)
  const company = await companyRepo.findByUserId(user.id)
  if (!company) return { error: 'Empresa no encontrada' as string }

  const legalRepRepo = new SupabaseLegalRepRepository(supabase)
  const legalRep = await legalRepRepo.findByCompanyId(company.id)

  const shareholderRepo = new SupabaseShareholderRepository(supabase)
  const shareholders = await shareholderRepo.findByCompanyId(company.id)

  const docRepo = new SupabaseDocumentRepository(supabase)
  const companyDocs = await docRepo.getCompanyDocs(company.id)

  return { success: true, company, legalRep, shareholders, companyDocs }
}

export async function getOnboardingSummaryAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' as string }

  const service = buildService(supabase)
  const company = await service.getCompany(user.id)
  if (!company) return { error: 'Empresa no encontrada' as string }

  const legalRepRepo = new SupabaseLegalRepRepository(supabase)
  const legalRep = await legalRepRepo.findByCompanyId(company.id)

  const { count: shareholdersCount } = await supabase
    .from('shareholders')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)

  const { count: docsCount } = await supabase
    .from('company_documents')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)

  return {
    success: true,
    summary: {
      companyName: company.nombreRazonSocial,
      companyId: company.id,
      satVerificado: !!company.syntageValidatedAt,
      legalRepRegistrado: !!legalRep,
      accionistasRegistrados: (shareholdersCount ?? 0) > 0,
      documentosCargados: (docsCount ?? 0) > 0,
    },
  }
}
