'use server'

import { createClient } from '@/lib/supabase/server'
import { SupabaseDashboardRepository } from '@/features/dashboard/repositories/dashboard.repository.impl'
import { DashboardService } from '@/features/dashboard/services/dashboard.service'
import { SupabaseCompanyRepository } from '@/features/onboarding/repositories/company.repository.impl'
import type { OnboardingStep } from '@/features/onboarding/types/onboarding.types'

const STEP_PATHS: Record<OnboardingStep, string> = {
  'empresa': '/onboarding/empresa',
  'verificacion-fiscal': '/onboarding/verificacion-fiscal',
  'legal-rep': '/onboarding/legal-rep',
  'legal-rep-docs': '/onboarding/legal-rep-docs',
  'shareholders': '/onboarding/shareholders',
  'company-docs': '/onboarding/company-docs',
  'confirmation': '/onboarding/confirmation',
  'completed': '/dashboard',
}

function buildDashboardService(supabase: Awaited<ReturnType<typeof createClient>>) {
  return new DashboardService(new SupabaseDashboardRepository(supabase))
}

export async function getDashboardDataAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildDashboardService(supabase)
  const data = await service.getDashboardData(user.id)
  if (!data) return { error: 'Empresa no encontrada' }
  return { success: true, data }
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}

export async function syncSatDataAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const service = buildDashboardService(supabase)
    await service.syncSatData()
    return { success: true }
  } catch {
    return { error: 'No se pudo sincronizar. Intenta de nuevo.' }
  }
}

export async function getCompanyForVerificationAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const companyRepo = new SupabaseCompanyRepository(supabase)
  const company = await companyRepo.findByUserId(user.id)
  if (!company) return { error: 'Empresa no encontrada' }

  return {
    success: true,
    company: {
      id: company.id,
      rfc: company.rfc,
      nombreRazonSocial: company.nombreRazonSocial,
      syntageValidatedAt: company.syntageValidatedAt ?? null,
    },
  }
}

export async function connectSyntageAction(rfc: string, ciec: string, companyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase.functions.invoke('syntage-connect', {
    body: { rfc, ciec, company_id: companyId },
  })

  if (error) return { error: 'No se pudo conectar con el SAT. Intenta de nuevo.' }

  if (data?.success && data?.status === 'valid') {
    return { success: true }
  } else if (data?.status === 'invalid') {
    return { error: 'CIEC incorrecta. Verifica tu contraseña del portal sat.gob.mx e intenta de nuevo.' }
  } else {
    return { error: 'No fue posible verificar tu RFC en este momento. Intenta de nuevo en unos minutos.' }
  }
}

export async function getPostLoginRedirectAction(userId: string) {
  const supabase = await createClient()
  const companyRepo = new SupabaseCompanyRepository(supabase)
  const company = await companyRepo.findByUserId(userId)

  if (!company) return { redirect: '/onboarding/empresa' }
  if (company.onboardingStep === 'completed') return { redirect: '/dashboard' }

  const step = company.onboardingStep as OnboardingStep
  return { redirect: STEP_PATHS[step] ?? '/onboarding/empresa' }
}

export interface AnalyzedContract {
  id: string
  nombreCliente: string
  storagePath: string
  montoContrato: number | null
}

export async function getAnalyzedContractsAction(companyId: string): Promise<{ contracts: AnalyzedContract[] }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contracts')
    .select('id, nombre_cliente, storage_path, monto_contrato')
    .eq('company_id', companyId)
    .eq('analysis_status', 'completed')
    .order('created_at', { ascending: false })

  const rows = (data as Record<string, unknown>[] | null) ?? []
  return {
    contracts: rows.map((r) => ({
      id: r.id as string,
      nombreCliente: r.nombre_cliente as string,
      storagePath: r.storage_path as string,
      montoContrato: r.monto_contrato as number | null,
    })),
  }
}

export interface SubmitCreditApplicationInput {
  companyId: string
  tipoCredito: 'empresarial' | 'factoraje' | 'contrato'
  montoSolicitado: number
  plazoMeses: number
  destino: string
  contractId?: string | null
}

export async function submitCreditApplicationAction(input: SubmitCreditApplicationInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('credit_applications').insert({
    company_id: input.companyId,
    tipo_credito: input.tipoCredito,
    monto_solicitado: input.montoSolicitado,
    plazo_meses: input.plazoMeses,
    destino: input.destino,
    contract_id: input.contractId ?? null,
    status: 'submitted',
  })

  if (error) return { error: error.message }
  return { success: true }
}

export interface CreditApplicationSummary {
  id: string
  tipoCredito: string
  montoSolicitado: number
  plazoMeses: number | null
  status: string
  createdAt: string
}

export async function getCreditApplicationsAction(): Promise<{ applications: CreditApplicationSummary[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const companyRepo = new SupabaseCompanyRepository(supabase)
  const company = await companyRepo.findByUserId(user.id)
  if (!company) return { error: 'Empresa no encontrada' }

  const { data } = await supabase
    .from('credit_applications')
    .select('id, tipo_credito, monto_solicitado, plazo_meses, status, created_at')
    .eq('company_id', company.id)
    .gt('monto_solicitado', 0)
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as Record<string, unknown>[]
  return {
    applications: rows.map((r) => ({
      id: r.id as string,
      tipoCredito: r.tipo_credito as string,
      montoSolicitado: r.monto_solicitado as number,
      plazoMeses: r.plazo_meses as number | null,
      status: r.status as string,
      createdAt: r.created_at as string,
    })),
  }
}

export async function debugResetSyntageAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase.functions.invoke('debug-reset-syntage')
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; syntage?: string[]; error?: string }
}
