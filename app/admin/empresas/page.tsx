'use client'

import { useEffect, useState } from 'react'
import { getAdminCompaniesAction } from '@/app/actions/admin'
import type { AdminCompanyWithApps } from '@/features/admin/types/admin.types'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { CheckCircle2, ChevronRight, Loader2, Search, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── Config visual ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  submitted:        { label: 'En revisión',     classes: 'bg-amber-50 text-amber-700 border-amber-200' },
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

// ── Página ─────────────────────────────────────────────────────────────────────
export default function AdminEmpresasPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<AdminCompanyWithApps[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const result = await getAdminCompaniesAction()
    if ('companies' in result) setCompanies(result.companies ?? [])
    setLoading(false)
  }

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.nombreRazonSocial.toLowerCase().includes(q) || c.rfc.toLowerCase().includes(q)
  })

  return (
    <div className="px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Empresas</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{companies.length} empresas registradas</p>
      </div>

      {/* Búsqueda */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
        <input
          type="text"
          placeholder="Buscar por nombre o RFC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full pl-9 pr-4 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/20 focus:border-[#3CBEDB]"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[#6B7280]">No hay empresas que coincidan.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-semibold text-[#6B7280] pl-6">Empresa</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7280]">Industria</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7280]">Tamaño</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7280]">SAT</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7280]">Productos</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7280]">Registro</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((company) => {
                const apps = company.creditApplications ?? []
                const totalMonto = apps.reduce((sum, a) => sum + (a.montoSolicitado ?? 0), 0)

                return (
                  <TableRow
                    key={company.id}
                    className="hover:bg-slate-50/60 align-top cursor-pointer"
                    onClick={() => router.push(`/admin/empresas/${company.id}`)}
                  >
                    <TableCell className="pl-6 py-4">
                      <p className="text-sm font-semibold text-[#1A1A1A]">{company.nombreRazonSocial}</p>
                      <p className="text-xs text-[#6B7280] font-mono mt-0.5">{company.rfc}</p>
                    </TableCell>

                    <TableCell className="text-sm text-[#6B7280] py-4">
                      {company.industria ?? '—'}
                    </TableCell>

                    <TableCell className="text-sm text-[#6B7280] py-4">
                      {company.tamanoEmpresa ?? '—'}
                    </TableCell>

                    <TableCell className="py-4">
                      {company.estatusSat ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Conectado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                          <XCircle className="h-3.5 w-3.5" />
                          Sin conectar
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="py-4">
                      {apps.length === 0 ? (
                        <span className="text-xs text-[#6B7280]">Sin productos</span>
                      ) : (
                        <div className="space-y-2">
                          {apps.map((a) => {
                            const tipo = TIPO_CONFIG[a.tipoCredito] ?? { label: a.tipoCredito, classes: 'bg-slate-100 text-slate-600 border-slate-200' }
                            const status = STATUS_CONFIG[a.status] ?? { label: a.status, classes: 'bg-slate-100 text-slate-600 border-slate-200' }
                            return (
                              <div key={a.id} className="flex items-center gap-2 flex-wrap">
                                <Badge className={`${tipo.classes} border text-xs px-2 py-0.5 font-medium`}>
                                  {tipo.label}
                                </Badge>
                                <Badge className={`${status.classes} border text-xs px-2 py-0.5 font-medium`}>
                                  {status.label}
                                </Badge>
                                <span className="text-xs text-[#6B7280]">{formatMXN(a.montoSolicitado)}</span>
                              </div>
                            )
                          })}
                          {apps.length > 1 && (
                            <p className="text-xs text-[#6B7280] font-medium">
                              Total: {formatMXN(totalMonto)}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-sm text-[#6B7280] py-4">
                      {formatDate(company.createdAt)}
                    </TableCell>
                    <TableCell className="py-4 pr-4">
                      <ChevronRight className="h-4 w-4 text-slate-300" />
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
