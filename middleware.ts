import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware de autenticación y protección de rutas.
 *
 * Responsabilidades:
 * 1. Refrescar el token de sesión en cada request (obligatorio con @supabase/ssr)
 * 2. Redirigir a "/" si el usuario no autenticado intenta acceder a rutas protegidas
 *
 * Rutas protegidas: /dashboard/*, /onboarding/*
 */
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
