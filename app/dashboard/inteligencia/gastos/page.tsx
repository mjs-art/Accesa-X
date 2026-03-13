'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getGastosAction } from '@/app/actions/inteligencia'
import type { GastosData, Periodo } from '@/app/actions/inteligencia'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowDownRight, FileText, Loader2, RefreshCw, Truck } from 'lucide-react'
import { SyncBanner } from '@/components/inteligencia/SyncBanner'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return formatMXN(n)
}

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '12 meses' },
  { value: 'ytd', label: 'Este año' },
]

function periodoLabel(p: Periodo) {
  return PERIODOS.find(x => x.value === p)?.label ?? p
}

export default function GastosPage() {
  const router = useRouter()
  const [data, setData] = useState<GastosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('12m')

  async function load(p: Periodo) {
    setLoading(true)
    const res = await getGastosAction(p)
    if (!('error' in res)) setData(res)
    setLoading(false)
  }

  useEffect(() => { load(periodo) }, [periodo])

  const totalFacturas = data?.topProveedores.reduce((s, p) => s + p.count, 0) ?? 0
  const ticketProm = data && totalFacturas > 0 ? Math.round(data.totalAnual / totalFacturas) : 0

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A1A1A]">Inteligencia — Gastos</span>
        <button onClick={() => load(periodo)} disabled={loading} className="text-[#6B7280] hover:text-[#1A1A1A] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Gastos</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Facturas recibidas · {periodoLabel(periodo)}</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {PERIODOS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriodo(value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  periodo === value
                    ? 'bg-white text-[#1A1A1A] shadow-sm'
                    : 'text-[#6B7280] hover:text-[#1A1A1A]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <SyncBanner showWhenEmpty={!data || data.totalAnual === 0} />

        <div className="grid grid-cols-3 gap-4">
          {[
            { title: 'Total gastos', value: data ? formatMXN(data.totalAnual) : '—', sub: periodoLabel(periodo), icon: <ArrowDownRight className="h-4 w-4 text-red-500" />, bg: 'bg-red-50' },
            { title: 'Proveedores únicos', value: data ? String(data.topProveedores.length) : '—', sub: 'Con al menos 1 factura', icon: <Truck className="h-4 w-4 text-[#3CBEDB]" />, bg: 'bg-[#3CBEDB]/10' },
            { title: 'Gasto promedio/factura', value: ticketProm > 0 ? formatMXN(ticketProm) : '—', sub: `${totalFacturas} facturas recibidas`, icon: <FileText className="h-4 w-4 text-violet-500" />, bg: 'bg-violet-50' },
          ].map((kpi) => (
            <Card key={kpi.title} className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-[#6B7280]">{kpi.title}</CardTitle>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>{kpi.icon}</div>
              </CardHeader>
              <CardContent>
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-300" /> : (
                  <><p className="text-2xl font-bold text-[#1A1A1A]">{kpi.value}</p><p className="text-xs text-[#6B7280] mt-1">{kpi.sub}</p></>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Gastos por mes</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-48 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.meses ?? []} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v) => formatMXN(v as number)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="total" name="Gastos" fill="#FDA4AF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Proveedores por gasto</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
            ) : !data?.topProveedores.length ? (
              <p className="text-sm text-[#6B7280] text-center py-12">Sin datos disponibles</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs text-[#6B7280] pl-6">Proveedor</TableHead>
                    <TableHead className="text-xs text-[#6B7280]">RFC</TableHead>
                    <TableHead className="text-xs text-[#6B7280] text-right">Facturas</TableHead>
                    <TableHead className="text-xs text-[#6B7280] text-right">% del total</TableHead>
                    <TableHead className="text-xs text-[#6B7280] text-right pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProveedores.map((p) => {
                    const pct = data.totalAnual > 0 ? Math.round((p.total / data.totalAnual) * 100) : 0
                    return (
                      <TableRow
                        key={p.rfc}
                        className="hover:bg-slate-50/60 cursor-pointer"
                        onClick={() => router.push(`/dashboard/proveedores/${encodeURIComponent(p.rfc)}?nombre=${encodeURIComponent(p.nombre)}`)}
                      >
                        <TableCell className="pl-6 font-medium text-[#1A1A1A] max-w-[200px] truncate">{p.nombre}</TableCell>
                        <TableCell className="text-xs font-mono text-[#6B7280]">{p.rfc}</TableCell>
                        <TableCell className="text-right text-[#6B7280]">{p.count}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-[#6B7280] w-7 text-right">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6 font-semibold text-[#1A1A1A]">{formatMXN(p.total)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
