'use client'

import { useEffect, useState } from 'react'
import { getFlujoCajaAction } from '@/app/actions/inteligencia'
import type { FlujoCajaData, Periodo } from '@/app/actions/inteligencia'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Loader2, RefreshCw, Percent } from 'lucide-react'
import { SyncBanner } from '@/components/inteligencia/SyncBanner'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function fmtShort(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000).toFixed(0)}K`
  return formatMXN(n)
}

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '12 meses' },
  { value: 'ytd', label: 'Este año' },
  { value: 'custom', label: 'Personalizado' },
]

function periodoLabel(p: Periodo) {
  return PERIODOS.find(x => x.value === p)?.label ?? p
}

export default function MargenPage() {
  const [data, setData] = useState<FlujoCajaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('12m')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  async function load(p: Periodo, from?: string, to?: string) {
    if (p === 'custom' && (!from || !to)) return
    setLoading(true)
    const res = await getFlujoCajaAction(p, from, to)
    if (!('error' in res)) setData(res)
    setLoading(false)
  }

  useEffect(() => {
    if (periodo !== 'custom') load(periodo)
  }, [periodo])

  useEffect(() => {
    if (periodo === 'custom' && customFrom && customTo) load('custom', customFrom, customTo)
  }, [customFrom, customTo, periodo])

  const mejorMes = data?.meses.reduce((best, m) => m.margenPct > best.margenPct ? m : best, data.meses[0])
  const peorMes = data?.meses.reduce((worst, m) => m.margenPct < worst.margenPct ? m : worst, data.meses[0])

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A1A1A]">Inteligencia — Margen</span>
        <button onClick={() => load(periodo, customFrom || undefined, customTo || undefined)} disabled={loading} className="text-[#6B7280] hover:text-[#1A1A1A] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Margen y Rentabilidad</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Ingresos vs Gastos · {periodoLabel(periodo)}</p>
          </div>
          <div className="flex items-center gap-2">
            {periodo === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-7 rounded-md border border-slate-200 px-2 text-xs text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-[#3CBEDB]"
                />
                <span className="text-xs text-[#6B7280]">–</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-7 rounded-md border border-slate-200 px-2 text-xs text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-[#3CBEDB]"
                />
              </div>
            )}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {PERIODOS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPeriodo(value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    periodo === value ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A1A]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SyncBanner showWhenEmpty={!data || !data.hasSatData} />

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[#3CBEDB]" />
          </div>
        ) : !data || data.totalEntradas === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Percent className="h-10 w-10 text-slate-300 mb-4" />
            <p className="text-sm font-medium text-[#1A1A1A]">Sin datos en el periodo</p>
            <p className="text-xs text-[#6B7280] mt-1">Selecciona otro periodo o sincroniza tus datos del SAT.</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-[#6B7280] font-medium">Total ingresos</p>
                  <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <p className="text-xl font-bold text-[#1A1A1A]">{formatMXN(data.totalEntradas)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-[#6B7280] font-medium">Total gastos</p>
                  <div className="h-7 w-7 rounded-lg bg-red-50 flex items-center justify-center">
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                  </div>
                </div>
                <p className="text-xl font-bold text-[#1A1A1A]">{formatMXN(data.totalSalidas)}</p>
              </div>
              <div className={`rounded-xl border px-5 py-4 ${data.margenPctTotal >= 20 ? 'bg-emerald-50 border-emerald-200' : data.margenPctTotal >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-xs text-[#6B7280] font-medium mb-1">Margen bruto</p>
                <p className={`text-xl font-bold ${data.margenPctTotal >= 20 ? 'text-emerald-700' : data.margenPctTotal >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                  {formatMXN(data.netoTotal)}
                </p>
                <p className="text-xs text-[#6B7280] mt-0.5">{data.margenPctTotal}% del ingreso</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <p className="text-xs text-[#6B7280] font-medium mb-1">Mejor / Peor mes</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-sm font-bold text-emerald-600">{mejorMes?.label}</span>
                  <span className="text-xs text-[#6B7280]">{mejorMes?.margenPct}%</span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-sm font-bold text-red-500">{peorMes?.label}</span>
                  <span className="text-xs text-[#6B7280]">{peorMes?.margenPct}%</span>
                </div>
              </div>
            </div>

            {/* Gráfica Ingresos vs Gastos */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Ingresos vs Gastos por mes</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.meses} barGap={4} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={64} />
                    <Tooltip formatter={(v, name) => [formatMXN(v as number), name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entradas" name="Ingresos" fill="#3CBEDB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="salidas" name="Gastos" fill="#FDA4AF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfica Margen % */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Margen % por mes</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.meses} barCategoryGap="40%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Margen']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                    <Bar dataKey="margenPct" name="Margen %" radius={[4, 4, 0, 0]}>
                      {data.meses.map((entry) => (
                        <Cell key={entry.mes} fill={entry.margenPct >= 20 ? '#34D399' : entry.margenPct >= 0 ? '#FCD34D' : '#F87171'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabla */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Rentabilidad mensual</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs text-[#6B7280] pl-6">Mes</TableHead>
                      <TableHead className="text-xs text-[#6B7280] text-right">Ingresos</TableHead>
                      <TableHead className="text-xs text-[#6B7280] text-right">Gastos</TableHead>
                      <TableHead className="text-xs text-[#6B7280] text-right">Margen bruto</TableHead>
                      <TableHead className="text-xs text-[#6B7280] text-right pr-6">Margen %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.meses.map((m) => (
                      <TableRow key={m.mes} className="hover:bg-slate-50/60">
                        <TableCell className="pl-6 text-sm font-medium text-[#1A1A1A]">{m.label}</TableCell>
                        <TableCell className="text-right text-sm text-[#1A1A1A]">{formatMXN(m.entradas)}</TableCell>
                        <TableCell className="text-right text-sm text-[#6B7280]">{formatMXN(m.salidas)}</TableCell>
                        <TableCell className={`text-right text-sm font-semibold ${m.neto >= 0 ? 'text-[#1A1A1A]' : 'text-red-600'}`}>
                          {formatMXN(m.neto)}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.margenPct >= 20
                              ? 'bg-emerald-100 text-emerald-700'
                              : m.margenPct >= 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {m.margenPct}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
