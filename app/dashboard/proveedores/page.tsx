'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProveedoresAction } from '@/app/actions/proveedores'
import { syncCfdisAction } from '@/app/actions/sync-cfdis'
import type { Proveedor } from '@/app/actions/proveedores'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, InboxIcon, Truck, Search, AlertCircle, ChevronRight } from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function ProveedoresPage() {
  const router = useRouter()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [totalGasto, setTotalGasto] = useState(0)
  const [totalPorPagar, setTotalPorPagar] = useState(0)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    // Sync CFDIs en segundo plano — no bloqueante
    syncCfdisAction().catch(() => {})

    getProveedoresAction().then((res) => {
      if (!('error' in res)) {
        setProveedores(res.proveedores)
        setTotalGasto(res.totalGasto)
        setTotalPorPagar(res.totalPorPagar)
      }
      setLoading(false)
    })
  }, [])

  const filtered = proveedores.filter(
    (p) =>
      p.nombre.toLowerCase().includes(query.toLowerCase()) ||
      p.rfc.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      {/* Topbar */}
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-[#3CBEDB]" />
          <span className="text-sm font-semibold text-[#1A1A1A]">Proveedores</span>
        </div>
        <span className="text-xs text-[#6B7280]">
          {!loading && `${proveedores.length} proveedor${proveedores.length !== 1 ? 'es' : ''}`}
        </span>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Proveedores</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Empresas de las que has recibido facturas
          </p>
        </div>

        {/* KPIs */}
        {!loading && proveedores.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs text-[#6B7280] font-medium">Total comprado</p>
              <p className="text-xl font-bold text-[#1A1A1A] mt-1">{formatMXN(totalGasto)}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Últimos 12 meses</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs text-[#6B7280] font-medium">Proveedores únicos</p>
              <p className="text-xl font-bold text-[#1A1A1A] mt-1">{proveedores.length}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Con al menos 1 factura</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs text-[#6B7280] font-medium">Por pagar</p>
                {totalPorPagar > 0 && <AlertCircle className="h-3 w-3 text-amber-500" />}
              </div>
              <p className={`text-xl font-bold mt-0 ${totalPorPagar > 0 ? 'text-amber-600' : 'text-[#1A1A1A]'}`}>
                {formatMXN(totalPorPagar)}
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {totalPorPagar > 0 ? 'Pendiente de pago' : 'Al corriente'}
              </p>
            </div>
          </div>
        )}

        {/* Tabla */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-[#1A1A1A]">
              Todos los proveedores
            </CardTitle>
            {proveedores.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o RFC..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/20 focus:border-[#3CBEDB] w-56"
                />
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[#3CBEDB]" />
              </div>
            ) : proveedores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <InboxIcon className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-[#1A1A1A]">Sin proveedores aún</p>
                <p className="text-xs text-[#6B7280] mt-1 max-w-xs">
                  Los proveedores aparecerán aquí una vez que Syntage extraiga tus CFDIs recibidos del SAT.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-[#6B7280]">Sin resultados para &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-[#6B7280] pl-6">#</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Proveedor</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">RFC</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">Total comprado</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">% del gasto</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">Por pagar</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">Facturas</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Última factura</TableHead>
                    <TableHead className="pr-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p, idx) => {
                    const pct = totalGasto > 0 ? ((p.totalComprado / totalGasto) * 100).toFixed(1) : '0'
                    return (
                      <TableRow
                        key={p.rfc}
                        className="hover:bg-slate-50/60 cursor-pointer"
                        onClick={() => router.push(
                          `/dashboard/proveedores/${encodeURIComponent(p.rfc)}?nombre=${encodeURIComponent(p.nombre)}`
                        )}
                      >
                        <TableCell className="pl-6 text-xs text-[#6B7280] w-8">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium text-[#1A1A1A]">
                          {p.nombre}
                        </TableCell>
                        <TableCell className="text-xs text-[#6B7280] font-mono">
                          {p.rfc}
                        </TableCell>
                        <TableCell className="text-[#1A1A1A] font-medium text-right">
                          {formatMXN(p.totalComprado)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#3CBEDB] rounded-full"
                                style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#6B7280] w-8 text-right">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.porPagar > 0 ? (
                            <span className="text-sm font-medium text-amber-600">
                              {formatMXN(p.porPagar)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[#6B7280] text-right">{p.numFacturas}</TableCell>
                        <TableCell className="text-[#6B7280]">{formatDate(p.ultimaFactura)}</TableCell>
                        <TableCell className="pr-6">
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </TableCell>
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
