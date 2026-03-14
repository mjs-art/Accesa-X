'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { AccessibleCompany } from '@/lib/company-types'
import { ACTIVE_COMPANY_COOKIE } from '@/lib/company-types'

export type { AccessibleCompany }

export async function getAccessibleCompaniesAction(): Promise<AccessibleCompany[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const results: AccessibleCompany[] = []

  // Own company
  const { data: own } = await supabase
    .from('companies')
    .select('id, rfc, nombre_razon_social')
    .eq('user_id', user.id)
    .limit(5)

  for (const c of (own ?? []) as { id: string; rfc: string; nombre_razon_social: string }[]) {
    results.push({
      id: c.id,
      name: c.nombre_razon_social ?? c.rfc,
      rfc: c.rfc,
      role: 'owner',
    })
  }

  // Memberships
  const { data: memberships } = await supabase
    .from('company_members')
    .select('company_id, role, companies(id, rfc, nombre_razon_social)')
    .eq('user_id', user.id)
    .eq('status', 'active')

  for (const m of (memberships ?? []) as unknown as {
    company_id: string
    role: string
    companies: { id: string; rfc: string; nombre_razon_social: string } | null
  }[]) {
    if (!m.companies) continue
    // Avoid duplicates if user owns and is member (shouldn't happen but guard it)
    if (results.some((r) => r.id === m.company_id)) continue
    results.push({
      id: m.company_id,
      name: m.companies.nombre_razon_social ?? m.companies.rfc,
      rfc: m.companies.rfc,
      role: m.role as 'admin' | 'viewer',
    })
  }

  return results
}

export async function getActiveCompanyIdAction(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ?? null
}

export async function switchCompanyAction(companyId: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Validate access before setting cookie
  const { data: own } = await supabase
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!own) {
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) return { error: 'Sin acceso a esta empresa' }
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return { success: true }
}
