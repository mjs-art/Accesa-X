'use client'

import { useEffect, useState } from 'react'
import { getCxcAction } from '@/app/actions/inteligencia'
import type { CxcData, AgingBucket } from '@/app/actions/inteligencia'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Clock, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { SyncBanner } from '@/components/inteligencia/SyncBanner'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}
function truncateUUID(u: string) { return u.slice(0, 8).toUpperCase() + '...' }

function bucketColor(label: string) {
  if (label === 'Crítica') return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', bar: 'bg-red-400' }
  if (label === 'Atrasada') return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', bar: 'bg-orange-400' }
  if (label === 'Vencida') return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400' }
  return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-400' }
}

function AgeBadge({ dias }: { dias: number }) {
  if (dias > 90) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">{dias}d</span>
  if (dias > 60) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">{dias}d</span>
  if (dias > 30) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">{dias}d</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-[#6B7280] border border-slate-200">{dias}d</span>
}

function AgingCard({ bucket, total }: { bucket: AgingBucket; total: number }) {
  const c = bucketColor(bucket.label)
  const pct = total > 0 ? (bucket.total / total) * 100 : 0
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} px-5 py-4`}>
      <p className={`text-xs font-semibold ${c.text}`}>{bucket.label}</p>
      <p className="text-xs text-[#6B7280] mt-0.5">{bucket.dias}</p>
      <p className="text-xl font-bold text-[#1A1A1A] mt-2">{formatMXN(bucket.total)}</p>
      <p className="text-xs text-[#6B7280] mt-0.5">{bucket.count} factura{bucket.count !== 1 ? 's' : ''}</p>
      <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

export default function CxCPage() {
  const [data, setData] = useState<CxcData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await getCxcAction()
    if (!('error' in res)) setData(res)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A1A1A]">Inteligencia — Cuentas por Cobrar</span>
        <button onClick={load} disabled={loading} className="text-[#6B7280] hover:text-[#1A1A1A] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Cuentas por Cobrar</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Facturas emitidas pendientes de pago — aging por antigüedad</p>
        </div>

        <SyncBanner showWhenEmpty={!data || data.totalPorCobrar === 0} />

        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-[#3CBEDB]" /></div>
        ) : !data || data.totalPorCobrar === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-4" />
            <p className="text-sm font-medium text-[#1A1A1A]">Sin cuentas por cobrar</p>
            <p className="text-xs text-[#6B7280] mt-1">Todas las facturas emitidas han sido pagadas o no hay CFDIs sincronizados.</p>
          </div>
        ) : (
          <>
            {/* KPI total */}
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#6B7280] font-medium">Total por cobrar</p>
                <p className="text-2xl font-bold text-[#1A1A1A] mt-1">{formatMXN(data.totalPorCobrar)}</p>
              </div>
              <Clock className="h-6 w-6 text-[#3CBEDB]" />
            </div>

            {/* Aging buckets */}
            <div className="grid grid-cols-4 gap-4">
              {data.buckets.map((b) => (
                <AgingCard key={b.label} bucket={b} total={data.totalPorCobrar} />
              ))}
            </div>

            {/* Alerta crítica */}
            {data.buckets.find(b => b.label === 'Crítica' && b.total > 0) && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Tienes {formatMXN(data.buckets.find(b => b.label === 'Crítica')!.total)} con más de 90 días sin cobrar. Riesgo alto de incobrabilidad.
              </div>
            )}

            {/* Tabla facturas individuales */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#1A1A1A]">
                  Facturas pendientes ({data.facturas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs text-[#6B7280] pl-6">UUID</TableHead>
                      <TableHead className="text-xs text-[#6B7280]">Cliente</TableHead>
                      <TableHead className="text-xs text-[#6B7280]">Fecha</TableHead>
                      <TableHead className="text-xs text-[#6B7280] text-right">Monto</TableHead>
                      <TableHead className="text-xs text-[#6B7280] text-right">Por cobrar</TableHead>
                      <TableHead className="text-xs text-[#6B7280] text-right pr-6">Antigüedad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.facturas.map((f) => (
                      <TableRow key={f.uuid} className="hover:bg-slate-50/60">
                        <TableCell className="pl-6 text-xs font-mono text-[#6B7280]">{truncateUUID(f.uuid)}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium text-[#1A1A1A] max-w-[180px] truncate">{f.contraparte}</p>
                          <p className="text-xs text-[#6B7280] font-mono">{f.contraparteRfc}</p>
                        </TableCell>
                        <TableCell className="text-sm text-[#6B7280]">{formatDate(f.issuedAt)}</TableCell>
                        <TableCell className="text-sm font-medium text-[#1A1A1A] text-right">{formatMXN(f.monto)}</TableCell>
                        <TableCell className="text-sm font-semibold text-amber-600 text-right">{formatMXN(f.dueAmount)}</TableCell>
                        <TableCell className="text-right pr-6"><AgeBadge dias={f.diasVencida} /></TableCell>
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
