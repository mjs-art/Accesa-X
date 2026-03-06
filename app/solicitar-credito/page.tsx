'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCompanyForVerificationAction, getAnalyzedContractsAction, submitCreditApplicationAction } from '@/app/actions/dashboard'
import type { AnalyzedContract } from '@/app/actions/dashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type TipoCredito = 'empresarial' | 'factoraje' | 'contrato'

// ── Datos estáticos ────────────────────────────────────────────────────────────
const TIPOS: { id: TipoCredito; emoji: string; titulo: string; descripcion: string }[] = [
  {
    id: 'empresarial',
    emoji: '💼',
    titulo: 'Crédito empresarial',
    descripcion: 'Capital de trabajo general para las operaciones de tu empresa',
  },
  {
    id: 'factoraje',
    emoji: '📄',
    titulo: 'Factoraje',
    descripcion: 'Adelanto inmediato de tus facturas emitidas a clientes',
  },
  {
    id: 'contrato',
    emoji: '📋',
    titulo: 'Crédito por contrato',
    descripcion: 'Financiamiento respaldado por un contrato específico ya analizado',
  },
]

const PLAZOS = [3, 6, 12, 18, 24]

const TIPO_LABELS: Record<TipoCredito, string> = {
  empresarial: 'Crédito empresarial',
  factoraje: 'Factoraje',
  contrato: 'Crédito por contrato',
}

