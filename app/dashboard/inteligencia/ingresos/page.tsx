'use client'

import { useEffect, useState } from 'react'
import { getBiDataAction, type BiData } from '@/app/actions/bi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ArrowUpRight, FileText, Loader2, RefreshCw, Users } from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function BarChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map(d => d.total), 1)
  return (
    <div className="flex items-end gap-1.5 h-36 pt-6">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
          <div className="relative w-full">
            {d.total > 0 && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1A1A1A] text-white text-[9px] rounded px-1 py-0.5 whitespace-nowrap z-10">
                {formatMXN(d.total)}
              </div>
            )}
            <div
              className="w-full bg-emerald-400 rounded-t"
              style={{ height: `${Math.max((d.total / max) * 112, d.total > 0 ? 4 : 0)}px` }}
            />
          </div>
          <span className="text-[9px] text-[#6B7280] truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function IngresosPage() {
  const [data, setData] = useState<BiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    const r = await getBiDataAction()
    if ('error' in r) setError(r.error); else setData(r.data)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const ing = data?.ingresos
  const totalFacturas = ing?.topClientes.reduce((s, c) => s + c.facturas, 0) ?? 0
  const ticketProm = ing && totalFacturas > 0 ? Math.round(ing.total / totalFacturas) : 0

  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Ingresos</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Facturas emitidas vigentes — últimos 12 meses</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-8 w-8 p-0 text-[#6B7280]">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { title: 'Total ingresos', value: ing ? formatMXN(ing.total) : '—', sub: 'Últimos 12 meses', icon: <ArrowUpRight className="h-4 w-4 text-emerald-600" />, bg: 'bg-emerald-50' },
          { title: 'Clientes únicos', value: ing ? String(ing.topClientes.length) : '—', sub: 'Con al menos 1 factura', icon: <Users className="h-4 w-4 text-[#3CBEDB]" />, bg: 'bg-[#3CBEDB]/10' },
          { title: 'Ticket promedio', value: ticketProm > 0 ? formatMXN(ticketProm) : '—', sub: `${totalFacturas} facturas emitidas`, icon: <FileText className="h-4 w-4 text-violet-500" />, bg: 'bg-violet-50' },
        ].map(kpi => (
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
          <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Ingresos por mes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="h-36 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
            : <BarChart data={ing?.mensual ?? []} />}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Clientes por ingreso</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
          ) : !ing?.topClientes.length ? (
            <p className="text-sm text-[#6B7280] text-center py-12">Sin datos disponibles</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs text-[#6B7280] pl-6">Cliente</TableHead>
                  <TableHead className="text-xs text-[#6B7280]">RFC</TableHead>
                  <TableHead className="text-xs text-[#6B7280] text-right">Facturas</TableHead>
                  <TableHead className="text-xs text-[#6B7280] text-right">% del total</TableHead>
                  <TableHead className="text-xs text-[#6B7280] text-right pr-6">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ing.topClientes.map(c => {
                  const pct = ing.total > 0 ? Math.round((c.total / ing.total) * 100) : 0
                  return (
                    <TableRow key={c.rfc} className="hover:bg-slate-50/60">
                      <TableCell className="pl-6 font-medium text-[#1A1A1A] max-w-[200px] truncate">{c.nombre}</TableCell>
                      <TableCell className="text-xs font-mono text-[#6B7280]">{c.rfc}</TableCell>
                      <TableCell className="text-right text-[#6B7280]">{c.facturas}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-[#6B7280] w-7 text-right">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6 font-semibold text-[#1A1A1A]">{formatMXN(c.total)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
