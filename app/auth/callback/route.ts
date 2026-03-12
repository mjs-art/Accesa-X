import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { OnboardingStep } from '@/features/onboarding/types/onboarding.types'

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

const STEP_PATHS: Record<OnboardingStep, string> = {
  'empresa':             '/onboarding/empresa',
  'verificacion-fiscal': '/onboarding/verificacion-fiscal',
  'legal-rep':           '/onboarding/legal-rep',
  'legal-rep-docs':      '/onboarding/legal-rep-docs',
  'shareholders':        '/onboarding/shareholders',
  'company-docs':        '/onboarding/company-docs',
  'confirmation':        '/onboarding/confirmation',
  'completed':           '/dashboard',
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Si el next ya viene especificado en la URL, respetarlo
      if (next !== '/dashboard' && next !== '/onboarding/empresa') {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Detectar en qué paso del onboarding está el usuario
      const { data: company } = await supabase
        .from('companies')
        .select('id, onboarding_completed, onboarding_step, syntage_validated_at')
        .eq('user_id', data.user.id)
        .limit(1)
        .single()

      if (!company) {
        return NextResponse.redirect(`${origin}/onboarding/empresa`)
      }

      // Si tiene SAT validado pero onboarding_completed = false, auto-sanar el registro.
      // Esto cubre usuarios registrados antes de que se agregaran nuevos pasos de onboarding.
      if (!company.onboarding_completed && company.syntage_validated_at) {
        await supabase
          .from('companies')
          .update({ onboarding_completed: true, onboarding_step: 'completed' })
          .eq('id', company.id)
        return NextResponse.redirect(`${origin}/dashboard`)
      }

      if (company.onboarding_completed) {
        return NextResponse.redirect(`${origin}/dashboard`)
      }

      const step = (company.onboarding_step as OnboardingStep) ?? 'empresa'
      const stepPath = STEP_PATHS[step] ?? '/onboarding/empresa'
      return NextResponse.redirect(`${origin}${stepPath}`)
    }
  }

  // Si no hay code o hubo un error, redirige al inicio con parámetro de error
  return NextResponse.redirect(`${origin}/?error=auth_callback_error`)
}
