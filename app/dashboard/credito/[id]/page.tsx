'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getProyectoAction, getDocumentUrlAction } from '@/app/actions/proyecto'
import type { SolicitudProyecto, ProyectoStatus } from '@/app/actions/proyecto'
import { Loader2, FileText, CheckCircle2, Clock, AlertTriangle, XCircle, ChevronRight, ExternalLink } from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_CONFIG: Record<ProyectoStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  borrador:        { label: 'Borrador',         bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200',  icon: <FileText className="h-5 w-5 text-slate-400" /> },
  submitted:       { label: 'Enviada',           bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   icon: <Clock className="h-5 w-5 text-blue-500" /> },
  en_revision:     { label: 'En revisión',       bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   icon: <Clock className="h-5 w-5 text-blue-500" /> },
  docs_pendientes: { label: 'Documentos pendientes', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',  icon: <AlertTriangle className="h-5 w-5 text-amber-500" /> },
  aprobado:        { label: 'Aprobada',          bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
  fondos_liberados:{ label: 'Fondos liberados',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
  en_ejecucion:    { label: 'En ejecución',      bg: 'bg-[#3CBEDB]/10',text: 'text-[#1A7A8A]', border: 'border-[#3CBEDB]/30',icon: <ChevronRight className="h-5 w-5 text-[#3CBEDB]" /> },
  liquidado:       { label: 'Liquidado',         bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',  icon: <CheckCircle2 className="h-5 w-5 text-slate-400" /> },
  rechazado:       { label: 'Rechazada',         bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',    icon: <XCircle className="h-5 w-5 text-red-500" /> },
}

const TIMELINE: { status: ProyectoStatus; label: string }[] = [
  { status: 'borrador', label: 'Borrador creado' },
  { status: 'en_revision', label: 'En revisión por AccesaX' },
  { status: 'aprobado', label: 'Solicitud aprobada' },
  { status: 'fondos_liberados', label: 'Fondos liberados' },
  { status: 'en_ejecucion', label: 'Proyecto en ejecución' },
  { status: 'liquidado', label: 'Crédito liquidado' },
]

const STATUS_ORDER = ['borrador', 'submitted', 'en_revision', 'docs_pendientes', 'aprobado', 'fondos_liberados', 'en_ejecucion', 'liquidado']

const DOC_LABELS: Record<string, string> = {
  orden_compra: 'Orden de compra',
  correo_pagador: 'Correo del pagador',
  contrato: 'Contrato del proyecto',
  factura_aceptada: 'Factura aceptada',
}

export default function DetalleSolicitudPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<SolicitudProyecto | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingDoc, setOpeningDoc] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const res = await getProyectoAction(id)
      if (!('error' in res)) setData(res)
      setLoading(false)
    }
    load()
  }, [id])

  async function openDoc(path: string) {
    setOpeningDoc(path)
    const res = await getDocumentUrlAction(path)
    setOpeningDoc(null)
    if (!('error' in res)) window.open(res.url, '_blank')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-[#3CBEDB]" />
    </div>
  )

  if (!data) return (
    <div className="px-8 py-8">
      <p className="text-sm text-[#6B7280]">Solicitud no encontrada.</p>
    </div>
  )

  const sc = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.borrador
  const currentIdx = STATUS_ORDER.indexOf(data.status)

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center gap-2">
        <button onClick={() => router.push('/dashboard/credito')}
          className="text-xs text-[#6B7280] hover:text-[#1A1A1A]">← Mis solicitudes</button>
        <span className="text-slate-300">/</span>
        <span className="text-xs text-[#1A1A1A] font-medium truncate max-w-[200px]">
          {data.project_name ?? 'Solicitud'}
        </span>
      </header>

      <div className="px-8 py-8 space-y-6 max-w-4xl">
        {/* Estado actual */}
        <div className={`rounded-xl border ${sc.border} ${sc.bg} px-5 py-4 flex items-center gap-4`}>
          {sc.icon}
          <div>
            <p className={`text-sm font-semibold ${sc.text}`}>{sc.label}</p>
            {data.status === 'en_revision' && (
              <p className={`text-xs mt-0.5 ${sc.text} opacity-80`}>
                Nuestro equipo revisará tu solicitud en 24–48 horas hábiles.
              </p>
            )}
            {data.status === 'docs_pendientes' && data.analyst_notes && (
              <p className={`text-xs mt-0.5 ${sc.text} opacity-80`}>{data.analyst_notes}</p>
            )}
            {data.status === 'aprobado' && (
              <p className={`text-xs mt-0.5 ${sc.text} opacity-80`}>
                Te contactaremos para coordinar el desembolso al proveedor.
              </p>
            )}
            {data.status === 'rechazado' && data.analyst_notes && (
              <p className={`text-xs mt-0.5 ${sc.text} opacity-80`}>{data.analyst_notes}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Columna izquierda — datos */}
          <div className="col-span-2 space-y-5">

            {/* Datos del proyecto */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Datos del proyecto</h2>
              <div className="space-y-0 divide-y divide-slate-100">
                {[
                  { label: 'Nombre', value: data.project_name ?? '—' },
                  { label: 'Descripción', value: data.descripcion_proyecto ?? '—' },
                  { label: 'Monto total contrato', value: data.monto_total ? formatMXN(data.monto_total) : '—' },
                  { label: `Monto financiado (${data.porcentaje_anticipo ?? 80}%)`, value: data.monto_solicitado ? formatMXN(data.monto_solicitado) : '—' },
                  { label: 'Aportación tuya', value: data.monto_total && data.monto_solicitado ? formatMXN(data.monto_total - data.monto_solicitado) : '—' },
                  { label: 'Pagador final', value: `${data.client_name ?? '—'} · ${data.client_rfc ?? ''}` },
                  { label: 'Contacto pagador', value: data.pagador_contacto_correo ?? '—' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between gap-4 py-2.5">
                    <span className="text-xs text-[#6B7280] shrink-0">{r.label}</span>
                    <span className="text-xs font-medium text-[#1A1A1A] text-right">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Proveedor */}
            {data.proveedor && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Proveedor a pagar</h2>
                <div className="space-y-0 divide-y divide-slate-100">
                  {[
                    { label: 'Empresa', value: data.proveedor.vendor_name },
                    { label: 'RFC', value: data.proveedor.vendor_rfc },
                    { label: 'CLABE', value: data.proveedor.clabe },
                    { label: 'Monto a desembolsar', value: formatMXN(data.proveedor.monto_asignado) },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between gap-4 py-2.5">
                      <span className="text-xs text-[#6B7280] shrink-0">{r.label}</span>
                      <span className="text-xs font-medium text-[#1A1A1A] text-right font-mono">{r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-4">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${data.proveedor.clabe_verificada ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {data.proveedor.clabe_verificada ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    CLABE {data.proveedor.clabe_verificada ? 'verificada' : 'pendiente verificación'}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${data.proveedor.rfc_verificado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {data.proveedor.rfc_verificado ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    RFC {data.proveedor.rfc_verificado ? 'verificado' : 'pendiente verificación'}
                  </span>
                </div>
              </div>
            )}

            {/* Documentos */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">
                Documentos subidos ({data.documentos?.length ?? 0})
              </h2>
              {!data.documentos?.length ? (
                <p className="text-xs text-[#6B7280]">Sin documentos subidos.</p>
              ) : (
                <div className="space-y-2">
                  {data.documentos.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-[#1A1A1A]">{DOC_LABELS[doc.tipo] ?? doc.tipo}</p>
                          <p className="text-xs text-[#6B7280] truncate max-w-[200px]">{doc.nombre_archivo}</p>
                        </div>
                      </div>
                      <button onClick={() => openDoc(doc.storage_path)}
                        disabled={openingDoc === doc.storage_path}
                        className="flex items-center gap-1 text-xs text-[#3CBEDB] hover:text-[#3CBEDB]/80 disabled:opacity-50">
                        {openingDoc === doc.storage_path
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <ExternalLink className="h-3.5 w-3.5" />}
                        Ver
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha — timeline */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-5">Estado del proceso</h2>
              <div className="space-y-0">
                {TIMELINE.map((t, i) => {
                  const tIdx = STATUS_ORDER.indexOf(t.status)
                  const done = currentIdx >= tIdx && data.status !== 'rechazado'
                  const current = t.status === data.status || (t.status === 'en_revision' && data.status === 'docs_pendientes')
                  return (
                    <div key={t.status} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-[#3CBEDB]' : current ? 'border-2 border-[#3CBEDB] bg-white' : 'bg-slate-200'}`}>
                          {done && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        {i < TIMELINE.length - 1 && (
                          <div className={`w-0.5 h-8 mt-0.5 ${done ? 'bg-[#3CBEDB]/40' : 'bg-slate-200'}`} />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className={`text-xs font-medium ${done || current ? 'text-[#1A1A1A]' : 'text-slate-400'}`}>
                          {t.label}
                        </p>
                      </div>
                    </div>
                  )
                })}
                {data.status === 'rechazado' && (
                  <div className="flex gap-3 mt-1">
                    <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                      <XCircle className="h-3 w-3 text-white" />
                    </div>
                    <p className="text-xs font-medium text-red-600">Solicitud rechazada</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">Fechas</h2>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-[#6B7280]">Creada</p>
                  <p className="text-xs font-medium text-[#1A1A1A] mt-0.5">{formatDate(data.created_at)}</p>
                </div>
                {data.condiciones_aceptadas_at && (
                  <div>
                    <p className="text-xs text-[#6B7280]">Enviada</p>
                    <p className="text-xs font-medium text-[#1A1A1A] mt-0.5">{formatDate(data.condiciones_aceptadas_at)}</p>
                  </div>
                )}
                {data.fecha_desembolso && (
                  <div>
                    <p className="text-xs text-[#6B7280]">Desembolso</p>
                    <p className="text-xs font-medium text-[#1A1A1A] mt-0.5">{formatDate(data.fecha_desembolso)}</p>
                  </div>
                )}
                {data.fecha_liquidacion_est && (
                  <div>
                    <p className="text-xs text-[#6B7280]">Liquidación estimada</p>
                    <p className="text-xs font-medium text-[#1A1A1A] mt-0.5">{formatDate(data.fecha_liquidacion_est)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
