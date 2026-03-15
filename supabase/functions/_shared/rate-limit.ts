import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Check and record a rate-limited action.
 *
 * @param client       Service-role Supabase client
 * @param key          User UUID or client IP
 * @param action       Identifier for the endpoint (e.g. 'analyze-contract')
 * @param limit        Max allowed calls within the window
 * @param windowSeconds Time window in seconds
 * @returns `{ allowed: true }` or `{ allowed: false, retryAfterSeconds }`
 */
export async function checkRateLimit(
  client: SupabaseClient,
  key: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()

  const { count, error } = await client
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .eq('action', action)
    .gte('called_at', since)

  if (error) {
    // Fail open: if we can't check, allow the request rather than block everyone.
    console.error('rate-limit check error:', error.message)
    return { allowed: true }
  }

  if ((count ?? 0) >= limit) {
    return { allowed: false, retryAfterSeconds: windowSeconds }
  }

  // Record this call (best-effort — don't block the request if insert fails)
  await client.from('rate_limits').insert({ key, action }).catch((e: Error) =>
    console.error('rate-limit insert error:', e.message)
  )

  return { allowed: true }
}
