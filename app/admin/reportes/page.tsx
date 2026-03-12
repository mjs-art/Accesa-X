'use client'

import { useEffect, useState } from 'react'
import { getReportesAction } from '@/app/actions/admin'
import type { ReportesData } from '@/app/actions/admin'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Loader2, TrendingUp, CheckCircle2, XCircle, DollarSign } from 'lucide-react'

// ── Config visual ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  submitted:        'En revisión',
  en_revision:      'Revisando',
  docs_pendientes:  'Docs pendientes',
  aprobado:         'Aprobado',
  fondos_liberados: 'Fondos liberados',
  en_ejecucion:     'En ejecución',
  liquidado:        'Liquidado',
  rechazado:        'Rechazado',
}

const STATUS_COLORS: Record<string, string> = {
  submitted:        '#F59E0B',
  en_revision:      '#3B82F6',
  docs_pendientes:  '#F97316',
  aprobado:         '#10B981',
  fondos_liberados: '#3CBEDB',
  en_ejecucion:     '#6366F1',
  liquidado:        '#94A3B8',
  rechazado:        '#EF4444',
}

const TIPO_LABELS: Record<string, string> = { proyecto: 'Por proyecto', factoraje: 'Factoraje' }

function formatMXN(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function formatMXNFull(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function AdminReportesPage() {
  const [data, setData] = useState<ReportesData | null>(null)
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const result = await getReportesAction()
    if ('data' in result) setData(result.data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-[#6B7280]" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#6B7280]">No se pudieron cargar los reportes.</p>
      </div>
    )
  }

  return (
    <div className="px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Reportes</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{data.totalSolicitudes} solicitudes totales (excluye borradores)</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4 text-[#3CBEDB]" />}
          label="Tasa de aprobación"
          value={`${data.tasaAprobacion}%`}
          sub={`${data.totalAprobadas} de ${data.totalSolicitudes} aprobadas`}
          color="teal"
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4 text-indigo-500" />}
          label="Cartera activa"
          value={formatMXN(data.carteraActiva)}
          sub="fondos liberados + en ejecución"
          color="indigo"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="Total aprobado"
          value={formatMXN(data.montoTotalAprobado)}
          sub="histórico acumulado"
          color="green"
        />
        <KpiCard
          icon={<XCircle className="h-4 w-4 text-red-400" />}
          label="Rechazadas"
          value={String(data.totalRechazadas)}
          sub={`${data.totalSolicitudes > 0 ? Math.round((data.totalRechazadas / data.totalSolicitudes) * 100) : 0}% del total`}
          color="red"
        />
      </div>

      {/* Gráfica: solicitudes por mes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Solicitudes últimos 6 meses</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.porMes} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: '#F8FAFC' }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="solicitudes" name="Solicitudes" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="aprobadas" name="Aprobadas" fill="#3CBEDB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Distribución por status + Top empresas */}
      <div className="grid grid-cols-2 gap-4">

        {/* Por status */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Distribución por status</h2>
          <div className="space-y-3">
            {Object.entries(data.porStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => {
                const pct = data.totalSolicitudes > 0 ? Math.round((count / data.totalSolicitudes) * 100) : 0
                const color = STATUS_COLORS[status] ?? '#94A3B8'
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#6B7280]">{STATUS_LABELS[status] ?? status}</span>
                      <span className="text-xs font-semibold text-[#1A1A1A]">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Top empresas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Top 5 empresas por monto</h2>
          {data.topEmpresas.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Sin datos.</p>
          ) : (
            <div className="space-y-3">
              {data.topEmpresas.map((emp, i) => {
                const maxMonto = data.topEmpresas[0]?.monto ?? 1
                const pct = Math.round((emp.monto / maxMonto) * 100)
                const sc = STATUS_COLORS[emp.status] ?? '#94A3B8'
                return (
                  <div key={emp.nombre}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-[#6B7280] w-4 shrink-0">{i + 1}</span>
                        <span className="text-xs text-[#1A1A1A] truncate">{emp.nombre}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#1A1A1A] ml-2 shrink-0">{formatMXNFull(emp.monto)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: sc }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: 'teal' | 'indigo' | 'green' | 'red'
}) {
  const textColor = { teal: 'text-[#3CBEDB]', indigo: 'text-indigo-600', green: 'text-emerald-600', red: 'text-red-500' }[color]
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs text-[#6B7280]">{label}</p>
      </div>
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
      <p className="text-xs text-[#6B7280] mt-0.5">{sub}</p>
    </div>
  )
}
