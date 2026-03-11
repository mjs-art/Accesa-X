'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getDashboardDataAction } from '@/app/actions/dashboard'
import type { Cliente } from '@/features/dashboard/types/dashboard.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, InboxIcon, Users, ChevronRight, Search } from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function ClientesPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [totalEmpresa, setTotalEmpresa] = useState(0)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    getDashboardDataAction().then((res) => {
      if ('data' in res && res.data?.verified) {
        setClientes(res.data.clientes)
        const total = res.data.clientes.reduce((s, c) => s + c.totalFacturado, 0)
        setTotalEmpresa(total)
      }
      setLoading(false)
    })
  }, [])

  const filtered = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(query.toLowerCase()) ||
      c.rfc.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      {/* Topbar */}
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#3CBEDB]" />
          <span className="text-sm font-semibold text-[#1A1A1A]">Clientes</span>
        </div>
        <span className="text-xs text-[#6B7280]">
          {!loading && `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''}`}
        </span>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Clientes</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Empresas a las que has emitido facturas
            </p>
          </div>
        </div>

        {/* KPI rápido */}
        {!loading && clientes.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs text-[#6B7280] font-medium">Total facturado</p>
              <p className="text-xl font-bold text-[#1A1A1A] mt-1">{formatMXN(totalEmpresa)}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Últimos 12 meses</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs text-[#6B7280] font-medium">Clientes únicos</p>
              <p className="text-xl font-bold text-[#1A1A1A] mt-1">{clientes.length}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Con al menos 1 factura</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs text-[#6B7280] font-medium">Ticket promedio</p>
              <p className="text-xl font-bold text-[#1A1A1A] mt-1">
                {formatMXN(clientes.length > 0 ? totalEmpresa / clientes.reduce((s, c) => s + c.facturas, 0) : 0)}
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5">Por factura emitida</p>
            </div>
          </div>
        )}

        {/* Tabla */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-[#1A1A1A]">
              Todos los clientes
            </CardTitle>
            {clientes.length > 0 && (
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
            ) : clientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <InboxIcon className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-[#1A1A1A]">Sin clientes aún</p>
                <p className="text-xs text-[#6B7280] mt-1 max-w-xs">
                  Los clientes aparecerán aquí una vez que Syntage extraiga tus CFDIs del SAT.
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
                    <TableHead className="text-xs font-semibold text-[#6B7280] pl-6">Cliente</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">RFC</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">Total facturado</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">% del total</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">Facturas</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Última factura</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] pr-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const pct = totalEmpresa > 0 ? ((c.totalFacturado / totalEmpresa) * 100).toFixed(1) : '0'
                    return (
                      <TableRow
                        key={c.rfc}
                        className="hover:bg-slate-50/60 cursor-pointer"
                        onClick={() =>
                          router.push(
                            `/dashboard/clientes/${encodeURIComponent(c.rfc)}?nombre=${encodeURIComponent(c.nombre)}`
                          )
                        }
                      >
                        <TableCell className="font-medium text-[#1A1A1A] pl-6">
                          {c.nombre}
                        </TableCell>
                        <TableCell className="text-xs text-[#6B7280] font-mono">
                          {c.rfc}
                        </TableCell>
                        <TableCell className="text-[#1A1A1A] font-medium text-right">
                          {formatMXN(c.totalFacturado)}
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
                        <TableCell className="text-[#6B7280] text-right">{c.facturas}</TableCell>
                        <TableCell className="text-[#6B7280]">{formatDate(c.ultimaFactura)}</TableCell>
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
