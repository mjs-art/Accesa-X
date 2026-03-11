'use client'

import { useEffect, useState } from 'react'
import { getBiDataAction, type BiData } from '@/app/actions/bi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Clock, Loader2, RefreshCw, Users } from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function diasDesde(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function AgeBadge({ dias }: { dias: number }) {
  if (dias > 90) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">{dias}d</span>
  if (dias > 30) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">{dias}d</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-[#6B7280] border border-slate-200">{dias}d</span>
}

export default function CxCPage() {
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

  const cxc = data?.cxc
  const maxDias = cxc?.clientes.reduce((max, c) => Math.max(max, diasDesde(c.facturasMasAntigua)), 0) ?? 0

  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Cuentas por Cobrar</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Facturas emitidas pendientes de pago</p>
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
          { title: 'Total por cobrar', value: cxc ? formatMXN(cxc.total) : '—', sub: 'Saldo pendiente vigente', icon: <Clock className="h-4 w-4 text-amber-600" />, bg: 'bg-amber-50' },
          { title: 'Clientes con saldo', value: cxc ? String(cxc.clientes.length) : '—', sub: 'Deudores activos', icon: <Users className="h-4 w-4 text-[#3CBEDB]" />, bg: 'bg-[#3CBEDB]/10' },
          { title: 'Antigüedad máxima', value: maxDias > 0 ? `${maxDias} días` : '—', sub: maxDias > 90 ? 'Riesgo alto de incobrabilidad' : maxDias > 30 ? 'Atención requerida' : 'Dentro del plazo normal', icon: <AlertTriangle className={`h-4 w-4 ${maxDias > 90 ? 'text-red-500' : maxDias > 30 ? 'text-amber-500' : 'text-emerald-500'}`} />, bg: maxDias > 90 ? 'bg-red-50' : maxDias > 30 ? 'bg-amber-50' : 'bg-emerald-50' },
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
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Clientes con saldo pendiente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
          ) : !cxc?.clientes.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                <Clock className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-[#1A1A1A]">Sin cuentas por cobrar</p>
              <p className="text-xs text-[#6B7280] mt-1">Todas las facturas emitidas han sido pagadas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs text-[#6B7280] pl-6">Cliente</TableHead>
                  <TableHead className="text-xs text-[#6B7280]">RFC</TableHead>
                  <TableHead className="text-xs text-[#6B7280] text-right">Facturas</TableHead>
                  <TableHead className="text-xs text-[#6B7280] text-right">Antigüedad</TableHead>
                  <TableHead className="text-xs text-[#6B7280] text-right pr-6">Por cobrar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cxc.clientes.map(c => {
                  const dias = diasDesde(c.facturasMasAntigua)
                  return (
                    <TableRow key={c.rfc} className="hover:bg-slate-50/60">
                      <TableCell className="pl-6 font-medium text-[#1A1A1A] max-w-[200px] truncate">{c.nombre}</TableCell>
                      <TableCell className="text-xs font-mono text-[#6B7280]">{c.rfc}</TableCell>
                      <TableCell className="text-right text-[#6B7280]">{c.facturas}</TableCell>
                      <TableCell className="text-right"><AgeBadge dias={dias} /></TableCell>
                      <TableCell className="text-right pr-6 font-semibold text-[#1A1A1A]">{formatMXN(c.totalPendiente)}</TableCell>
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