// ── Stepper ────────────────────────────────────────────────────────────────────
function Stepper({ current }: { current: number }) {
  const steps = ['Tipo de crédito', 'Detalles', 'Confirmación']
  return (
    <div className="flex items-start justify-center mb-10">
      {steps.map((label, i) => (
        <div key={i} className="flex items-start">
          <div className="flex flex-col items-center gap-2">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                i < current
                  ? 'bg-[#00C896] text-white'
                  : i === current
                  ? 'bg-[#0F2D5E] text-white ring-4 ring-[#0F2D5E]/10'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium whitespace-nowrap ${
                i === current ? 'text-[#0F172A]' : 'text-[#64748B]'
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-20 sm:w-28 h-px mt-4 mx-3 transition-all ${
                i < current ? 'bg-[#00C896]' : 'bg-slate-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatMXN(value: string) {
  const num = parseFloat(value.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return value
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(num)
}

function getFileName(path: string) {
  return path.split('/').pop() ?? path
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function SolicitarCreditoPage() {
  const router = useRouter()
  const { toast } = useToast()

  // Wizard state
  const [step, setStep] = useState(0)
  const [tipo, setTipo] = useState<TipoCredito | null>(null)
  const [monto, setMonto] = useState('')
  const [plazo, setPlazo] = useState('')
  const [destino, setDestino] = useState('')
  const [contractId, setContractId] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Data
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [contratos, setContratos] = useState<AnalyzedContract[]>([])
  const [loadingContratos, setLoadingContratos] = useState(false)

  // Cargar empresa al montar
  useEffect(() => {
    async function init() {
      const result = await getCompanyForVerificationAction()
      if ('error' in result) { router.push('/'); return }
      setCompanyId(result.company.id)
    }
    init()
  }, [])

  // Cargar contratos analizados cuando se elige "contrato"
  useEffect(() => {
    if (tipo !== 'contrato' || !companyId) return
    setLoadingContratos(true)
    getAnalyzedContractsAction(companyId).then(({ contracts }) => {
      setContratos(contracts)
      setLoadingContratos(false)
    })
  }, [tipo, companyId])

  // ── Validaciones por paso ──────────────────────────────────────────────────
  const canGoNext = () => {
    if (step === 0) return tipo !== null
    if (step === 1) {
      const montoNum = parseFloat(monto.replace(/[^0-9.]/g, ''))
      const ok = !isNaN(montoNum) && montoNum > 0 && plazo !== '' && destino.trim().length >= 10
      if (tipo === 'contrato') return ok && contractId !== ''
      return ok
    }
    return false
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!confirmado || !companyId || !tipo) return
    setSubmitting(true)

    const montoNum = parseFloat(monto.replace(/[^0-9.]/g, ''))

    const result = await submitCreditApplicationAction({
      companyId,
      tipoCredito: tipo,
      montoSolicitado: montoNum,
      plazoMeses: parseInt(plazo),
      destino: destino.trim(),
      contractId: tipo === 'contrato' && contractId ? contractId : null,
    })

    if ('error' in result) {
      toast({ title: 'Error al enviar', description: result.error, variant: 'destructive' })
      setSubmitting(false)
      return
    }

    toast({
      title: '✅ Solicitud enviada',
      description: 'Te contactaremos en 2-3 días hábiles.',
    })
    router.push('/dashboard')
  }

  const selectedContrato = contratos.find((c) => c.id === contractId)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step > 0 ? setStep(step - 1) : router.push('/dashboard'))}
            className="text-[#64748B] hover:text-[#0F2D5E] -ml-2"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {step > 0 ? 'Anterior' : 'Volver'}
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-xl font-bold text-[#0F2D5E]">
            Accesa<span className="text-[#00C896]">X</span>
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#0F172A]">Solicitar crédito</h1>
          <p className="text-sm text-[#64748B] mt-1">Completa los pasos para enviar tu solicitud</p>
        </div>

        <Stepper current={step} />

        {/* ── PASO 1: Tipo de crédito ─────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTipo(t.id)}
                className={`w-full text-left rounded-2xl border-2 p-5 transition-all ${
                  tipo === t.id
                    ? 'border-[#0F2D5E] bg-[#0F2D5E]/5 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{t.emoji}</span>
                  <div className="flex-1">
                    <p className={`font-semibold text-base ${tipo === t.id ? 'text-[#0F2D5E]' : 'text-[#0F172A]'}`}>
                      {t.titulo}
                    </p>
                    <p className="text-sm text-[#64748B] mt-0.5">{t.descripcion}</p>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      tipo === t.id ? 'border-[#0F2D5E] bg-[#0F2D5E]' : 'border-slate-300'
                    }`}
                  >
                    {tipo === t.id && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
              </button>
            ))}

            <Button
              onClick={() => setStep(1)}
              disabled={!canGoNext()}
              className="w-full h-11 mt-2 bg-[#0F2D5E] hover:bg-[#0F2D5E]/90 text-white font-medium"
            >
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── PASO 2: Detalles ────────────────────────────────────────────── */}
        {step === 1 && (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6 space-y-5">

              {/* Monto */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#0F172A]">Monto solicitado</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#64748B] font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="500,000"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="w-full h-11 pl-7 pr-16 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F2D5E]/20 focus:border-[#0F2D5E]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748B]">MXN</span>
                </div>
                {monto && !isNaN(parseFloat(monto)) && (
                  <p className="text-xs text-[#64748B]">{formatMXN(monto)}</p>
                )}
              </div>

              {/* Plazo */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#0F172A]">Plazo deseado</Label>
                <div className="flex flex-wrap gap-2">
                  {PLAZOS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlazo(String(p))}
                      className={`h-10 px-4 rounded-lg text-sm font-medium border-2 transition-all ${
                        plazo === String(p)
                          ? 'border-[#0F2D5E] bg-[#0F2D5E] text-white'
                          : 'border-slate-200 bg-white text-[#0F172A] hover:border-slate-300'
                      }`}
                    >
                      {p} meses
                    </button>
                  ))}
                </div>
              </div>

              {/* Contrato (solo si tipo = 'contrato') */}
              {tipo === 'contrato' && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#0F172A]">Contrato de respaldo</Label>
                  {loadingContratos ? (
                    <div className="flex items-center gap-2 h-11 px-3 border border-slate-200 rounded-lg bg-slate-50">
                      <Loader2 className="h-4 w-4 animate-spin text-[#64748B]" />
                      <span className="text-sm text-[#64748B]">Cargando contratos...</span>
                    </div>
                  ) : contratos.length === 0 ? (
                    <div className="h-11 px-3 flex items-center border border-amber-200 bg-amber-50 rounded-lg">
                      <span className="text-sm text-amber-700">No tienes contratos analizados. Sube y analiza uno primero.</span>
                    </div>
                  ) : (
                    <select
                      value={contractId}
                      onChange={(e) => setContractId(e.target.value)}
                      className="w-full h-11 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F2D5E]/20 focus:border-[#0F2D5E]"
                    >
                      <option value="">Selecciona un contrato...</option>
                      {contratos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombreCliente} — {getFileName(c.storagePath)}
                          {c.montoContrato ? ` (${formatMXN(String(c.montoContrato))})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Destino */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#0F172A]">Destino del crédito</Label>
                <textarea
                  placeholder="¿Para qué usarás el dinero? Describe brevemente el destino del crédito..."
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F2D5E]/20 focus:border-[#0F2D5E] resize-none"
                />
                <p className="text-xs text-[#64748B]">{destino.trim().length}/10 caracteres mínimo</p>
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!canGoNext()}
                className="w-full h-11 bg-[#0F2D5E] hover:bg-[#0F2D5E]/90 text-white font-medium"
              >
                Continuar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── PASO 3: Confirmación ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider">
                  Resumen de tu solicitud
                </h3>

                <div className="space-y-3">
                  <SummaryRow label="Tipo de crédito" value={TIPO_LABELS[tipo!]} />
                  <SummaryRow label="Monto solicitado" value={formatMXN(monto)} highlight />
                  <SummaryRow label="Plazo" value={`${plazo} meses`} />
                  {tipo === 'contrato' && selectedContrato && (
                    <SummaryRow
                      label="Contrato de respaldo"
                      value={`${selectedContrato.nombreCliente} — ${getFileName(selectedContrato.storagePath)}`}
                    />
                  )}
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs font-medium text-[#64748B] mb-1">Destino del crédito</p>
                    <p className="text-sm text-[#0F172A] leading-relaxed bg-slate-50 rounded-lg p-3">{destino}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Checkbox confirmación */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="h-4 w-4 mt-0.5 accent-[#0F2D5E] cursor-pointer"
              />
              <span className="text-sm text-[#64748B] leading-relaxed">
                Confirmo que la información proporcionada es correcta y autorizo a AccesaX a
                procesar mi solicitud de crédito.
              </span>
            </label>

            <Button
              onClick={handleSubmit}
              disabled={!confirmado || submitting}
              className="w-full h-11 bg-[#00C896] hover:bg-[#00C896]/90 text-white font-semibold"
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
              ) : (
                'Enviar solicitud'
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Row de resumen ─────────────────────────────────────────────────────────────
function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-[#64748B]">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-[#0F2D5E] text-base' : 'text-[#0F172A]'}`}>
        {value}
      </span>
    </div>
  )
}
