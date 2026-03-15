'use server'

import { headers } from 'next/headers'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { SupabaseInvitationRepository } from '@/features/onboarding/repositories/invitation.repository.impl'
import { SupabaseShareholderRepository } from '@/features/onboarding/repositories/shareholder.repository.impl'
import { SupabaseLegalRepRepository } from '@/features/onboarding/repositories/legal-rep.repository.impl'
import type { OnboardingInvitation } from '@/features/onboarding/types/onboarding.types'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function checkInvitationRateLimit(ip: string): Promise<boolean> {
  const adminClient = getAdminClient()
  const since = new Date(Date.now() - 3600 * 1000).toISOString()

  const { count, error } = await adminClient
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('key', ip)
    .eq('action', 'invitation-lookup')
    .gte('called_at', since)

  if (error) return true // fail open

  if ((count ?? 0) >= 20) return false

  await adminClient.from('rate_limits').insert({ key: ip, action: 'invitation-lookup' }).catch(() => {})
  return true
}

function getClientIp(): string {
  const headersList = headers()
  return (
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'
  )
}

export async function getInvitationByTokenAction(
  token: string,
): Promise<{ invitation: OnboardingInvitation | null; error?: string }> {
  if (!token) return { invitation: null, error: 'Token inválido' }

  const ip = getClientIp()
  const allowed = await checkInvitationRateLimit(ip)
  if (!allowed) return { invitation: null, error: 'Demasiados intentos. Intenta más tarde.' }

  const adminClient = getAdminClient()
  const repo = new SupabaseInvitationRepository(adminClient)
  const invitation = await repo.findByToken(token)

  if (!invitation) return { invitation: null, error: 'Invitación no encontrada' }

  // Check expiry on the fly
  if (invitation.status === 'pending' && new Date(invitation.expiresAt) < new Date()) {
    await repo.markExpired(token)
    return { invitation: { ...invitation, status: 'expired' }, error: 'expired' }
  }

  return { invitation }
}

export interface AcceptShareholderInvitationInput {
  token: string
  companyId: string
  esPersonaMoral: boolean
  poseeMas25Porciento: boolean
  porcentajeParticipacion?: number | null
  nombres?: string | null
  apellidoPaterno?: string | null
  apellidoMaterno?: string | null
  curp?: string | null
  fechaNacimiento?: string | null
  ocupacion?: string | null
  telefono?: string | null
}

export async function acceptShareholderInvitationAction(
  input: AcceptShareholderInvitationInput,
): Promise<{ success?: boolean; error?: string }> {
  const adminClient = getAdminClient()
  const repo = new SupabaseInvitationRepository(adminClient)

  const invitation = await repo.findByToken(input.token)
  if (!invitation) return { error: 'Invitación no encontrada' }
  if (invitation.status === 'accepted') return { error: 'already_accepted' }
  if (invitation.status === 'expired' || new Date(invitation.expiresAt) < new Date()) {
    return { error: 'expired' }
  }

  try {
    const shareholderRepo = new SupabaseShareholderRepository(adminClient)
    // Use companyId from the invitation (server-validated), not from client input.
    await shareholderRepo.create({
      companyId: invitation.companyId,
      esPersonaMoral: input.esPersonaMoral,
      poseeMas25Porciento: input.poseeMas25Porciento,
      porcentajeParticipacion: input.porcentajeParticipacion ?? undefined,
      nombres: input.nombres ?? undefined,
      apellidoPaterno: input.apellidoPaterno ?? undefined,
      apellidoMaterno: input.apellidoMaterno ?? undefined,
      curp: input.curp ?? undefined,
      fechaNacimiento: input.fechaNacimiento ?? undefined,
      ocupacion: input.ocupacion ?? undefined,
      telefono: input.telefono ?? undefined,
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al guardar accionista' }
  }

  await repo.markAccepted(input.token)
  return { success: true }
}

export interface AcceptLegalRepInvitationInput {
  token: string
  companyId: string
  nombres?: string | null
  apellidoPaterno?: string | null
  apellidoMaterno?: string | null
  curp?: string | null
  rfcPersonal?: string | null
  email?: string | null
  telefono?: string | null
}

export async function acceptLegalRepInvitationAction(
  input: AcceptLegalRepInvitationInput,
): Promise<{ success?: boolean; error?: string }> {
  const adminClient = getAdminClient()
  const repo = new SupabaseInvitationRepository(adminClient)

  const invitation = await repo.findByToken(input.token)
  if (!invitation) return { error: 'Invitación no encontrada' }
  if (invitation.status === 'accepted') return { error: 'already_accepted' }
  if (invitation.status === 'expired' || new Date(invitation.expiresAt) < new Date()) {
    return { error: 'expired' }
  }

  try {
    const legalRepRepo = new SupabaseLegalRepRepository(adminClient)
    // Use companyId from the invitation (server-validated), not from client input.
    await legalRepRepo.upsertFromInvitation(invitation.companyId, {
      nombres: input.nombres,
      apellidoPaterno: input.apellidoPaterno,
      apellidoMaterno: input.apellidoMaterno,
      curp: input.curp,
      rfcPersonal: input.rfcPersonal,
      email: input.email,
      telefono: input.telefono,
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al guardar representante legal' }
  }

  await repo.markAccepted(input.token)
  return { success: true }
}
