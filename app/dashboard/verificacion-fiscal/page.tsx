'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCompanyForVerificationAction, connectSyntageAction } from '@/app/actions/dashboard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2, Lock, ArrowLeft } from 'lucide-react'

type Estado = 'idle' | 'loading' | 'success' | 'error'

interface CompanyData {
  id: string
  rfc: string
  nombreRazonSocial: string
}

export default function VerificacionFiscalDashboardPage() {
  const router = useRouter()

  const [company, setCompany] = useState<CompanyData | null>(null)
  const [ciec, setCiec] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loadingCompany, setLoadingCompany] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    async function fetchCompany() {
      const result = await getCompanyForVerificationAction()
      if ('error' in result) {
        router.push('/dashboard')
        return
      }
      if (result.company.syntageValidatedAt) {
        router.push('/dashboard')
        return
      }
      setCompany(result.company)
      setLoadingCompany(false)
    }
    fetchCompany()
  }, [])

  async function handleConectar(e: React.FormEvent) {
    e.preventDefault()
    if (!company) return

    setEstado('loading')
    setErrorMsg(null)

    const result = await connectSyntageAction(company.rfc, ciec, company.id)

    if ('error' in result) {
      setEstado('error')
      setErrorMsg(result.error ?? null)
      return
    }

    setEstado('success')
  }

  function handleReintentar() {
    setCiec('')
    setErrorMsg(null)
    setEstado('idle')
  }

  if (loadingCompany) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0F2D5E]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-bold text-[#0F2D5E]">
            Accesa<span className="text-[#00C896]">X</span>
          </span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0F172A]">Verificación fiscal</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Conecta tu empresa con el SAT para desbloquear todas las funciones de AccesaX.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">

          {(estado === 'idle' || estado === 'loading') && (
            <form onSubmit={handleConectar} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#0F172A]">RFC</Label>
                <Input
                  value={company?.rfc ?? ''}
                  disabled
                  className="h-11 font-mono tracking-wider bg-slate-50 text-[#64748B]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ciec" className="text-sm font-medium text-[#0F172A]">
                  CIEC — Contraseña SAT
                </Label>
                <Input
                  id="ciec"
                  type="password"
                  placeholder="Tu contraseña del portal sat.gob.mx"
                  value={ciec}
                  onChange={(e) => setCiec(e.target.value)}
                  required
                  disabled={estado === 'loading'}
                  className="h-11"
                  autoComplete="current-password"
                />
              </div>

              <div className="flex gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <Lock className="h-4 w-4 text-[#64748B] mt-0.5 shrink-0" />
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Tus credenciales se transmiten de forma segura y{' '}
                  <span className="font-medium text-[#0F172A]">
                    no se almacenan en nuestros servidores
                  </span>
                  . Solo se utiliza la conexión temporal con el SAT.
                </p>
              </div>

              {estado === 'loading' && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                  <p className="text-sm text-blue-700">
                    Conectando con el SAT… puede tomar hasta 30 segundos
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-[#0F2D5E] hover:bg-[#0F2D5E]/90 text-white font-medium"
                disabled={estado === 'loading' || !ciec}
              >
                {estado === 'loading' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Conectar con el SAT
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full h-10 text-[#64748B] hover:text-[#0F172A] text-sm"
                disabled={estado === 'loading'}
                onClick={() => router.push('/dashboard')}
              >
                Volver al dashboard
              </Button>
            </form>
          )}

          {estado === 'success' && (
            <div className="space-y-5">
              <div className="flex gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
                <CheckCircle2 className="h-5 w-5 text-[#00C896] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Verificación exitosa
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Tu situación fiscal fue validada correctamente ante el SAT.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full h-11 bg-[#00C896] hover:bg-[#00C896]/90 text-white font-medium"
              >
                Ir al dashboard
              </Button>
            </div>
          )}

          {estado === 'error' && (
            <div className="space-y-5">
              <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    No se pudo verificar
                  </p>
                  <p className="text-sm text-red-600 mt-0.5">
                    {errorMsg}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleReintentar}
                variant="outline"
                className="w-full h-11 border-[#0F2D5E] text-[#0F2D5E] hover:bg-[#0F2D5E]/5 font-medium"
              >
                Reintentar
              </Button>

              <Button
                variant="ghost"
                className="w-full h-10 text-[#64748B] hover:text-[#0F172A] text-sm"
                onClick={() => router.push('/dashboard')}
              >
                Volver al dashboard
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
