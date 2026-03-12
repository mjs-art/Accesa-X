'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { advanceToStepAction } from '@/app/actions/onboarding'
import { getCompanyForVerificationAction, connectSyntageAction } from '@/app/actions/dashboard'
import { triggerSyncAction, getSyncJobByIdAction } from '@/app/actions/sync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldCheck, AlertCircle, Lock } from 'lucide-react'
import { SyncProgress } from '@/components/inteligencia/SyncProgress'
import type { SyncJob } from '@/features/inteligencia/types/inteligencia.types'

type Estado = 'idle' | 'loading' | 'success' | 'error'

interface CompanyData {
  id: string
  rfc: string
  nombreRazonSocial: string
}

export default function VerificacionFiscalPage() {
  return <Suspense><VerificacionFiscalPageInner /></Suspense>
}

function VerificacionFiscalPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPerfil = searchParams.get('from') === 'perfil'

  const [company, setCompany]               = useState<CompanyData | null>(null)
  const [ciec, setCiec]                     = useState('')
  const [estado, setEstado]                 = useState<Estado>('idle')
  const [errorMsg, setErrorMsg]             = useState<string | null>(null)
  const [loadingCompany, setLoadingCompany] = useState(true)
  const [syncJob, setSyncJob]               = useState<SyncJob | null>(null)
  const [syncCompleted, setSyncCompleted]   = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    async function fetchCompany() {
      const result = await getCompanyForVerificationAction()
      if ('error' in result) {
        router.push('/onboarding/empresa')
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

    // Si syntage-connect ya retornó un jobId, usar ese directamente
    const jobId = (result as { jobId?: string }).jobId
    if (jobId) {
      const jobResult = await getSyncJobByIdAction(jobId)
      if ('id' in jobResult) {
        setSyncJob(jobResult)
        return
      }
    }

    // Fallback: disparar sync explícitamente
    const syncResult = await triggerSyncAction()
    if ('jobId' in syncResult) {
      const jobResult = await getSyncJobByIdAction(syncResult.jobId)
      if ('id' in jobResult) setSyncJob(jobResult)
    }
  }

  async function handleSaltar() {
    if (company) {
      await advanceToStepAction(company.id, 'legal-rep')
    }
    router.push(fromPerfil ? '/dashboard/perfil' : '/onboarding/legal-rep')
  }

  function handleReintentar() {
    setCiec('')
    setErrorMsg(null)
    setEstado('idle')
  }

  async function handleContinuar() {
    if (company) await advanceToStepAction(company.id, 'legal-rep')
    router.push(fromPerfil ? '/dashboard/perfil' : '/onboarding/legal-rep')
  }

  if (loadingCompany) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#1A1A1A]" />
      </div>
    )
  }

  return (
    <>
      {!fromPerfil && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#1A1A1A]">Paso 2 de 7</span>
            <span className="text-sm text-[#6B7280]">Verificación fiscal</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#3CBEDB] transition-all"
              style={{ width: '28%' }}
            />
          </div>
        </div>
      )}

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#1A1A1A]">
            Conecta tu empresa con el SAT
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Verificamos tu situación fiscal en tiempo real para ofrecerte las mejores condiciones de crédito.
          </p>
        </div>

        {/* Estado: idle o loading */}
        {(estado === 'idle' || estado === 'loading') && (
          <form onSubmit={handleConectar} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#1A1A1A]">RFC</Label>
              <Input
                value={company?.rfc ?? ''}
                disabled
                className="h-11 font-mono tracking-wider bg-slate-50 text-[#6B7280]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ciec" className="text-sm font-medium text-[#1A1A1A]">
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
              <Lock className="h-4 w-4 text-[#6B7280] mt-0.5 shrink-0" />
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Tus credenciales se transmiten de forma segura y{' '}
                <span className="font-medium text-[#1A1A1A]">
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
              className="w-full h-11 bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white font-medium"
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
              className="w-full h-10 text-[#6B7280] hover:text-[#1A1A1A] text-sm"
              disabled={estado === 'loading'}
              onClick={handleSaltar}
            >
              Saltar verificación por ahora
            </Button>
          </form>
        )}

        {/* Estado: success — verificación ok + progreso de sync */}
        {estado === 'success' && (
          <div className="space-y-5">
            {syncJob ? (
              <SyncProgress
                initialJob={syncJob}
                onCompleted={() => setSyncCompleted(true)}
              />
            ) : (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500 shrink-0" />
                <p className="text-sm text-emerald-700">
                  Verificación exitosa — iniciando sincronización de datos...
                </p>
              </div>
            )}

            {/* Continuar siempre disponible — la sync corre en background */}
            <Button
              onClick={handleContinuar}
              className="w-full h-11 bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white font-medium"
            >
              {syncCompleted ? 'Continuar' : 'Continuar al siguiente paso'}
            </Button>

            {!syncCompleted && (
              <p className="text-xs text-center text-[#6B7280]">
                Puedes continuar el registro — tus datos fiscales se sincronizan en segundo plano.
              </p>
            )}
          </div>
        )}

        {/* Estado: error */}
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
              className="w-full h-11 border-[#3CBEDB] text-[#1A1A1A] hover:bg-[#3CBEDB]/5 font-medium"
            >
              Reintentar
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
