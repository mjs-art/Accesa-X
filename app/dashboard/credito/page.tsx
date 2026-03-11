'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProyectosAction } from '@/app/actions/proyecto'
import type { SolicitudProyecto, ProyectoStatus } from '@/app/actions/proyecto'
import { Loader2, PlusCircle, FileText, RefreshCw } from 'lucide-react'

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

export default function MisSolicitudesPage() {
  const router = useRouter()
  const [data, setData] = useState<SolicitudProyecto[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await getProyectosAction()
    if (!('error' in res)) setData(res)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const enRevision = data.filter(d => ['submitted', 'en_revision', 'docs_pendientes'].includes(d.status)).length
  const aprobadas  = data.filter(d => ['aprobado', 'fondos_liberados', 'en_ejecucion'].includes(d.status)).length
  const totalMonto = data.reduce((s, d) => s + (d.monto_solicitado ?? 0), 0)

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A1A1A]">Financiamiento — Mis solicitudes</span>
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={loading} className="text-[#6B7280] hover:text-[#1A1A1A] disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => router.push('/credito/proyecto/nuevo')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3CBEDB] text-white text-xs font-medium rounded-lg hover:bg-[#3CBEDB]/90 transition-colors">
            <PlusCircle className="h-3.5 w-3.5" />
            Nueva solicitud
          </button>
        </div>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Mis solicitudes</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Créditos por proyecto solicitados a AccesaX</p>
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
                { label: 'Total solicitado', value: totalMonto > 0 ? formatMXN(totalMonto) : '—', sub: `${data.length} solicitud${data.length !== 1 ? 'es' : ''}` },
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

            {/* Lista */}
            {data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <FileText className="h-10 w-10 text-slate-300 mb-4" />
                <p className="text-sm font-medium text-[#1A1A1A]">Sin solicitudes aún</p>
                <p className="text-xs text-[#6B7280] mt-1 mb-6">Solicita un crédito por proyecto para financiar tus operaciones</p>
                <button onClick={() => router.push('/credito/proyecto/nuevo')}
                  className="flex items-center gap-2 px-4 py-2 bg-[#3CBEDB] text-white text-sm font-medium rounded-lg hover:bg-[#3CBEDB]/90 transition-colors">
                  <PlusCircle className="h-4 w-4" />
                  Nueva solicitud
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-xs text-[#6B7280] font-medium text-left px-6 py-3">Proyecto</th>
                      <th className="text-xs text-[#6B7280] font-medium text-left py-3">Pagador final</th>
                      <th className="text-xs text-[#6B7280] font-medium text-right py-3">Monto financiado</th>
                      <th className="text-xs text-[#6B7280] font-medium text-center py-3">Estado</th>
                      <th className="text-xs text-[#6B7280] font-medium text-right py-3 pr-6">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map(s => (
                      <tr key={s.id}
                        onClick={() => router.push(`/dashboard/credito/${s.id}`)}
                        className="hover:bg-slate-50/60 cursor-pointer transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-[#1A1A1A] max-w-[200px] truncate">
                            {s.project_name ?? 'Sin nombre'}
                          </p>
                          <p className="text-xs text-[#6B7280] mt-0.5 truncate max-w-[200px]">
                            {s.descripcion_proyecto ?? '—'}
                          </p>
                        </td>
                        <td className="py-4">
                          <p className="text-sm text-[#1A1A1A] max-w-[160px] truncate">{s.client_name ?? '—'}</p>
                          <p className="text-xs text-[#6B7280] font-mono">{s.client_rfc ?? ''}</p>
                        </td>
                        <td className="py-4 text-right">
                          <p className="text-sm font-semibold text-[#1A1A1A]">
                            {s.monto_solicitado ? formatMXN(s.monto_solicitado) : '—'}
                          </p>
                          {s.monto_total && (
                            <p className="text-xs text-[#6B7280] mt-0.5">
                              de {formatMXN(s.monto_total)}
                            </p>
                          )}
                        </td>
                        <td className="py-4 text-center">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="py-4 text-right pr-6 text-xs text-[#6B7280]">
                          {formatDate(s.created_at)}
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
