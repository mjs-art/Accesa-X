'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

    // Si ya tiene empresa registrada → dashboard, si no → onboarding
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', signInData.user.id)
      .limit(1)
      .single()

    window.location.href = company ? '/dashboard' : '/onboarding/empresa'
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
    <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-3xl font-bold tracking-tight text-[#0F2D5E]">
            Accesa<span className="text-[#00C896]">X</span>
          </span>
          <p className="mt-2 text-sm text-[#64748B]">
            Plataforma de crédito B2B
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-5">

          {/* Título */}
          <h1 className="text-lg font-semibold text-[#0F172A] text-center">
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
            <span className="text-xs text-[#64748B] font-medium">o</span>
            <Separator className="flex-1" />
          </div>

          {/* Formulario */}
          <form onSubmit={isRegister ? handleRegister : handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-[#0F172A]">
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
              <Label htmlFor="password" className="text-sm text-[#0F172A]">
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
                <Label htmlFor="confirmPassword" className="text-sm text-[#0F172A]">
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
              className="w-full h-11 bg-[#0F2D5E] hover:bg-[#0F2D5E]/90 text-white font-medium"
              disabled={loading || googleLoading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isRegister ? (
                'Crear cuenta'
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* Toggle login / registro */}
          <p className="text-center text-sm text-[#64748B]">
            {isRegister ? (
              <>
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-[#0F2D5E] font-medium hover:underline"
                >
                  Entra aquí
                </button>
              </>
            ) : (
              <>
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-[#0F2D5E] font-medium hover:underline"
                >
                  Regístrate
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-center text-xs text-[#64748B] mt-6">
          Al continuar aceptas nuestros{' '}
          <span className="underline cursor-pointer">Términos de uso</span>
        </p>
      </div>
    </main>
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
