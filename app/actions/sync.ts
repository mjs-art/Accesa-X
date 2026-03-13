'use server'

import { createClient } from '@/lib/supabase/server'
import { SupabaseSyncJobRepository } from '@/features/inteligencia/repositories/sync-job.repository.impl'
import { InteligenciaService } from '@/features/inteligencia/services/inteligencia.service'
import { SupabaseCompanyRepository } from '@/features/onboarding/repositories/company.repository.impl'
import type { SyncJob } from '@/features/inteligencia/types/inteligencia.types'

function buildService(supabase: Awaited<ReturnType<typeof createClient>>) {
  return new InteligenciaService(new SupabaseSyncJobRepository(supabase))
}

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const companyRepo = new SupabaseCompanyRepository(supabase)
  const company = await companyRepo.findByUserId(user.id)
  if (!company) return null

  return { supabase, user, company }
}

// Retorna el job de sincronización más reciente de la empresa
export async function getSyncStatusAction(): Promise<SyncJob | { error: string }> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autenticado' }

  const service = buildService(ctx.supabase)
  const job = await service.getSyncStatus(ctx.company.id)
  if (!job) return { error: 'Sin sincronizaciones' }
  return job
}

// Retorna un job específico por ID (para inicializar el componente SyncProgress)
export async function getSyncJobByIdAction(jobId: string): Promise<SyncJob | { error: string }> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autenticado' }

  const service = buildService(ctx.supabase)
  const job = await service.getSyncJobById(jobId)
  if (!job) return { error: 'Job no encontrado' }

  // Seguridad: verificar que el job pertenece a la empresa del usuario
  if (job.companyId !== ctx.company.id) return { error: 'No autorizado' }
  return job
}

// Dispara una sincronización completa con Syntage.
// - Si ya hay un job activo (queued/running), retorna ese jobId sin crear uno nuevo.
// - Si ya hay un job completado y force=false, retorna { jobId, alreadySynced: true }
//   sin consumir peticiones de Syntage.
// - force=true omite los guards y dispara una re-sincronización completa.
export async function triggerSyncAction(
  force = false,
): Promise<{ jobId: string; alreadySynced?: boolean } | { error: string; needsVerification?: boolean }> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autenticado' }

  // Requiere que la empresa esté previamente validada con Syntage
  if (!ctx.company.syntageValidatedAt) {
    return { error: 'Conecta primero tu empresa con el SAT.', needsVerification: true }
  }

  // Guard local: evita round-trip a la Edge Function cuando el resultado es predecible
  if (!force) {
    const service = buildService(ctx.supabase)
    const latest = await service.getSyncStatus(ctx.company.id)
    if (latest?.status === 'completed') {
      return { jobId: latest.id, alreadySynced: true }
    }
    if (latest?.status === 'queued' || latest?.status === 'running') {
      return { jobId: latest.id }
    }
  }

  const { data, error } = await ctx.supabase.functions.invoke('sync-sat-full', {
    body: { company_id: ctx.company.id, force },
  })

  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error('[triggerSyncAction] error name:', error.name, 'message:', error.message, 'context type:', typeof (error as any).context, 'context:', (error as any).context)
    let message: string = error.message ?? 'Error al iniciar sincronización'
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = (error as any).context
      if (ctx instanceof Response) {
        const text = await ctx.text()
        try {
          const parsed = JSON.parse(text)
          if (parsed?.error) message = parsed.error
          else message = text || message
        } catch {
          if (text) message = text
        }
      } else if (ctx?.error) {
        message = ctx.error
      }
    } catch { /* usar message genérico */ }
    return { error: message }
  }
  if (!data?.jobId) return { error: 'Respuesta inesperada del servidor' }

  return { jobId: data.jobId as string, alreadySynced: data.alreadySynced ?? false }
}
