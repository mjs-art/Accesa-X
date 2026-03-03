import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Route Handler para el redirect de OAuth (Google) y magic links.
 * Supabase redirige aquí con un `code` después de que el usuario autoriza.
 * Este handler intercambia el code por una sesión activa.
 *
 * Configura esta URL en Supabase Dashboard:
 *   Authentication → URL Configuration → Redirect URLs
 *   → http://localhost:3000/auth/callback  (desarrollo)
 *   → https://tu-dominio.com/auth/callback (producción)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Si el next ya viene especificado en la URL, respetarlo
      // Si no, detectar si el usuario ya tiene empresa y redirigir correctamente
      if (next !== '/dashboard' && next !== '/onboarding/empresa') {
        return NextResponse.redirect(`${origin}${next}`)
      }

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', data.user.id)
        .limit(1)
        .single()

      const destination = company ? '/dashboard' : '/onboarding/empresa'
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  // Si no hay code o hubo un error, redirige al inicio con parámetro de error
  return NextResponse.redirect(`${origin}/?error=auth_callback_error`)
}
