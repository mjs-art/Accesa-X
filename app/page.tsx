'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPostLoginRedirectAction } from '@/app/actions/dashboard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'

type Mode = 'login' | 'register'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supabase = createClient()

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding/empresa`,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    const { redirect } = await getPostLoginRedirectAction(signInData.user.id)
    window.location.href = redirect
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding/empresa`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess('Revisa tu correo para confirmar tu cuenta y continuar.')
      setLoading(false)
    }
  }

  const isRegister = mode === 'register'

  return (
    <main className="min-h-screen flex" style={{ background: 'linear-gradient(180deg, #3CBEDB 0%, #2A2928 100%)' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-14">
        <div className="flex items-center gap-3">
          <AccesaIconSvg className="h-9 w-9 shrink-0" />
          <span className="text-white font-bold text-xl tracking-tight">accesa</span>
        </div>
        <div>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Crédito empresarial<br />sin complicaciones
          </h2>
          <p className="text-white/70 text-lg">
            Plataforma B2B para financiamiento de empresas mexicanas.
          </p>
        </div>
        <p className="text-white/40 text-sm">© 2026 AccesaX. Todos los derechos reservados.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="text-center mb-8 lg:hidden">
            <span className="text-3xl font-bold tracking-tight text-white">accesa</span>
            <p className="mt-2 text-sm text-white/70">Plataforma de crédito B2B</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">

            <h1 className="text-lg font-semibold text-[#1A1A1A] text-center">
              {isRegister ? 'Crear cuenta' : 'Bienvenido'}
            </h1>

            {/* Google */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 font-medium border-slate-300 hover:bg-slate-50"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon className="mr-2 h-4 w-4" />
              )}
              Continuar con Google
            </Button>

            {/* Separador */}
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-[#6B7280] font-medium">o</span>
              <Separator className="flex-1" />
            </div>

            {/* Formulario */}
            <form onSubmit={isRegister ? handleRegister : handleEmailLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm text-[#374151] font-medium">
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-[#374151] font-medium">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  className="h-11"
                />
              </div>

              {isRegister && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm text-[#374151] font-medium">
                    Confirmar contraseña
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading || googleLoading}
                    className="h-11"
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  {success}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white font-bold tracking-wide"
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isRegister ? (
                  'CREAR CUENTA'
                ) : (
                  'ENTRAR'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-[#6B7280]">
              {isRegister ? (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <button type="button" onClick={() => switchMode('login')} className="text-[#3CBEDB] font-medium hover:underline">
                    Entra aquí
                  </button>
                </>
              ) : (
                <>
                  ¿No tienes cuenta?{' '}
                  <button type="button" onClick={() => switchMode('register')} className="text-[#3CBEDB] font-medium hover:underline">
                    Regístrate
                  </button>
                </>
              )}
            </p>
          </div>

          <p className="text-center text-xs text-white/40 mt-6">
            Al continuar aceptas nuestros{' '}
            <span className="underline cursor-pointer">Términos de uso</span>
          </p>
        </div>
      </div>
    </main>
  )
}

function AccesaIconSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.7 15.7L4.6 19.8L1 22.8C-.1 23.7-.3 25.2.4 26.1C1.2 27.1 2.7 27.1 3.8 26.2L18 14.6L11.8 14L9.7 15.7Z" fill="#5DAA98"/>
      <path d="M5.5 9.2C5.6 8 6.7 7.1 7.7 7.2L12.4 7.6L17.1 8.1L19.9 8.4C20.9 8.5 21.7 9.6 21.6 10.8C21.4 12 20.5 12.9 19.5 12.8L7.1 11.6C6.1 11.5 5.4 10.4 5.5 9.2Z" fill="#83C8BA"/>
      <path d="M27.6 6.5L22 3L18.1.5C16.9-.3 15.4-.1 14.8.9C14.1 1.9 14.5 3.4 15.7 4.2L31.1 14.1L29.8 8L27.6 6.5Z" fill="#27A3B7"/>
      <path d="M32.5.5C33.7.2 34.8 1 35 2L36 6.6L37 11.2L37.7 14C37.9 15 37.1 16 35.9 16.3C34.7 16.5 33.5 15.9 33.3 14.9L30.7 2.8C30.5 1.8 31.3.7 32.5.5Z" fill="#3FBDD9"/>
      <path d="M41.9 20.9L43.5 14.6L44.7 10C45.1 8.7 44.4 7.3 43.2 7C42 6.7 40.7 7.6 40.4 8.9L35.8 26.6L41.2 23.5L41.9 20.9Z" fill="#9965A7"/>
      <path d="M49.1 23.7C49.7 24.7 49.4 26.1 48.5 26.6L44.4 29L40.4 31.4L37.9 32.8C37 33.3 35.8 32.9 35.2 31.8C34.6 30.8 34.8 29.5 35.7 29L46.4 22.7C47.3 22.2 48.5 22.6 49.1 23.7Z" fill="#B973AE"/>
      <path d="M32.7 38.8L39.3 38.4L43.9 38.2C45.4 38.1 46.5 37 46.4 35.8C46.3 34.6 45.1 33.7 43.7 33.7L25.4 34.8L30.1 39L32.7 38.8Z" fill="#CF5B5B"/>
      <path d="M32.3 46.6C31.5 47.5 30.1 47.6 29.4 46.9L25.8 43.7L22.3 40.6L20.2 38.7C19.4 38 19.5 36.7 20.3 35.8C21.1 34.9 22.4 34.7 23.2 35.4L32.4 43.7C33.2 44.4 33.1 45.7 32.3 46.6Z" fill="#EC6169"/>
      <path d="M12.8 35.8L15.1 41.9L16.8 46.3C17.3 47.6 18.6 48.3 19.8 47.9C20.9 47.4 21.5 46 21 44.7L14.4 27.6L11.9 33.3L12.8 35.8Z" fill="#F2904A"/>
      <path d="M5.3 37.7C4.2 37.2 3.7 36 4.1 35L6 30.7L7.9 26.4L9.1 23.8C9.5 22.9 10.8 22.5 11.9 23C13 23.5 13.6 24.7 13.2 25.6L8.1 37C7.7 37.9 6.4 38.3 5.3 37.7Z" fill="#FBBC32"/>
    </svg>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
