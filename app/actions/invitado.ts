'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { SupabaseInvitationRepository } from '@/features/onboarding/repositories/invitation.repository.impl'
import type { OnboardingInvitation } from '@/features/onboarding/types/onboarding.types'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function getInvitationByTokenAction(
  token: string,
): Promise<{ invitation: OnboardingInvitation | null; error?: string }> {
  if (!token) return { invitation: null, error: 'Token inválido' }

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

  // Insert shareholder record using admin client (bypasses RLS)
  const { error: insertError } = await adminClient.from('shareholders').insert({
    company_id: input.companyId,
    es_persona_moral: input.esPersonaMoral,
    posee_mas_25_porciento: input.poseeMas25Porciento,
    porcentaje_participacion: input.porcentajeParticipacion ?? null,
    nombres: input.nombres ?? null,
    apellido_paterno: input.apellidoPaterno ?? null,
    apellido_materno: input.apellidoMaterno ?? null,
    curp: input.curp ?? null,
    fecha_nacimiento: input.fechaNacimiento ?? null,
    ocupacion: input.ocupacion ?? null,
    telefono: input.telefono ? `+52${input.telefono}` : null,
  })

  if (insertError) return { error: insertError.message }

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

  // Update or insert legal_representatives record using admin client
  const { data: existing } = await adminClient
    .from('legal_representatives')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('es_el_usuario', false)
    .single()

  if (existing) {
    const { error: updateError } = await adminClient
      .from('legal_representatives')
      .update({
        nombres: input.nombres ?? null,
        apellido_paterno: input.apellidoPaterno ?? null,
        apellido_materno: input.apellidoMaterno ?? null,
        curp: input.curp ?? null,
        rfc_personal: input.rfcPersonal ?? null,
        email: input.email ?? null,
        telefono: input.telefono ? `+52${input.telefono}` : null,
      })
      .eq('id', existing.id)

    if (updateError) return { error: updateError.message }
  } else {
    const { error: insertError } = await adminClient.from('legal_representatives').insert({
      company_id: input.companyId,
      es_el_usuario: false,
      nombres: input.nombres ?? null,
      apellido_paterno: input.apellidoPaterno ?? null,
      apellido_materno: input.apellidoMaterno ?? null,
      curp: input.curp ?? null,
      rfc_personal: input.rfcPersonal ?? null,
      email: input.email ?? null,
      telefono: input.telefono ? `+52${input.telefono}` : null,
      telefono_verificado: false,
    })

    if (insertError) return { error: insertError.message }
  }

  await repo.markAccepted(input.token)
  return { success: true }
}
