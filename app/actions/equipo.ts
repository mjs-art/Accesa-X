'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveCompanyId } from '@/lib/get-company-context'

export type MemberRole = 'admin' | 'viewer'
export type MemberStatus = 'pending' | 'active'

export interface TeamMember {
  id: string
  companyId: string
  userId: string | null
  invitedEmail: string
  role: MemberRole
  status: MemberStatus
  invitedBy: string | null
  createdAt: string
  // joined from auth.users via admin client
  fullName?: string | null
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function getCurrentCompanyId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return getEffectiveCompanyId(supabase, userId)
}

// ─── actions ────────────────────────────────────────────────────────────────

export async function getTeamMembersAction(): Promise<
  { members: TeamMember[]; isOwner: boolean } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const companyId = await getCurrentCompanyId(supabase, user.id)
  if (!companyId) return { error: 'Empresa no encontrada' }

  const { data, error } = await supabase
    .from('company_members')
    .select('id, company_id, user_id, invited_email, role, status, invited_by, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  const rows = (data ?? []) as Record<string, unknown>[]
  const members: TeamMember[] = rows.map((r) => ({
    id: r.id as string,
    companyId: r.company_id as string,
    userId: r.user_id as string | null,
    invitedEmail: r.invited_email as string,
    role: r.role as MemberRole,
    status: r.status as MemberStatus,
    invitedBy: r.invited_by as string | null,
    createdAt: r.created_at as string,
  }))

  return { members, isOwner: true }
}

export async function inviteMemberAction(email: string, role: MemberRole): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const companyId = await getCurrentCompanyId(supabase, user.id)
  if (!companyId) return { error: 'Empresa no encontrada' }

  // Don't allow inviting yourself
  if (user.email === email) return { error: 'No puedes invitarte a ti mismo' }

  // Check if already a member
  const { data: existing } = await supabase
    .from('company_members')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('invited_email', email)
    .maybeSingle()

  if (existing) {
    const row = existing as { id: string; status: string }
    if (row.status === 'active') return { error: 'Este usuario ya es miembro del equipo' }
    if (row.status === 'pending') return { error: 'Ya se envió una invitación a este correo' }
  }

  // Insert pending member row
  const { error: insertError } = await supabase.from('company_members').insert({
    company_id: companyId,
    invited_email: email,
    role,
    status: 'pending',
    invited_by: user.id,
  })
  if (insertError) return { error: insertError.message }

  // Send invitation email via Supabase Auth admin
  try {
    const adminClient = createAdminClient()
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback?next=/dashboard`,
    })
    if (inviteError) {
      // If user already exists Supabase returns an error but the invite row is already created
      // They can log in normally and will be linked on next sign-in
      console.warn('Supabase invite warning:', inviteError.message)
    }
  } catch (e) {
    console.warn('Could not send invite email:', e)
  }

  return { success: true }
}

export async function removeMemberAction(memberId: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const companyId = await getCurrentCompanyId(supabase, user.id)
  if (!companyId) return { error: 'Empresa no encontrada' }

  const { error } = await supabase
    .from('company_members')
    .delete()
    .eq('id', memberId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateMemberRoleAction(memberId: string, role: MemberRole): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const companyId = await getCurrentCompanyId(supabase, user.id)
  if (!companyId) return { error: 'Empresa no encontrada' }

  const { error } = await supabase
    .from('company_members')
    .update({ role })
    .eq('id', memberId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  return { success: true }
}

// Called after sign-in to link the new user to any pending invitations
export async function acceptPendingInvitationsAction(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return

  await supabase
    .from('company_members')
    .update({ user_id: user.id, status: 'active' })
    .eq('invited_email', user.email)
    .eq('status', 'pending')
}
