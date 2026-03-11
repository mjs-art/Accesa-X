'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProyectosAction } from '@/app/actions/proyecto'
import { getFactorajesAction } from '@/app/actions/factoraje'
import type { SolicitudProyecto, ProyectoStatus } from '@/app/actions/proyecto'
import type { SolicitudFactoraje } from '@/app/actions/factoraje'
import { Loader2, PlusCircle, FileText, RefreshCw, ChevronDown } from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_CONFIG: Record<ProyectoStatus, { label: string; bg: string; text: string; border: string }> = {
  borrador:        { label: 'Borrador',          bg: 'bg-slate-100',    text: 'text-slate-600',   border: 'border-slate-200' },
  submitted:       { label: 'Enviada',            bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200' },
  en_revision:     { label: 'En revisión',        bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200' },
  docs_pendientes: { label: 'Docs pendientes',    bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200' },
  aprobado:        { label: 'Aprobada',           bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  fondos_liberados:{ label: 'Fondos liberados',   bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  en_ejecucion:    { label: 'En ejecución',       bg: 'bg-[#3CBEDB]/10',text: 'text-[#1A7A8A]',  border: 'border-[#3CBEDB]/30' },
  liquidado:       { label: 'Liquidado',          bg: 'bg-slate-100',   text: 'text-slate-500',   border: 'border-slate-200' },
  rechazado:       { label: 'Rechazada',          bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200' },
}

function StatusBadge({ status }: { status: ProyectoStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.borrador
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: 'proyecto' | 'factoraje' }) {
  return tipo === 'factoraje'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">Factoraje</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">Proyecto</span>
}

interface Row {
  id: string
  tipo: 'proyecto' | 'factoraje'
  title: string
  subtitle: string
  monto: number | null
  status: ProyectoStatus
  created_at: string
}

function toProjectRow(s: SolicitudProyecto): Row {
  return {
    id: s.id,
    tipo: 'proyecto',
    title: s.project_name ?? 'Sin nombre',
    subtitle: s.client_name ?? '—',
    monto: s.monto_solicitado,
    status: s.status,
    created_at: s.created_at,
  }
}

function toFactorajeRow(s: SolicitudFactoraje): Row {
  return {
    id: s.id,
    tipo: 'factoraje',
    title: 'Factoraje de facturas',
    subtitle: s.notificacion_deudor ? 'Con notificación al deudor' : 'Sin notificación al deudor',
    monto: s.monto_solicitado,
    status: s.status as ProyectoStatus,
    created_at: s.created_at,
  }
}

export default function MisSolicitudesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)

  async function load() {
    setLoading(true)
    const [proyRes, factRes] = await Promise.all([getProyectosAction(), getFactorajesAction()])
    const proyRows = ('error' in proyRes ? [] : proyRes).map(toProjectRow)
    const factRows = ('error' in factRes ? [] : factRes).map(toFactorajeRow)
    const merged = [...proyRows, ...factRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    setRows(merged)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const enRevision = rows.filter(r => ['submitted', 'en_revision', 'docs_pendientes'].includes(r.status)).length
  const aprobadas  = rows.filter(r => ['aprobado', 'fondos_liberados', 'en_ejecucion'].includes(r.status)).length
  const totalMonto = rows.reduce((s, r) => s + (r.monto ?? 0), 0)

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A1A1A]">Financiamiento — Mis solicitudes</span>
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={loading} className="text-[#6B7280] hover:text-[#1A1A1A] disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {/* Nueva solicitud dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3CBEDB] text-white text-xs font-medium rounded-lg hover:bg-[#3CBEDB]/90 transition-colors">
              <PlusCircle className="h-3.5 w-3.5" />
              Nueva solicitud
              <ChevronDown className="h-3 w-3" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-48">
                  <button
                    onClick={() => { setShowMenu(false); router.push('/credito/proyecto/nuevo') }}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors">
                    <p className="font-medium text-[#1A1A1A]">Crédito por proyecto</p>
                    <p className="text-[#6B7280] mt-0.5">Financia contratos u órdenes de compra</p>
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); router.push('/credito/factoraje/nuevo') }}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors">
                    <p className="font-medium text-[#1A1A1A]">Factoraje</p>
                    <p className="text-[#6B7280] mt-0.5">Descuenta facturas emitidas (CFDIs)</p>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Mis solicitudes</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Proyectos y factoraje solicitados a AccesaX</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[#3CBEDB]" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total solicitado', value: totalMonto > 0 ? formatMXN(totalMonto) : '—', sub: `${rows.length} solicitud${rows.length !== 1 ? 'es' : ''}` },
                { label: 'En revisión', value: String(enRevision), sub: 'Pendientes de respuesta' },
                { label: 'Aprobadas', value: String(aprobadas), sub: 'Listas para dispersión' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm">
                  <p className="text-xs text-[#6B7280] font-medium">{k.label}</p>
                  <p className="text-2xl font-bold text-[#1A1A1A] mt-1">{k.value}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{k.sub}</p>
                </div>
              ))}
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <FileText className="h-10 w-10 text-slate-300 mb-4" />
                <p className="text-sm font-medium text-[#1A1A1A]">Sin solicitudes aún</p>
                <p className="text-xs text-[#6B7280] mt-1 mb-6">Solicita un crédito por proyecto o factoraje para financiar tus operaciones</p>
                <div className="flex gap-3">
                  <button onClick={() => router.push('/credito/proyecto/nuevo')}
                    className="flex items-center gap-2 px-4 py-2 bg-[#3CBEDB] text-white text-sm font-medium rounded-lg hover:bg-[#3CBEDB]/90 transition-colors">
                    <PlusCircle className="h-4 w-4" />
                    Crédito por proyecto
                  </button>
                  <button onClick={() => router.push('/credito/factoraje/nuevo')}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-[#1A1A1A] text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <PlusCircle className="h-4 w-4" />
                    Factoraje
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-xs text-[#6B7280] font-medium text-left px-6 py-3">Tipo</th>
                      <th className="text-xs text-[#6B7280] font-medium text-left py-3">Solicitud</th>
                      <th className="text-xs text-[#6B7280] font-medium text-right py-3">Monto</th>
                      <th className="text-xs text-[#6B7280] font-medium text-center py-3">Estado</th>
                      <th className="text-xs text-[#6B7280] font-medium text-right py-3 pr-6">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(r => (
                      <tr key={r.id}
                        onClick={() => router.push(`/dashboard/credito/${r.id}`)}
                        className="hover:bg-slate-50/60 cursor-pointer transition-colors">
                        <td className="px-6 py-4">
                          <TipoBadge tipo={r.tipo} />
                        </td>
                        <td className="py-4">
                          <p className="text-sm font-medium text-[#1A1A1A] max-w-[220px] truncate">{r.title}</p>
                          <p className="text-xs text-[#6B7280] mt-0.5 truncate max-w-[220px]">{r.subtitle}</p>
                        </td>
                        <td className="py-4 text-right">
                          <p className="text-sm font-semibold text-[#1A1A1A]">
                            {r.monto ? formatMXN(r.monto) : '—'}
                          </p>
                        </td>
                        <td className="py-4 text-center">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-4 text-right pr-6 text-xs text-[#6B7280]">
                          {formatDate(r.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
