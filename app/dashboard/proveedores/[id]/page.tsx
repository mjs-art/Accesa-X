'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getProveedorDetailAction } from '@/app/actions/proveedores'
import type { ProveedorDetalle, FacturaProveedor } from '@/app/actions/proveedores'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft, Loader2, DollarSign, Receipt, Clock, TrendingDown, Calendar,
  CheckCircle2, AlertCircle,
} from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}
function truncateUUID(u: string) { return u.length > 8 ? u.slice(0, 8).toUpperCase() + '...' : u }

function InvoiceStatusBadge({ dueAmount }: { dueAmount: number | null }) {
  if (dueAmount !== null && dueAmount > 0)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><AlertCircle className="h-3 w-3" />Por pagar</span>
  if (dueAmount === 0)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3 w-3" />Pagada</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">Vigente</span>
}

function KpiCard({ title, value, subtitle, icon, accent = false }: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode; accent?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[#6B7280] font-medium">{title}</p>
        {icon}
      </div>
      <p className={`text-xl font-bold ${accent ? 'text-amber-600' : 'text-[#1A1A1A]'}`}>{value}</p>
      {subtitle && <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>}
    </div>
  )
}

export default function ProveedorDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()

  const rfc = decodeURIComponent(id)
  const nombreParam = searchParams.get('nombre') ?? rfc

  const [data, setData] = useState<{ proveedor: ProveedorDetalle; invoices: FacturaProveedor[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProveedorDetailAction(rfc).then((res) => {
      if (!('error' in res)) setData({ proveedor: res.proveedor, invoices: res.invoices })
      setLoading(false)
    })
  }, [rfc])

  const proveedorNombre = data?.proveedor.nombre ?? nombreParam
  const p = data?.proveedor

  return (
    <div>
      {/* Topbar */}
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/proveedores')}
            className="text-[#6B7280] hover:text-[#1A1A1A] -ml-2 h-8 gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Proveedores
          </Button>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-[#1A1A1A] truncate max-w-xs">{proveedorNombre}</span>
        </div>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{proveedorNombre}</h1>
          <p className="text-sm text-[#6B7280] font-mono mt-0.5">{rfc}</p>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 h-24 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard
              title="Total comprado"
              value={p ? formatMXN(p.totalComprado) : '—'}
              subtitle="Historial completo"
              icon={<DollarSign className="h-4 w-4 text-[#3CBEDB]" />}
            />
            <KpiCard
              title="Facturas recibidas"
              value={p ? String(p.numFacturas) : '—'}
              subtitle="CFDIs vigentes"
              icon={<Receipt className="h-4 w-4 text-[#3CBEDB]" />}
            />
            <KpiCard
              title="Por pagar"
              value={p && p.porPagar > 0 ? formatMXN(p.porPagar) : p?.porPagar === 0 ? '$0' : '—'}
              subtitle={p?.porPagar === 0 ? 'Al corriente' : 'Pendiente de pago'}
              icon={<Clock className="h-4 w-4 text-amber-500" />}
              accent={!!p && p.porPagar > 0}
            />
            <KpiCard
              title="% del gasto total"
              value={p ? `${p.porcentajeDelTotal}%` : '—'}
              subtitle="Participación en gastos"
              icon={<TrendingDown className="h-4 w-4 text-[#6B7280]" />}
            />
          </div>
        )}

        {/* Historial de facturas */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#3CBEDB]" />
              Facturas recibidas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-[#3CBEDB]" />
              </div>
            ) : !data || data.invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <Receipt className="h-8 w-8 text-slate-300 mb-3" />
                <p className="text-sm text-[#6B7280]">Sin facturas de este proveedor</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-[#6B7280] pl-6">UUID</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Concepto</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Fecha</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">Monto</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">Por pagar</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invoices.map((inv) => (
                    <TableRow key={inv.uuid} className="hover:bg-slate-50/60">
                      <TableCell className="pl-6">
                        <span className="text-xs font-mono text-[#6B7280]">{truncateUUID(inv.uuid)}</span>
                      </TableCell>
                      <TableCell className="text-sm text-[#1A1A1A] max-w-[200px] truncate">
                        {inv.descripcion}
                      </TableCell>
                      <TableCell className="text-sm text-[#6B7280]">{formatDate(inv.issuedAt)}</TableCell>
                      <TableCell className="text-sm font-medium text-[#1A1A1A] text-right">
                        {formatMXN(inv.total)}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        {inv.dueAmount !== null
                          ? <span className={inv.dueAmount > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                              {inv.dueAmount > 0 ? formatMXN(inv.dueAmount) : '—'}
                            </span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge dueAmount={inv.dueAmount} />
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
