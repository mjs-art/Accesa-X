/**
 * Server-side helper — returns the company the current user should operate on.
 *
 * Resolution order:
 *  1. Company owned by the user (companies.user_id = auth.uid())
 *  2. Company where the user is an active member (company_members)
 *
 * Only import this in Server Components, Route Handlers, and Server Actions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export async function getEffectiveCompanyId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  // 1. Own company
  const { data: own } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (own) return (own as { id: string }).id

  // 2. Team membership
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (membership) return (membership as { company_id: string }).company_id

  return null
}

export async function getEffectiveCompany(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: string; rfc: string } | null> {
  const companyId = await getEffectiveCompanyId(supabase, userId)
  if (!companyId) return null

  const { data } = await supabase
    .from('companies')
    .select('id, rfc')
    .eq('id', companyId)
    .single()

  return data as { id: string; rfc: string } | null
}
