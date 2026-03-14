/**
 * Server-side helper — returns the company the current user should operate on.
 *
 * Resolution order:
 *  1. preferredId (from cookie) — validated that user has access
 *  2. Company owned by the user (companies.user_id = auth.uid())
 *  3. Company where the user is an active member (company_members)
 *
 * Only import this in Server Components, Route Handlers, and Server Actions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export async function getEffectiveCompanyId(
  supabase: SupabaseClient,
  userId: string,
  preferredId?: string | null,
): Promise<string | null> {
  // 1. Honor the preferred (cookie) company if the user actually has access
  if (preferredId) {
    const { data: own } = await supabase
      .from('companies')
      .select('id')
      .eq('id', preferredId)
      .eq('user_id', userId)
      .maybeSingle()

    if (own) return preferredId

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('company_id', preferredId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (membership) return preferredId
    // Cookie is stale — fall through
  }

  // 2. Own company
  const { data: own } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (own) return (own as { id: string }).id

  // 3. Team membership
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
  preferredId?: string | null,
): Promise<{ id: string; rfc: string } | null> {
  const companyId = await getEffectiveCompanyId(supabase, userId, preferredId)
  if (!companyId) return null

  const { data } = await supabase
    .from('companies')
    .select('id, rfc')
    .eq('id', companyId)
    .single()

  return data as { id: string; rfc: string } | null
}
