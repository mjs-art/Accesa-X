'use server'

import { createClient } from '@/lib/supabase/server'
import { SupabaseAdminRepository } from '@/features/admin/repositories/admin.repository.impl'
import { AdminService } from '@/features/admin/services/admin.service'
import type { ApplicationStatus } from '@/features/admin/types/admin.types'

function buildService(supabase: Awaited<ReturnType<typeof createClient>>) {
  return new AdminService(new SupabaseAdminRepository(supabase))
}

export async function getApplicationsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const applications = await service.getApplications()
  return { success: true, applications }
}

export async function getApplicationWithDetailsAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const application = await service.getApplicationWithDetails(id)
  if (!application) return { error: 'Solicitud no encontrada' }
  return { success: true, application }
}

export async function changeApplicationStatusAction(
  id: string,
  newStatus: ApplicationStatus,
  auditText: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const service = buildService(supabase)
    await service.changeStatus(id, newStatus, user.id, user.email ?? 'admin', auditText)
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al actualizar estado' }
  }
}

export async function addNoteAction(creditApplicationId: string, note: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const service = buildService(supabase)
    await service.addNote(creditApplicationId, user.id, user.email ?? 'admin', note)
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al agregar nota' }
  }
}

export async function getNotesAction(applicationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const notes = await service.getNotes(applicationId)
  return { success: true, notes }
}

export async function getAdminCompaniesAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const companies = await service.getAdminCompanies()
  return { success: true, companies }
}

export async function getSignedDownloadUrlAction(storagePath: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = buildService(supabase)
  const signedUrl = await service.getSignedDownloadUrl(storagePath)
  if (!signedUrl) return { error: 'No se pudo generar el enlace' }
  return { success: true, signedUrl }
}
