'use server'

import { createClient as createServerClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { SupabaseCompanyRepository } from '@/features/onboarding/repositories/company.repository.impl'
import { SupabaseInvitationRepository } from '@/features/onboarding/repositories/invitation.repository.impl'
import type { InvitationType } from '@/features/onboarding/types/onboarding.types'

export async function sendInvitationAction(
  companyId: string,
  email: string,
  type: InvitationType,
  name?: string,
) {
  // Verificar que el usuario autenticado es dueño de la empresa
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const companyRepo = new SupabaseCompanyRepository(supabase)
  const isOwner = await companyRepo.verifyOwnership(companyId, user.id)
  if (!isOwner) return { error: 'Empresa no encontrada' }

  // Generar token único
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  // Guardar invitación usando service role (para evitar RLS en este contexto)
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const invitationRepo = new SupabaseInvitationRepository(adminClient)
  await invitationRepo.create({
    companyId,
    invitationType: type,
    inviteeEmail: email,
    inviteeName: name,
    token,
    expiresAt,
  })

  // Enviar invitación via Supabase Auth Admin
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { invitation_token: token, company_id: companyId },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/invitado?token=${token}`,
  })

  if (inviteError) {
    return { error: 'No se pudo enviar la invitación. Intenta de nuevo.' }
  }

  return { success: true, token }
}
