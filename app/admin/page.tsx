'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronRight, Loader2, Search } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Application {
  id: string
  tipo_credito: 'empresarial' | 'factoraje' | 'contrato'
  monto_solicitado: number
  plazo_meses: number
  status: string
  created_at: string
  companies: { nombre_razon_social: string; rfc: string } | null
}

// ── Config visual ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  submitted:   { label: 'En revisión', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  en_revision: { label: 'Revisando',   classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  aprobado:    { label: 'Aprobado',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rechazado:   { label: 'Rechazado',   classes: 'bg-red-50 text-red-700 border-red-200' },
}

const TIPO_CONFIG: Record<string, { label: string; classes: string }> = {
  empresarial: { label: 'Empresarial', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  factoraje:   { label: 'Factoraje',   classes: 'bg-purple-50 text-purple-700 border-purple-200' },
  contrato:    { label: 'Por contrato', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
}

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase
      .from('credit_applications')
      .select('id, tipo_credito, monto_solicitado, plazo_meses, status, created_at, companies(nombre_razon_social, rfc)')
      .order('created_at', { ascending: false })

    setApplications((data as Application[]) ?? [])
    setLoading(false)
  }

  const filtered = applications.filter((a) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      a.companies?.nombre_razon_social.toLowerCase().includes(q) ||
      a.companies?.rfc.toLowerCase().includes(q)
    const matchStatus = !statusFilter || a.status === statusFilter
    const matchTipo = !tipoFilter || a.tipo_credito === tipoFilter
    return matchSearch && matchStatus && matchTipo
  })

  return (
    <div className="px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Solicitudes de crédito</h1>
        <p className="text-sm text-[#64748B] mt-0.5">{applications.length} solicitudes en total</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            placeholder="Buscar empresa o RFC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 pr-4 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F2D5E]/20 focus:border-[#0F2D5E] w-64"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F2D5E]/20 focus:border-[#0F2D5E]"
        >
          <option value="">Todos los estatus</option>
          <option value="submitted">En revisión</option>
          <option value="en_revision">Revisando</option>
          <option value="aprobado">Aprobado</option>
          <option value="rechazado">Rechazado</option>
        </select>

        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F2D5E]/20 focus:border-[#0F2D5E]"
        >
          <option value="">Todos los tipos</option>
          <option value="empresarial">Empresarial</option>
          <option value="factoraje">Factoraje</option>
          <option value="contrato">Por contrato</option>
        </select>

        {(search || statusFilter || tipoFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setTipoFilter('') }}
            className="h-9 px-3 text-sm text-[#64748B] hover:text-[#0F172A] border border-slate-200 rounded-lg bg-white"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#64748B]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[#64748B]">No hay solicitudes que coincidan.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-semibold text-[#64748B] pl-6">Empresa</TableHead>
                <TableHead className="text-xs font-semibold text-[#64748B]">Tipo</TableHead>
                <TableHead className="text-xs font-semibold text-[#64748B]">Monto</TableHead>
                <TableHead className="text-xs font-semibold text-[#64748B]">Plazo</TableHead>
                <TableHead className="text-xs font-semibold text-[#64748B]">Estatus</TableHead>
                <TableHead className="text-xs font-semibold text-[#64748B]">Fecha</TableHead>
                <TableHead className="pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const statusCfg = STATUS_CONFIG[a.status] ?? { label: a.status, classes: 'bg-slate-100 text-slate-600 border-slate-200' }
                const tipoCfg = TIPO_CONFIG[a.tipo_credito] ?? { label: a.tipo_credito, classes: 'bg-slate-100 text-slate-600 border-slate-200' }
                return (
                  <TableRow key={a.id} className="hover:bg-slate-50/60">
                    <TableCell className="pl-6">
                      <p className="text-sm font-medium text-[#0F172A]">{a.companies?.nombre_razon_social ?? '—'}</p>
                      <p className="text-xs text-[#64748B] font-mono">{a.companies?.rfc ?? '—'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${tipoCfg.classes} border text-xs px-2 py-0.5 font-medium`}>
                        {tipoCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-[#0F172A]">
                      {formatMXN(a.monto_solicitado)}
                    </TableCell>
                    <TableCell className="text-sm text-[#64748B]">{a.plazo_meses} meses</TableCell>
                    <TableCell>
                      <Badge className={`${statusCfg.classes} border text-xs px-2 py-0.5 font-medium`}>
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[#64748B]">{formatDate(a.created_at)}</TableCell>
                    <TableCell className="pr-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/solicitudes/${a.id}`)}
                        className="text-[#0F2D5E] hover:bg-[#0F2D5E]/5 font-medium"
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
