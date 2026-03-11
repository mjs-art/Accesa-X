'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getProyectoAction, getDocumentUrlAction } from '@/app/actions/proyecto'
import { getFactorajeAction } from '@/app/actions/factoraje'
import type { SolicitudProyecto, ProyectoStatus } from '@/app/actions/proyecto'
import type { SolicitudFactoraje } from '@/app/actions/factoraje'
import {
  Loader2, FileText, CheckCircle2, Clock, AlertTriangle,
  XCircle, ChevronRight, ExternalLink,
} from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_CONFIG: Record<ProyectoStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  borrador:        { label: 'Borrador',              bg: 'bg-slate-50',     text: 'text-slate-600',   border: 'border-slate-200',   icon: <FileText className="h-5 w-5 text-slate-400" /> },
  submitted:       { label: 'Enviada',               bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200',    icon: <Clock className="h-5 w-5 text-blue-500" /> },
  en_revision:     { label: 'En revisión',           bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200',    icon: <Clock className="h-5 w-5 text-blue-500" /> },
  docs_pendientes: { label: 'Documentos pendientes', bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   icon: <AlertTriangle className="h-5 w-5 text-amber-500" /> },
  aprobado:        { label: 'Aprobada',              bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
  fondos_liberados:{ label: 'Fondos liberados',      bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
  en_ejecucion:    { label: 'En ejecución',          bg: 'bg-[#3CBEDB]/10',text: 'text-[#1A7A8A]',  border: 'border-[#3CBEDB]/30',icon: <ChevronRight className="h-5 w-5 text-[#3CBEDB]" /> },
  liquidado:       { label: 'Liquidado',             bg: 'bg-slate-50',    text: 'text-slate-500',   border: 'border-slate-200',   icon: <CheckCircle2 className="h-5 w-5 text-slate-400" /> },
  rechazado:       { label: 'Rechazada',             bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200',     icon: <XCircle className="h-5 w-5 text-red-500" /> },
}

const TIMELINE_PROYECTO: { status: ProyectoStatus; label: string }[] = [
  { status: 'borrador',        label: 'Borrador creado' },
  { status: 'en_revision',     label: 'En revisión por AccesaX' },
  { status: 'aprobado',        label: 'Solicitud aprobada' },
  { status: 'fondos_liberados',label: 'Fondos liberados' },
  { status: 'en_ejecucion',    label: 'Proyecto en ejecución' },
  { status: 'liquidado',       label: 'Crédito liquidado' },
]

const TIMELINE_FACTORAJE: { status: ProyectoStatus; label: string }[] = [
  { status: 'borrador',        label: 'Solicitud creada' },
  { status: 'en_revision',     label: 'En revisión por AccesaX' },
  { status: 'aprobado',        label: 'Factoraje aprobado' },
  { status: 'fondos_liberados',label: 'Recursos dispersados' },
  { status: 'en_ejecucion',    label: 'Cobranza en curso' },
  { status: 'liquidado',       label: 'Liquidado' },
]

const STATUS_ORDER = ['borrador', 'submitted', 'en_revision', 'docs_pendientes', 'aprobado', 'fondos_liberados', 'en_ejecucion', 'liquidado']

const DOC_LABELS: Record<string, string> = {
  orden_compra: 'Orden de compra',
  correo_pagador: 'Correo del pagador',
  contrato: 'Contrato del proyecto',
  factura_aceptada: 'Factura aceptada',
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DetalleSolicitudPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [tipo, setTipo] = useState<'proyecto' | 'factoraje' | null>(null)
  const [proyecto, setProyecto] = useState<SolicitudProyecto | null>(null)
  const [factoraje, setFactoraje] = useState<SolicitudFactoraje | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingDoc, setOpeningDoc] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // Try proyecto first
      const pRes = await getProyectoAction(id)
      if (!('error' in pRes)) {
        setProyecto(pRes)
        setTipo('proyecto')
        setLoading(false)
        return
      }
      // Try factoraje
      const fRes = await getFactorajeAction(id)
      if (!('error' in fRes)) {
        setFactoraje(fRes)
        setTipo('factoraje')
      }
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
  if (!tipo) return (
    <div className="px-8 py-8">
      <p className="text-sm text-[#6B7280]">Solicitud no encontrada.</p>
    </div>
  )

  const status = (tipo === 'proyecto' ? proyecto!.status : factoraje!.status) as ProyectoStatus
  const createdAt = tipo === 'proyecto' ? proyecto!.created_at : factoraje!.created_at
  const analystNotes = tipo === 'proyecto' ? proyecto!.analyst_notes : factoraje!.analyst_notes
  const condicionesAt = tipo === 'proyecto' ? proyecto!.condiciones_aceptadas_at : factoraje!.condiciones_aceptadas_at

  const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.borrador
  const currentIdx = STATUS_ORDER.indexOf(status)
  const timeline = tipo === 'proyecto' ? TIMELINE_PROYECTO : TIMELINE_FACTORAJE

  const pageTitle = tipo === 'proyecto'
    ? (proyecto!.project_name ?? 'Solicitud de proyecto')
    : 'Solicitud de factoraje'

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center gap-2">
        <button onClick={() => router.push('/dashboard/credito')}
          className="text-xs text-[#6B7280] hover:text-[#1A1A1A]">← Mis solicitudes</button>
        <span className="text-slate-300">/</span>
        <span className="text-xs text-[#1A1A1A] font-medium truncate max-w-[200px]">{pageTitle}</span>
      </header>

      <div className="px-8 py-8 space-y-6 max-w-4xl">

        {/* Status banner */}
        <div className={`rounded-xl border ${sc.border} ${sc.bg} px-5 py-4 flex items-center gap-4`}>
          {sc.icon}
          <div>
            <p className={`text-sm font-semibold ${sc.text}`}>{sc.label}</p>
            {status === 'en_revision' && (
              <p className={`text-xs mt-0.5 ${sc.text} opacity-80`}>
                Nuestro equipo revisará tu solicitud en 24–48 horas hábiles.
              </p>
            )}
            {status === 'docs_pendientes' && analystNotes && (
              <p className={`text-xs mt-0.5 ${sc.text} opacity-80`}>{analystNotes}</p>
            )}
            {status === 'aprobado' && (
              <p className={`text-xs mt-0.5 ${sc.text} opacity-80`}>
                Te contactaremos para coordinar la dispersión de fondos.
              </p>
            )}
            {status === 'rechazado' && analystNotes && (
              <p className={`text-xs mt-0.5 ${sc.text} opacity-80`}>{analystNotes}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* ── Columna principal ──────────────────────────────────────── */}
          <div className="col-span-2 space-y-5">

            {/* PROYECTO — datos */}
            {tipo === 'proyecto' && proyecto && (
              <>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Datos del proyecto</h2>
                  <div className="space-y-0 divide-y divide-slate-100">
                    {[
                      { label: 'Nombre', value: proyecto.project_name ?? '—' },
                      { label: 'Descripción', value: proyecto.descripcion_proyecto ?? '—' },
                      { label: 'Monto total contrato', value: proyecto.monto_total ? formatMXN(proyecto.monto_total) : '—' },
                      { label: `Monto financiado (${proyecto.porcentaje_anticipo ?? 80}%)`, value: proyecto.monto_solicitado ? formatMXN(proyecto.monto_solicitado) : '—' },
                      { label: 'Aportación tuya', value: proyecto.monto_total && proyecto.monto_solicitado ? formatMXN(proyecto.monto_total - proyecto.monto_solicitado) : '—' },
                      { label: 'Pagador final', value: `${proyecto.client_name ?? '—'} · ${proyecto.client_rfc ?? ''}` },
                      { label: 'Contacto pagador', value: proyecto.pagador_contacto_correo ?? '—' },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between gap-4 py-2.5">
                        <span className="text-xs text-[#6B7280] shrink-0">{r.label}</span>
                        <span className="text-xs font-medium text-[#1A1A1A] text-right">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proveedor */}
                {proyecto.proveedor && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Proveedor a pagar</h2>
                    <div className="space-y-0 divide-y divide-slate-100">
                      {[
                        { label: 'Empresa', value: proyecto.proveedor.vendor_name },
                        { label: 'RFC', value: proyecto.proveedor.vendor_rfc },
                        { label: 'CLABE', value: proyecto.proveedor.clabe },
                        { label: 'Monto a desembolsar', value: formatMXN(proyecto.proveedor.monto_asignado) },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between gap-4 py-2.5">
                          <span className="text-xs text-[#6B7280] shrink-0">{r.label}</span>
                          <span className="text-xs font-medium text-[#1A1A1A] text-right font-mono">{r.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-4">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${proyecto.proveedor.clabe_verificada ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {proyecto.proveedor.clabe_verificada ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        CLABE {proyecto.proveedor.clabe_verificada ? 'verificada' : 'pendiente'}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${proyecto.proveedor.rfc_verificado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {proyecto.proveedor.rfc_verificado ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        RFC {proyecto.proveedor.rfc_verificado ? 'verificado' : 'pendiente'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Documentos */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">
                    Documentos ({proyecto.documentos?.length ?? 0})
                  </h2>
                  {!proyecto.documentos?.length ? (
                    <p className="text-xs text-[#6B7280]">Sin documentos subidos.</p>
                  ) : (
                    <div className="space-y-2">
                      {proyecto.documentos.map(doc => (
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
              </>
            )}

            {/* FACTORAJE — CFDIs */}
            {tipo === 'factoraje' && factoraje && (
              <>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Resumen del factoraje</h2>
                  <div className="space-y-0 divide-y divide-slate-100">
                    {[
                      { label: 'Monto a recibir', value: factoraje.monto_solicitado ? formatMXN(factoraje.monto_solicitado) : '—' },
                      { label: 'Facturas descontadas', value: String(factoraje.cfdis?.length ?? 0) },
                      { label: 'Notificación al deudor', value: factoraje.notificacion_deudor ? 'Sí' : 'No' },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between gap-4 py-2.5">
                        <span className="text-xs text-[#6B7280] shrink-0">{r.label}</span>
                        <span className="text-xs font-medium text-[#1A1A1A] text-right">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">
                    Facturas descontadas ({factoraje.cfdis?.length ?? 0})
                  </h2>
                  {!factoraje.cfdis?.length ? (
                    <p className="text-xs text-[#6B7280]">Sin facturas registradas.</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-xs text-[#6B7280] font-medium text-left pb-2">Deudor</th>
                          <th className="text-xs text-[#6B7280] font-medium text-right pb-2">Nominal</th>
                          <th className="text-xs text-[#6B7280] font-medium text-right pb-2">Aforo</th>
                          <th className="text-xs text-[#6B7280] font-medium text-right pb-2">A recibir</th>
                          <th className="text-xs text-[#6B7280] font-medium text-right pb-2">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {factoraje.cfdis.map(fc => (
                          <tr key={fc.id}>
                            <td className="py-2.5">
                              <p className="text-xs font-medium text-[#1A1A1A] max-w-[160px] truncate">
                                {fc.cfdi?.receiver_name ?? fc.cfdi?.receiver_rfc ?? '—'}
                              </p>
                              <p className="text-[10px] text-[#6B7280] font-mono">{fc.cfdi?.receiver_rfc}</p>
                            </td>
                            <td className="py-2.5 text-right text-xs text-[#6B7280]">
                              {formatMXN(fc.monto_nominal)}
                            </td>
                            <td className="py-2.5 text-right text-xs text-[#6B7280]">
                              {fc.aforo_pct}%
                            </td>
                            <td className="py-2.5 text-right text-xs font-semibold text-emerald-600">
                              {formatMXN(fc.monto_a_dispersar)}
                            </td>
                            <td className="py-2.5 text-right text-xs text-[#6B7280]">
                              {fc.cfdi?.issued_at ? formatDateShort(fc.cfdi.issued_at) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200">
                          <td className="pt-2.5 text-xs font-semibold text-[#1A1A1A]">Total</td>
                          <td className="pt-2.5 text-right text-xs font-semibold text-[#1A1A1A]">
                            {formatMXN(factoraje.cfdis.reduce((s, r) => s + r.monto_nominal, 0))}
                          </td>
                          <td />
                          <td className="pt-2.5 text-right text-xs font-bold text-emerald-600">
                            {factoraje.monto_solicitado ? formatMXN(factoraje.monto_solicitado) : '—'}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Columna derecha — timeline + fechas ───────────────────── */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-5">Estado del proceso</h2>
              <div className="space-y-0">
                {timeline.map((t, i) => {
                  const tIdx = STATUS_ORDER.indexOf(t.status)
                  const done = currentIdx >= tIdx && status !== 'rechazado'
                  const current = t.status === status || (t.status === 'en_revision' && status === 'docs_pendientes')
                  return (
                    <div key={t.status} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-[#3CBEDB]' : current ? 'border-2 border-[#3CBEDB] bg-white' : 'bg-slate-200'}`}>
                          {done && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        {i < timeline.length - 1 && (
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
                {status === 'rechazado' && (
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
                  <p className="text-xs font-medium text-[#1A1A1A] mt-0.5">{formatDate(createdAt)}</p>
                </div>
                {condicionesAt && (
                  <div>
                    <p className="text-xs text-[#6B7280]">Enviada</p>
                    <p className="text-xs font-medium text-[#1A1A1A] mt-0.5">{formatDate(condicionesAt)}</p>
                  </div>
                )}
                {tipo === 'proyecto' && proyecto?.fecha_desembolso && (
                  <div>
                    <p className="text-xs text-[#6B7280]">Desembolso</p>
                    <p className="text-xs font-medium text-[#1A1A1A] mt-0.5">{formatDate(proyecto.fecha_desembolso)}</p>
                  </div>
                )}
                {tipo === 'proyecto' && proyecto?.fecha_liquidacion_est && (
                  <div>
                    <p className="text-xs text-[#6B7280]">Liquidación estimada</p>
                    <p className="text-xs font-medium text-[#1A1A1A] mt-0.5">{formatDate(proyecto.fecha_liquidacion_est)}</p>
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
