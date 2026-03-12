'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCarteraAction } from '@/app/actions/admin'
import type { CarteraItem } from '@/app/actions/admin'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Loader2, TrendingUp, DollarSign, Clock } from 'lucide-react'

// ── Config visual ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  aprobado:         { label: 'Aprobado',         classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  fondos_liberados: { label: 'Fondos liberados', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  en_ejecucion:     { label: 'En ejecución',     classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  liquidado:        { label: 'Liquidado',        classes: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const TIPO_LABELS: Record<string, string> = { proyecto: 'Proyecto', factoraje: 'Factoraje' }

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function formatDateShort(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function diasTranscurridos(fecha: string | null): number | null {
  if (!fecha) return null
  return Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24))
}

function isVencido(item: CarteraItem): boolean {
  if (!item.fechaLiquidacionEst) return false
  if (item.status === 'liquidado') return false
  return new Date(item.fechaLiquidacionEst) < new Date()
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function AdminCarteraPage() {
  const router = useRouter()
  const [cartera, setCartera] = useState<CarteraItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCartera() }, [])

  async function fetchCartera() {
    setLoading(true)
    const result = await getCarteraAction()
    if ('cartera' in result) setCartera(result.cartera)
    setLoading(false)
  }

  const filtered = filtroStatus === 'todos'
    ? cartera
    : cartera.filter(c => c.status === filtroStatus)

  const activas = cartera.filter(c => ['fondos_liberados', 'en_ejecucion'].includes(c.status))
  const vencidas = cartera.filter(isVencido)
  const carteraTotal = activas.reduce((s, c) => s + (c.montoDisperso ?? c.montoSolicitado), 0)
  const pendienteDispersar = cartera.filter(c => c.status === 'aprobado').reduce((s, c) => s + c.montoSolicitado, 0)

  return (
    <div className="px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Cartera activa</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{cartera.length} créditos aprobados o en curso</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4 text-[#3CBEDB]" />}
          label="Cartera activa"
          value={formatMXN(carteraTotal)}
          sub={`${activas.length} créditos en ejecución`}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
          label="Pendiente dispersar"
          value={formatMXN(pendienteDispersar)}
          sub={`${cartera.filter(c => c.status === 'aprobado').length} aprobados`}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4 text-indigo-500" />}
          label="En ejecución"
          value={String(cartera.filter(c => c.status === 'en_ejecucion').length)}
          sub="proyectos activos"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          label="Vencidos"
          value={String(vencidas.length)}
          sub="sin liquidar en fecha est."
          highlight={vencidas.length > 0}
        />
      </div>

      {/* Alerta de vencidos */}
      {vencidas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {vencidas.length} crédito{vencidas.length > 1 ? 's' : ''} vencido{vencidas.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {vencidas.map(v => v.empresa).join(', ')} — fecha de liquidación estimada superada
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { value: 'todos', label: 'Todos' },
          { value: 'aprobado', label: 'Aprobados' },
          { value: 'fondos_liberados', label: 'Fondos liberados' },
          { value: 'en_ejecucion', label: 'En ejecución' },
          { value: 'liquidado', label: 'Liquidados' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFiltroStatus(f.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              filtroStatus === f.value
                ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]'
                : 'bg-white text-[#6B7280] border-slate-200 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[#6B7280]">Sin créditos con este filtro.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Empresa', 'Tipo', 'Monto solicitado', 'Monto dispersado', 'Referencia', 'Dispersión', 'Liq. estimada', 'Días', 'Estado'].map(h => (
                  <th key={h} className="text-xs font-semibold text-[#6B7280] text-left px-4 py-3 first:pl-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(item => {
                const vencido = isVencido(item)
                const dias = diasTranscurridos(item.fechaDesembolso)
                const sc = STATUS_CONFIG[item.status] ?? { label: item.status, classes: 'bg-slate-100 text-slate-600 border-slate-200' }

                return (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`/admin/solicitudes/${item.id}`)}
                    className={`cursor-pointer transition-colors ${vencido ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-slate-50/60'}`}
                  >
                    <td className="px-4 py-3 pl-6">
                      <p className="text-sm font-semibold text-[#1A1A1A]">{item.empresa}</p>
                      <p className="text-xs text-[#6B7280] font-mono">{item.rfc}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B7280]">{TIPO_LABELS[item.tipoCredito] ?? item.tipoCredito}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[#1A1A1A]">{formatMXN(item.montoSolicitado)}</td>
                    <td className="px-4 py-3 text-sm text-[#1A1A1A]">
                      {item.montoDisperso != null ? formatMXN(item.montoDisperso) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-[#6B7280]">
                      {item.referenciaDesembolso ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B7280]">{formatDateShort(item.fechaDesembolso)}</td>
                    <td className={`px-4 py-3 text-xs font-medium ${vencido ? 'text-red-600' : 'text-[#6B7280]'}`}>
                      {formatDateShort(item.fechaLiquidacionEst)}
                      {vencido && <span className="ml-1">⚠️</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B7280]">
                      {dias != null ? `${dias}d` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${sc.classes} border text-xs px-2 py-0.5`}>{sc.label}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, highlight = false }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  highlight?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${highlight ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs text-[#6B7280]">{label}</p>
      </div>
      <p className={`text-xl font-bold ${highlight ? 'text-red-600' : 'text-[#1A1A1A]'}`}>{value}</p>
      <p className="text-xs text-[#6B7280] mt-0.5">{sub}</p>
    </div>
  )
}
