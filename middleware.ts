import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { OnboardingStep } from '@/features/onboarding/types/onboarding.types'

/**
 * Middleware de autenticación y protección de rutas.
 *
 * Responsabilidades:
 * 1. Refrescar el token de sesión en cada request (obligatorio con @supabase/ssr)
 * 2. Redirigir a "/" si el usuario no autenticado intenta acceder a rutas protegidas
 * 3. Redirigir al paso correcto del onboarding si el usuario accede a /dashboard sin terminar
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

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Propagar cookies al request y a la response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: no escribir lógica entre createServerClient y getUser().
  // getUser() refresca el token si está expirado — es la fuente de verdad.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Usuario autenticado en la página de login → redirigir al dashboard
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // /onboarding/invitado is public — invitees may not have a session
  if (pathname.startsWith('/onboarding/invitado')) {
    return supabaseResponse
  }

  const protectedPaths = ['/dashboard', '/onboarding', '/solicitar-credito', '/admin']
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path))

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    redirectUrl.searchParams.set('redirected', 'true')
    return NextResponse.redirect(redirectUrl)
  }

  // Rutas /admin solo para usuarios con role = 'admin'
  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Guard de onboarding: usuarios autenticados en /dashboard deben tener onboarding completo
  if (user && pathname.startsWith('/dashboard')) {
    const { data: company } = await supabase
      .from('companies')
      .select('onboarding_completed, onboarding_step')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!company) {
      return NextResponse.redirect(new URL('/onboarding/empresa', request.url))
    }

    if (!company.onboarding_completed) {
      const step = (company.onboarding_step as OnboardingStep) ?? 'empresa'
      const path = STEP_PATHS[step] ?? '/onboarding/empresa'
      return NextResponse.redirect(new URL(path, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Corre en todos los paths EXCEPTO:
     * - _next/static  (archivos estáticos de Next.js)
     * - _next/image   (optimización de imágenes)
     * - favicon.ico
     * - archivos con extensión (png, jpg, svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
