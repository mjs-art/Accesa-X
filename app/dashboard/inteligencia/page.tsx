'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBiData, type BiData } from '@/app/actions/bi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle, ArrowUpRight, ArrowDownRight, Clock, TrendingUp, Loader2, RefreshCw,
} from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function BarChart({ data, color }: { data: { label: string; total: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.total), 1)
  return (
    <div className="flex items-end gap-1 h-28 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className={`w-full rounded-t transition-all ${color}`}
            style={{ height: `${Math.max((d.total / max) * 88, d.total > 0 ? 4 : 0)}px` }}
          />
          <span className="text-[9px] text-[#6B7280] truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function KpiCard({
  title, value, sub, icon, color, loading, onClick,
}: {
  title: string; value: string; sub?: string; icon: React.ReactNode; color: string; loading: boolean; onClick?: () => void
}) {
  return (
    <Card
      className={`border-slate-200 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[#6B7280]">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
        ) : (
          <>
            <p className="text-2xl font-bold text-[#1A1A1A]">{value}</p>
            {sub && <p className="text-xs text-[#6B7280] mt-1">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function InteligenciaPage() {
  const router = useRouter()
  const [data, setData] = useState<BiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const result = await getBiData()
    if ('error' in result) setError(result.error)
    else setData(result.data)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const margen = data ? data.ingresos.total - data.gastos.total : 0
  const margenPct = data && data.ingresos.total > 0
    ? Math.round((margen / data.ingresos.total) * 100)
    : 0

  return (
    <div className="px-8 py-8 space-y-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Inteligencia de Negocio</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Resumen ejecutivo — últimos 12 meses</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          className="h-8 w-8 p-0 text-[#6B7280] hover:text-[#1A1A1A]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ingresos"
          value={data ? formatMXN(data.ingresos.total) : '—'}
          sub="Facturas emitidas vigentes"
          icon={<ArrowUpRight className="h-4 w-4 text-emerald-600" />}
          color="bg-emerald-50"
          loading={loading}
          onClick={() => router.push('/dashboard/inteligencia/ingresos')}
        />
        <KpiCard
          title="Gastos"
          value={data ? formatMXN(data.gastos.total) : '—'}
          sub="Facturas recibidas vigentes"
          icon={<ArrowDownRight className="h-4 w-4 text-red-500" />}
          color="bg-red-50"
          loading={loading}
          onClick={() => router.push('/dashboard/inteligencia/gastos')}
        />
        <KpiCard
          title="Por cobrar (CxC)"
          value={data ? formatMXN(data.cxc.total) : '—'}
          sub={data ? `${data.cxc.clientes.length} clientes con saldo` : undefined}
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          color="bg-amber-50"
          loading={loading}
          onClick={() => router.push('/dashboard/inteligencia/cxc')}
        />
        <KpiCard
          title="Por pagar (CxP)"
          value={data ? formatMXN(data.cxp.total) : '—'}
          sub={data ? `${data.cxp.proveedores.length} proveedores con saldo` : undefined}
          icon={<TrendingUp className="h-4 w-4 text-[#3CBEDB]" />}
          color="bg-[#3CBEDB]/10"
          loading={loading}
          onClick={() => router.push('/dashboard/inteligencia/cxp')}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Ingresos mensuales</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-28 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : (
              <BarChart data={data?.ingresos.mensual ?? []} color="bg-emerald-400" />
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Gastos mensuales</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-28 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : (
              <BarChart data={data?.gastos.mensual ?? []} color="bg-red-400" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Margen */}
      {!loading && data && data.ingresos.total > 0 && (
        <Card className="border-slate-200 shadow-sm bg-slate-50">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Margen bruto (últimos 12 meses)</p>
              <p className={`text-2xl font-bold mt-1 ${margen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatMXN(margen)}
              </p>
            </div>
            <div className={`text-4xl font-bold ${margen >= 0 ? 'text-emerald-100' : 'text-red-100'}`}>
              {margenPct}%
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top clientes */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Top clientes</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-[#3CBEDB] h-7 px-2"
              onClick={() => router.push('/dashboard/inteligencia/ingresos')}
            >
              Ver todo
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : !data?.ingresos.topClientes.length ? (
              <p className="text-sm text-[#6B7280] text-center py-8">Sin datos</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs text-[#6B7280] pl-6">Cliente</TableHead>
                    <TableHead className="text-xs text-[#6B7280] text-right pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ingresos.topClientes.slice(0, 5).map((c) => (
                    <TableRow key={c.rfc} className="hover:bg-slate-50/60">
                      <TableCell className="pl-6">
                        <p className="text-sm font-medium text-[#1A1A1A] truncate max-w-[180px]">{c.nombre}</p>
                        <p className="text-xs text-[#6B7280] font-mono">{c.rfc}</p>
                      </TableCell>
                      <TableCell className="text-right pr-6 text-sm font-semibold text-[#1A1A1A]">
                        {formatMXN(c.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top proveedores */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Top proveedores</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-[#3CBEDB] h-7 px-2"
              onClick={() => router.push('/dashboard/inteligencia/gastos')}
            >
              Ver todo
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : !data?.gastos.topProveedores.length ? (
              <p className="text-sm text-[#6B7280] text-center py-8">Sin datos</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs text-[#6B7280] pl-6">Proveedor</TableHead>
                    <TableHead className="text-xs text-[#6B7280] text-right pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.gastos.topProveedores.slice(0, 5).map((p) => (
                    <TableRow key={p.rfc} className="hover:bg-slate-50/60">
                      <TableCell className="pl-6">
                        <p className="text-sm font-medium text-[#1A1A1A] truncate max-w-[180px]">{p.nombre}</p>
                        <p className="text-xs text-[#6B7280] font-mono">{p.rfc}</p>
                      </TableCell>
                      <TableCell className="text-right pr-6 text-sm font-semibold text-[#1A1A1A]">
                        {formatMXN(p.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
