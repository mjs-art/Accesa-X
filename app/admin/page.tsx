'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getApplicationsAction } from '@/app/actions/admin'
import type { CreditApplication } from '@/features/admin/types/admin.types'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronRight, Loader2, Search } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  submitted:        { label: 'En revisión',     classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  under_review:     { label: 'En revisión',     classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  en_revision:      { label: 'Revisando',       classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  aprobado:         { label: 'Aprobado',        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  fondos_liberados: { label: 'Fondos liberados', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  en_ejecucion:     { label: 'En ejecución',    classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  liquidado:        { label: 'Liquidado',       classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  rechazado:        { label: 'Rechazado',       classes: 'bg-red-50 text-red-700 border-red-200' },
}

const TIPO_CONFIG: Record<string, { label: string; classes: string }> = {
  proyecto:  { label: 'Por proyecto', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  factoraje: { label: 'Factoraje',    classes: 'bg-purple-50 text-purple-700 border-purple-200' },
}

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminPage() {
  const router = useRouter()

  const [applications, setApplications] = useState<CreditApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const result = await getApplicationsAction()
    if ('applications' in result) setApplications(result.applications ?? [])
    setLoading(false)
  }

  const filtered = applications.filter((a) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      a.company?.nombreRazonSocial.toLowerCase().includes(q) ||
      a.company?.rfc.toLowerCase().includes(q)
    const matchStatus = !statusFilter || a.status === statusFilter
    const matchTipo = !tipoFilter || a.tipoCredito === tipoFilter
    return matchSearch && matchStatus && matchTipo
  })

  return (
    <div className="px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Solicitudes de crédito</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{applications.length} solicitudes en total</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Buscar empresa o RFC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 pr-4 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/20 focus:border-[#3CBEDB] w-64"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/20 focus:border-[#3CBEDB]"
        >
          <option value="">Todos los estatus</option>
          <option value="submitted">En revisión</option>
          <option value="en_revision">Revisando</option>
          <option value="aprobado">Aprobado</option>
          <option value="fondos_liberados">Fondos liberados</option>
          <option value="en_ejecucion">En ejecución</option>
          <option value="liquidado">Liquidado</option>
          <option value="rechazado">Rechazado</option>
        </select>

        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/20 focus:border-[#3CBEDB]"
        >
          <option value="">Todos los tipos</option>
          <option value="proyecto">Por proyecto</option>
          <option value="factoraje">Factoraje</option>
        </select>

        {(search || statusFilter || tipoFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setTipoFilter('') }}
            className="h-9 px-3 text-sm text-[#6B7280] hover:text-[#1A1A1A] border border-slate-200 rounded-lg bg-white"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[#6B7280]">No hay solicitudes que coincidan.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-semibold text-[#6B7280] pl-6">Empresa</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7280]">Tipo</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7280]">Monto</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7280]">Plazo</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7280]">Estatus</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7280]">Fecha</TableHead>
                <TableHead className="pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const statusCfg = STATUS_CONFIG[a.status] ?? { label: a.status, classes: 'bg-slate-100 text-slate-600 border-slate-200' }
                const tipoCfg = TIPO_CONFIG[a.tipoCredito] ?? { label: a.tipoCredito, classes: 'bg-slate-100 text-slate-600 border-slate-200' }
                return (
                  <TableRow key={a.id} className="hover:bg-slate-50/60">
                    <TableCell className="pl-6">
                      <p className="text-sm font-medium text-[#1A1A1A]">{a.company?.nombreRazonSocial ?? '—'}</p>
                      <p className="text-xs text-[#6B7280] font-mono">{a.company?.rfc ?? '—'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${tipoCfg.classes} border text-xs px-2 py-0.5 font-medium`}>
                        {tipoCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-[#1A1A1A]">
                      {formatMXN(a.montoSolicitado)}
                    </TableCell>
                    <TableCell className="text-sm text-[#6B7280]">{a.plazoMeses} meses</TableCell>
                    <TableCell>
                      <Badge className={`${statusCfg.classes} border text-xs px-2 py-0.5 font-medium`}>
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[#6B7280]">{formatDate(a.createdAt)}</TableCell>
                    <TableCell className="pr-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/solicitudes/${a.id}`)}
                        className="text-[#1A1A1A] hover:bg-[#3CBEDB]/5 font-medium"
                      >
                        Ver detalle
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
