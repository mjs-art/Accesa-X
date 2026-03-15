'use server'

import { createClient } from '@/lib/supabase/server'
import { SupabaseAdminRepository } from '@/features/admin/repositories/admin.repository.impl'
import { AdminService } from '@/features/admin/services/admin.service'
import type { ApplicationStatus } from '@/features/admin/types/admin.types'

function buildService(supabase: Awaited<ReturnType<typeof createClient>>) {
  return new AdminService(new SupabaseAdminRepository(supabase))
}

// UUID v4 seguido de / y un nombre de archivo — sin path traversal.
const STORAGE_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[^/]+$/i

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase: null, user: null, error: 'No autenticado' as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { supabase: null, user: null, error: 'Forbidden' as const }

  return { supabase, user, error: null }
}

export async function getApplicationsAction() {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const service = buildService(supabase!)
  const applications = await service.getApplications()
  return { success: true, applications }
}

export async function getApplicationWithDetailsAction(id: string) {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const service = buildService(supabase!)
  const application = await service.getApplicationWithDetails(id)
  if (!application) return { error: 'Solicitud no encontrada' }
  return { success: true, application }
}

export async function changeApplicationStatusAction(
  id: string,
  newStatus: ApplicationStatus,
  auditText: string,
) {
  const { supabase, user, error } = await requireAdmin()
  if (error) return { error }

  try {
    const service = buildService(supabase!)
    await service.changeStatus(id, newStatus, user!.id, user!.email ?? 'admin', auditText)
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al actualizar estado' }
  }
}

export async function addNoteAction(creditApplicationId: string, note: string) {
  const { supabase, user, error } = await requireAdmin()
  if (error) return { error }

  try {
    const service = buildService(supabase!)
    await service.addNote(creditApplicationId, user!.id, user!.email ?? 'admin', note)
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al agregar nota' }
  }
}

export async function getNotesAction(applicationId: string) {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const service = buildService(supabase!)
  const notes = await service.getNotes(applicationId)
  return { success: true, notes }
}

export async function getAdminCompaniesAction() {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const service = buildService(supabase!)
  const companies = await service.getAdminCompanies()
  return { success: true, companies }
}

export async function getSignedDownloadUrlAction(storagePath: string) {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  if (!STORAGE_PATH_RE.test(storagePath)) return { error: 'Ruta de archivo inválida' }

  const service = buildService(supabase!)
  const signedUrl = await service.getSignedDownloadUrl(storagePath)
  if (!signedUrl) return { error: 'No se pudo generar el enlace' }
  return { success: true, signedUrl }
}
