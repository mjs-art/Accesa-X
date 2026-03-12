'use client'

import { useEffect, useState } from 'react'
import { getAnalisisAction } from '@/app/actions/inteligencia'
import type { AnalisisData } from '@/app/actions/inteligencia'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Loader2, RefreshCw, TrendingUp, TrendingDown, Clock, AlertCircle,
  CheckCircle2, AlertTriangle, XCircle, Wallet, Users, ArrowDownRight, ArrowUpRight,
} from 'lucide-react'
import { SyncBanner } from '@/components/inteligencia/SyncBanner'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

type Status = 'verde' | 'amarillo' | 'rojo'

function statusColors(s: Status) {
  if (s === 'verde') return { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Saludable' }
  if (s === 'amarillo') return { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Atención' }
  return { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: 'Riesgo' }
}

function StatusDot({ status }: { status: Status }) {
  const c = statusColors(status)
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

function HealthCard({
  title, value, unit, status, description, icon,
}: {
  title: string
  value: string | number
  unit?: string
  status: Status
  description: string
  icon: React.ReactNode
}) {
  const c = statusColors(status)
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} px-5 py-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-white/70`}>{icon}</div>
        <StatusDot status={status} />
      </div>
      <p className="text-xs font-semibold text-[#6B7280]">{title}</p>
      <p className="text-2xl font-bold text-[#1A1A1A] mt-1">
        {value}{unit && <span className="text-sm font-medium text-[#6B7280] ml-1">{unit}</span>}
      </p>
      <p className="text-xs text-[#6B7280] mt-1">{description}</p>
    </div>
  )
}

function overallStatus(data: AnalisisData): Status {
  const statuses = [data.dsoStatus, data.dpoStatus, data.concentracionStatus, data.ratioStatus]
  if (statuses.filter(s => s === 'rojo').length >= 2) return 'rojo'
  if (statuses.some(s => s === 'rojo') || statuses.filter(s => s === 'amarillo').length >= 2) return 'amarillo'
  return 'verde'
}

const StatusIcon = ({ status }: { status: Status }) => {
  if (status === 'verde') return <CheckCircle2 className="h-8 w-8 text-emerald-500" />
  if (status === 'amarillo') return <AlertTriangle className="h-8 w-8 text-amber-500" />
  return <XCircle className="h-8 w-8 text-red-500" />
}

const overallLabel = {
  verde: { title: 'Negocio saludable', sub: 'Tus indicadores financieros están en buen estado.', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  amarillo: { title: 'Algunos indicadores requieren atención', sub: 'Revisa los indicadores marcados antes de solicitar financiamiento.', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  rojo: { title: 'Indicadores de riesgo detectados', sub: 'Mejora tus indicadores para acceder a mejores condiciones de crédito.', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
}

export default function AnalisisPage() {
  const [data, setData] = useState<AnalisisData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await getAnalisisAction()
    if (!('error' in res)) setData(res)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const overall = data ? overallStatus(data) : 'verde'
  const ol = overallLabel[overall]

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A1A1A]">Inteligencia — Análisis del negocio</span>
        <button onClick={load} disabled={loading} className="text-[#6B7280] hover:text-[#1A1A1A] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Análisis del negocio</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Indicadores clave para evaluar la salud financiera de tu empresa</p>
        </div>

        <SyncBanner showWhenEmpty={!data?.synced} />

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[#3CBEDB]" />
          </div>
        ) : !data?.synced ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <RefreshCw className="h-10 w-10 text-slate-300 mb-4" />
            <p className="text-sm font-medium text-[#1A1A1A]">Sin datos sincronizados</p>
            <p className="text-xs text-[#6B7280] mt-1 max-w-xs">Sincroniza tu información del SAT desde el Resumen financiero para ver tu análisis.</p>
          </div>
        ) : (
          <>
            {/* Banner de salud general */}
            <div className={`rounded-xl border ${ol.border} ${ol.bg} px-5 py-4 flex items-center gap-4`}>
              <StatusIcon status={overall} />
              <div>
                <p className={`text-sm font-semibold ${ol.text}`}>{ol.title}</p>
                <p className={`text-xs mt-0.5 ${ol.text} opacity-80`}>{ol.sub}</p>
              </div>
            </div>

            {/* Indicadores de salud — 4 cards */}
            <div>
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">Indicadores de salud</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <HealthCard
                  title="DSO — Días de cobro"
                  value={data.dso}
                  unit="días"
                  status={data.dsoStatus}
                  description="Tiempo promedio para cobrar facturas emitidas"
                  icon={<Clock className="h-4 w-4 text-[#3CBEDB]" />}
                />
                <HealthCard
                  title="DPO — Días de pago"
                  value={data.dpo}
                  unit="días"
                  status={data.dpoStatus}
                  description="Tiempo promedio para pagar a proveedores"
                  icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
                />
                <HealthCard
                  title="Concentración top cliente"
                  value={data.concentracionTop}
                  unit="%"
                  status={data.concentracionStatus}
                  description={data.topClienteNombre}
                  icon={<Users className="h-4 w-4 text-violet-500" />}
                />
                <HealthCard
                  title="Ratio gastos / ingresos"
                  value={data.ratioGastos}
                  unit="%"
                  status={data.ratioStatus}
                  description={`Ingresos ${formatMXN(data.ingresosMes)} · Gastos ${formatMXN(data.gastosMes)}`}
                  icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
                />
              </div>
            </div>

            {/* Capital de trabajo */}
            <div>
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">Capital de trabajo neto</h2>
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      <p className="text-xs text-[#6B7280] font-medium">Por cobrar (CxC)</p>
                    </div>
                    <p className="text-xl font-bold text-[#1A1A1A]">{formatMXN(data.totalPorCobrar)}</p>
                    <p className="text-xs text-[#6B7280] mt-1">Facturas emitidas sin cobrar</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowDownRight className="h-4 w-4 text-amber-500" />
                      <p className="text-xs text-[#6B7280] font-medium">Por pagar (CxP)</p>
                    </div>
                    <p className="text-xl font-bold text-[#1A1A1A]">{formatMXN(data.totalPorPagar)}</p>
                    <p className="text-xs text-[#6B7280] mt-1">Facturas recibidas sin pagar</p>
                  </CardContent>
                </Card>
                <Card className={`shadow-sm ${data.capitalTrabajo >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className={`h-4 w-4 ${data.capitalTrabajo >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                      <p className="text-xs text-[#6B7280] font-medium">Capital de trabajo neto</p>
                    </div>
                    <p className={`text-xl font-bold ${data.capitalTrabajo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatMXN(data.capitalTrabajo)}
                    </p>
                    <p className="text-xs text-[#6B7280] mt-1">CxC − CxP</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Flujo proyectado */}
            <div>
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">Flujo de efectivo proyectado</h2>
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-[#6B7280] font-medium">Entradas esperadas por cobrar vs compromisos de pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Próximos 30 días', entradas: data.entradas30, color: 'text-emerald-600' },
                      { label: 'Próximos 60 días', entradas: data.entradas60, color: 'text-emerald-600' },
                      { label: 'Próximos 90 días', entradas: data.entradas90, color: 'text-emerald-600' },
                      { label: 'Compromisos de pago', entradas: data.totalPorPagar, color: 'text-amber-600' },
                    ].map((item) => (
                      <div key={item.label} className="text-center py-4 border border-slate-100 rounded-xl bg-slate-50">
                        <p className="text-xs text-[#6B7280] font-medium mb-2">{item.label}</p>
                        <p className={`text-lg font-bold ${item.color}`}>{formatMXN(item.entradas)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Barra comparativa */}
                  <div className="mt-5 space-y-3">
                    {[
                      { label: 'Entradas 30d', value: data.entradas30, max: Math.max(data.entradas90, data.totalPorPagar, 1), color: 'bg-emerald-400' },
                      { label: 'Entradas 90d', value: data.entradas90, max: Math.max(data.entradas90, data.totalPorPagar, 1), color: 'bg-emerald-300' },
                      { label: 'Compromisos', value: data.totalPorPagar, max: Math.max(data.entradas90, data.totalPorPagar, 1), color: 'bg-amber-400' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="text-xs text-[#6B7280] w-24 shrink-0">{item.label}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.color} rounded-full transition-all`}
                            style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[#1A1A1A] w-28 text-right shrink-0">{formatMXN(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Nota de uso */}
            <div className="flex items-start gap-3 bg-[#3CBEDB]/5 border border-[#3CBEDB]/20 rounded-xl px-5 py-4">
              <TrendingUp className="h-4 w-4 text-[#3CBEDB] mt-0.5 shrink-0" />
              <p className="text-xs text-[#6B7280]">
                Este análisis es utilizado por <span className="font-semibold text-[#1A1A1A]">AccesaX</span> para evaluar tu perfil de financiamiento.
                Mantén tus datos sincronizados con el SAT para acceder a mejores condiciones de crédito.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
