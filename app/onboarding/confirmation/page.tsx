'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getOnboardingSummaryAction, completeOnboardingAction } from '@/app/actions/onboarding'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, AlertCircle, Building2, FileText, Users, ShieldCheck } from 'lucide-react'

interface Summary {
  companyName: string
  companyId: string
  satVerificado: boolean
  legalRepRegistrado: boolean
  accionistasRegistrados: boolean
  documentosCargados: boolean
}

function StatusBadge({ done, doneLabel, skipLabel }: { done: boolean; doneLabel: string; skipLabel: string }) {
  if (done) {
    return <span className="text-sm font-medium text-emerald-700">{doneLabel}</span>
  }
  return <span className="text-sm font-medium text-amber-600">{skipLabel}</span>
}

export default function ConfirmationPage() {
  return <Suspense><ConfirmationPageInner /></Suspense>
}

function ConfirmationPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPerfil = searchParams.get('from') === 'perfil'

  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getOnboardingSummaryAction().then((result) => {
      if ('error' in result || !result.summary) {
        router.push('/onboarding/empresa')
        return
      }
      setSummary(result.summary)
      setLoadingInit(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleComplete() {
    if (!summary) return
    setSubmitting(true)
    setError(null)

    const result = await completeOnboardingAction(summary.companyId)

    if (result.error) {
      setError(result.error as string)
      setSubmitting(false)
      return
    }

    router.push('/dashboard')
  }

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#0F2D5E]" />
      </div>
    )
  }

  const allComplete = summary!.satVerificado &&
    summary!.legalRepRegistrado &&
    summary!.accionistasRegistrados &&
    summary!.documentosCargados

  const pendingCount = [
    summary!.satVerificado,
    summary!.legalRepRegistrado,
    summary!.accionistasRegistrados,
    summary!.documentosCargados,
  ].filter(Boolean).length

  return (
    <>
      {!fromPerfil && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#0F2D5E]">Paso 7 de 7</span>
            <span className="text-sm text-[#64748B]">Confirmación</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#00C896] transition-all" style={{ width: '100%' }} />
          </div>
        </div>
      )}

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center h-14 w-14 rounded-full mb-4 ${allComplete ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            {allComplete
              ? <CheckCircle2 className="h-7 w-7 text-[#00C896]" />
              : <AlertCircle className="h-7 w-7 text-amber-500" />
            }
          </div>
          <h1 className="text-xl font-semibold text-[#0F172A]">
            {allComplete ? 'Todo listo para enviar' : 'Resumen de tu solicitud'}
          </h1>
          <p className="text-sm text-[#64748B] mt-1 max-w-sm mx-auto">
            {allComplete
              ? 'Revisa el resumen y envíala para iniciar el proceso de evaluación.'
              : `Completaste ${pendingCount} de 4 secciones. Puedes enviar ahora o regresar a completar lo pendiente.`
            }
          </p>
        </div>

        {/* Summary */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200 mb-8">
          {/* Empresa — siempre completa si llegaron aquí */}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Building2 className="h-4 w-4 text-[#0F2D5E] shrink-0" />
            <div className="flex-1 flex items-center justify-between gap-4">
              <span className="text-sm text-[#64748B]">Empresa</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#0F172A] text-right">{summary!.companyName}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-[#00C896] shrink-0" />
              </div>
            </div>
          </div>

          {/* Verificación fiscal */}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <ShieldCheck className={`h-4 w-4 shrink-0 ${summary!.satVerificado ? 'text-[#0F2D5E]' : 'text-slate-400'}`} />
            <div className="flex-1 flex items-center justify-between gap-4">
              <span className="text-sm text-[#64748B]">Verificación fiscal (SAT)</span>
              <div className="flex items-center gap-1.5">
                <StatusBadge
                  done={summary!.satVerificado}
                  doneLabel="Verificado"
                  skipLabel="Omitida"
                />
                {summary!.satVerificado
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-[#00C896] shrink-0" />
                  : <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                }
              </div>
            </div>
          </div>

          {/* Representante legal */}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Users className={`h-4 w-4 shrink-0 ${summary!.legalRepRegistrado ? 'text-[#0F2D5E]' : 'text-slate-400'}`} />
            <div className="flex-1 flex items-center justify-between gap-4">
              <span className="text-sm text-[#64748B]">Representante legal</span>
              <div className="flex items-center gap-1.5">
                <StatusBadge
                  done={summary!.legalRepRegistrado}
                  doneLabel="Registrado"
                  skipLabel="Omitido"
                />
                {summary!.legalRepRegistrado
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-[#00C896] shrink-0" />
                  : <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                }
              </div>
            </div>
          </div>

          {/* Accionistas */}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Users className={`h-4 w-4 shrink-0 ${summary!.accionistasRegistrados ? 'text-[#0F2D5E]' : 'text-slate-400'}`} />
            <div className="flex-1 flex items-center justify-between gap-4">
              <span className="text-sm text-[#64748B]">Accionistas</span>
              <div className="flex items-center gap-1.5">
                <StatusBadge
                  done={summary!.accionistasRegistrados}
                  doneLabel="Registrados"
                  skipLabel="Omitidos"
                />
                {summary!.accionistasRegistrados
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-[#00C896] shrink-0" />
                  : <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                }
              </div>
            </div>
          </div>

          {/* Documentos */}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <FileText className={`h-4 w-4 shrink-0 ${summary!.documentosCargados ? 'text-[#0F2D5E]' : 'text-slate-400'}`} />
            <div className="flex-1 flex items-center justify-between gap-4">
              <span className="text-sm text-[#64748B]">Documentos</span>
              <div className="flex items-center gap-1.5">
                <StatusBadge
                  done={summary!.documentosCargados}
                  doneLabel="Cargados"
                  skipLabel="Omitidos"
                />
                {summary!.documentosCargados
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-[#00C896] shrink-0" />
                  : <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                }
              </div>
            </div>
          </div>
        </div>

        {/* Aviso qué sigue — condicional */}
        <div className={`rounded-xl px-5 py-4 mb-6 ${allComplete ? 'bg-blue-50 border border-blue-100' : 'bg-amber-50 border border-amber-100'}`}>
          <p className={`text-sm leading-relaxed ${allComplete ? 'text-blue-700' : 'text-amber-700'}`}>
            {allComplete ? (
              <>
                <span className="font-semibold">¿Qué sigue?</span> Un asesor revisará tu expediente en un plazo de{' '}
                <span className="font-medium">1 a 3 días hábiles</span> y se pondrá en contacto contigo.
              </>
            ) : (
              <>
                <span className="font-semibold">Importante:</span> Tu solicitud fue recibida, pero{' '}
                <span className="font-semibold">no podrá ser evaluada</span> por un asesor hasta que completes
                la información faltante. Puedes hacerlo en cualquier momento desde tu perfil en el dashboard.
              </>
            )}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <Button
          onClick={handleComplete}
          disabled={submitting}
          className="w-full h-11 bg-[#00C896] hover:bg-[#00C896]/90 text-white font-medium"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            'Enviar solicitud y acceder al dashboard'
          )}
        </Button>
      </div>
    </>
  )
}
