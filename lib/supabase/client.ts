import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente Supabase para Client Components.
 * Usa cookies del navegador para mantener la sesión.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
