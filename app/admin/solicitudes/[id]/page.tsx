'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  getApplicationWithDetailsAction,
  getNotesAction,
  changeApplicationStatusAction,
  addNoteAction,
  getSignedDownloadUrlAction,
  getCompanyFinancialAnalisisAction,
  getFinanciamientoDocumentosAction,
  getProjectVendorAdminAction,
  verificarProveedorAdminAction,
  getFinanciamientoSignedUrlAction,
  getFactorajeCfdisAdminAction,
  liberarFondosAction,
} from '@/app/actions/admin'
import type { ApplicationDetail, InternalNote } from '@/features/admin/types/admin.types'
import type { AdminFinancialAnalisis, AdminFactorajeCfdi } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock,
  DollarSign, Download, FileText, Loader2, TrendingUp, Sparkles,
} from 'lucide-react'

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

const TIPO_LABELS: Record<string, string> = {
  proyecto:  'Crédito por proyecto',
  factoraje: 'Factoraje',
}

function RiesgoBadge({ nivel }: { nivel: 'alto' | 'medio' | 'bajo' }) {
  const map = {
    alto: 'bg-red-100 text-red-700 border-red-200',
    medio: 'bg-amber-100 text-amber-700 border-amber-200',
    bajo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[nivel]}`}>
      {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
    </span>
  )
}

function formatMXN(n: number, moneda = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getFileName(path: string) {
  return path.split('/').pop() ?? path
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function AdminSolicitudPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [app, setApp] = useState<ApplicationDetail | null>(null)
  const [notes, setNotes] = useState<InternalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [analisis, setAnalisis] = useState<AdminFinancialAnalisis | null>(null)
  const [financDocs, setFinancDocs] = useState<Array<{ id: string; tipo: string; storage_path: string; nombre_archivo: string | null }>>([])
  const [vendor, setVendor] = useState<{ id: string; vendor_name: string; vendor_rfc: string; clabe: string; monto_asignado: number; clabe_verificada: boolean; rfc_verificado: boolean } | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [factorajeCfdis, setFactorajeCfdis] = useState<AdminFactorajeCfdi[]>([])

  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [approveOpen, setApproveOpen] = useState(false)

  const [dispersarOpen, setDispersarOpen] = useState(false)
  const [dispersarReferencia, setDispersarReferencia] = useState('')
  const [dispersarMonto, setDispersarMonto] = useState('')
  const [dispersarFechaLiq, setDispersarFechaLiq] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { init() }, [id])

  async function init() {
    setLoading(true)
    const [appResult, notesResult, docsResult, vendorResult, fcResult] = await Promise.all([
      getApplicationWithDetailsAction(id),
      getNotesAction(id),
      getFinanciamientoDocumentosAction(id),
      getProjectVendorAdminAction(id),
      getFactorajeCfdisAdminAction(id),
    ])
    const appData = 'application' in appResult ? appResult.application ?? null : null
    if (appData) {
      setApp(appData)
      // Load financial analysis if company has RFC
      if (appData.company?.id && appData.company?.rfc) {
        const analisisResult = await getCompanyFinancialAnalisisAction(appData.company.id, appData.company.rfc)
        if (!('error' in analisisResult)) setAnalisis(analisisResult)
      }
    }
    if ('notes' in notesResult) setNotes(notesResult.notes ?? [])
    if ('docs' in docsResult) setFinancDocs(docsResult.docs as typeof financDocs)
    if ('vendor' in vendorResult) setVendor(vendorResult.vendor as typeof vendor)
    if (Array.isArray(fcResult)) setFactorajeCfdis(fcResult)
    setLoading(false)
  }

  async function refreshNotes() {
    const result = await getNotesAction(id)
    if ('notes' in result) setNotes(result.notes ?? [])
  }

  async function changeStatus(newStatus: 'en_revision' | 'docs_pendientes' | 'aprobado' | 'fondos_liberados' | 'en_ejecucion' | 'liquidado' | 'rechazado', auditText: string) {
    setUpdatingStatus(true)
    const result = await changeApplicationStatusAction(id, newStatus, auditText)
    if ('error' in result) {
      toast({ title: 'Error al actualizar', description: result.error, variant: 'destructive' })
      setUpdatingStatus(false)
      return false
    }
    setApp((prev) => prev ? { ...prev, status: newStatus } : prev)
    await refreshNotes()
    setUpdatingStatus(false)
    return true
  }

  async function handleMarkReviewing() {
    const ok = await changeStatus('en_revision', 'Estado cambiado a "Revisando"')
    if (ok) toast({ title: 'Solicitud en revisión' })
  }

  async function handleApprove() {
    const ok = await changeStatus('aprobado', 'Solicitud APROBADA')
    if (ok) {
      toast({ title: 'Solicitud aprobada' })
      setApproveOpen(false)
    }
  }

  async function handleLiberarFondos() {
    if (!dispersarReferencia.trim() || !dispersarMonto || !dispersarFechaLiq) return
    setUpdatingStatus(true)
    const result = await liberarFondosAction(
      id,
      dispersarReferencia.trim(),
      parseFloat(dispersarMonto),
      dispersarFechaLiq,
    )
    setUpdatingStatus(false)
    if ('error' in result) {
      toast({ title: 'Error al liberar fondos', description: result.error, variant: 'destructive' })
      return
    }
    setApp(prev => prev ? { ...prev, status: 'fondos_liberados' } : prev)
    await refreshNotes()
    setDispersarOpen(false)
    setDispersarReferencia('')
    setDispersarMonto('')
    setDispersarFechaLiq('')
    toast({ title: 'Fondos liberados correctamente' })
  }

  async function handleEnEjecucion() {
    const ok = await changeStatus('en_ejecucion', 'Proyecto marcado en ejecución')
    if (ok) toast({ title: 'Marcado como en ejecución' })
  }

  async function handleLiquidar() {
    const ok = await changeStatus('liquidado', 'Crédito liquidado en su totalidad')
    if (ok) toast({ title: 'Crédito marcado como liquidado' })
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    const ok = await changeStatus('rechazado', `Solicitud RECHAZADA. Razón: ${rejectReason.trim()}`)
    if (ok) {
      toast({ title: 'Solicitud rechazada' })
      setRejectOpen(false)
      setRejectReason('')
    }
  }

  async function handleAddNote() {
    if (!newNote.trim() || addingNote) return
    setAddingNote(true)
    const result = await addNoteAction(id, newNote.trim())
    if ('error' in result) {
      toast({ title: 'Error al guardar nota', variant: 'destructive' })
    } else {
      setNewNote('')
      await refreshNotes()
    }
    setAddingNote(false)
  }

  async function handleDownload(storagePath: string) {
    const result = await getSignedDownloadUrlAction(storagePath)
    if ('signedUrl' in result) window.open(result.signedUrl, '_blank')
    else toast({ title: 'No se pudo generar el enlace de descarga', variant: 'destructive' })
  }

  async function handleVerificar(campo: 'clabe' | 'rfc') {
    if (!vendor) return
    setVerifying(campo)
    const res = await verificarProveedorAdminAction(vendor.id, campo)
    setVerifying(null)
    if ('ok' in res) {
      setVendor(prev => prev ? { ...prev, [`${campo}_verificada`]: true, rfc_verificado: campo === 'rfc' ? true : prev.rfc_verificado, clabe_verificada: campo === 'clabe' ? true : prev.clabe_verificada } : prev)
      toast({ title: `${campo === 'clabe' ? 'CLABE' : 'RFC'} marcado como verificado` })
    }
  }

  async function handleOpenFinancDoc(path: string) {
    const res = await getFinanciamientoSignedUrlAction(path)
    if ('url' in res) window.open(res.url, '_blank')
    else toast({ title: 'No se pudo abrir el documento', variant: 'destructive' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-[#6B7280]" />
      </div>
    )
  }

  if (!app) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#6B7280]">Solicitud no encontrada.</p>
        <Button variant="ghost" onClick={() => router.push('/admin')} className="mt-4">Volver</Button>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[app.status] ?? { label: app.status, classes: 'bg-slate-100 text-slate-600 border-slate-200' }
  const r = app.contract?.analysisResult
  const viabilidadColor = r
    ? r.viabilidad_score >= 70 ? 'bg-[#3CBEDB]' : r.viabilidad_score >= 40 ? 'bg-amber-400' : 'bg-red-500'
    : ''
  const oc = app.ordenCompraAnalysis
  const ocViabilidadColor = oc
    ? oc.viabilidad_score >= 70 ? 'bg-[#3CBEDB]' : oc.viabilidad_score >= 40 ? 'bg-amber-400' : 'bg-red-500'
    : ''

  return (
    <div className="px-8 py-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin')} className="text-[#6B7280] -ml-2">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-xl font-bold text-[#1A1A1A]">{app.company?.nombreRazonSocial ?? '—'}</h1>
        </div>
        <Badge className={`${statusCfg.classes} border px-3 py-1 font-medium`}>{statusCfg.label}</Badge>
      </div>

      {/* ── Sección 1: Empresa ─────────────────────────────────────────────── */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Datos de la empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Info label="Razón social" value={app.company?.nombreRazonSocial} />
          <Info label="RFC" value={<span className="font-mono">{app.company?.rfc}</span>} />
          <Info label="Industria" value={app.company?.industria} />
          <Info label="Tamaño" value={app.company?.tamanoEmpresa} />
          <Info
            label="Estatus SAT"
            value={
              app.company?.estatusSat ? (
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {app.company.estatusSat}
                </Badge>
              ) : '—'
            }
          />
          <Info label="Fecha solicitud" value={formatDate(app.createdAt)} />
        </CardContent>
      </Card>

      {/* ── Sección 2: Detalles de la solicitud ───────────────────────────── */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Detalles de la solicitud</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Info label="Tipo de crédito" value={TIPO_LABELS[app.tipoCredito] ?? app.tipoCredito} />
          <Info label="Monto solicitado" value={<span className="text-base font-bold text-[#1A1A1A]">{formatMXN(app.montoSolicitado)}</span>} />
          <Info label="Plazo" value={`${app.plazoMeses} meses`} />
          {app.resolvedAt && <Info label="Fecha resolución" value={formatDate(app.resolvedAt)} />}
          {app.projectName && <Info label="Proyecto" value={app.projectName} />}
          {app.clientName && <Info label="Cliente del proyecto" value={app.clientName} />}
          {app.clientRfc && <Info label="RFC cliente" value={<span className="font-mono">{app.clientRfc}</span>} />}
          {app.tipoCredito === 'factoraje' && (
            <Info
              label="Notificación al deudor"
              value={app.notificacionDeudor ? 'Sí' : 'No'}
            />
          )}
          {app.porcentajeAnticipo != null && (
            <Info label="% anticipo aprobado" value={`${app.porcentajeAnticipo}%`} />
          )}
          <div className="col-span-2">
            <p className="text-xs text-[#6B7280] mb-1.5">Destino del crédito</p>
            <p className="text-sm text-[#1A1A1A] bg-slate-50 rounded-lg p-3 leading-relaxed">{app.destino}</p>
          </div>
          {app.analystNotes && (
            <div className="col-span-2">
              <p className="text-xs text-[#6B7280] mb-1.5">Notas del analista</p>
              <p className="text-sm text-[#1A1A1A] bg-amber-50 border border-amber-100 rounded-lg p-3 leading-relaxed">{app.analystNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sección 2b: CFDIs de factoraje ────────────────────────────────── */}
      {factorajeCfdis.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Facturas descontadas ({factorajeCfdis.length})</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-xs text-[#6B7280] font-medium text-left pb-2">Deudor</th>
                  <th className="text-xs text-[#6B7280] font-medium text-left pb-2">UUID</th>
                  <th className="text-xs text-[#6B7280] font-medium text-right pb-2">Nominal</th>
                  <th className="text-xs text-[#6B7280] font-medium text-right pb-2">Aforo</th>
                  <th className="text-xs text-[#6B7280] font-medium text-right pb-2">A dispersar</th>
                  <th className="text-xs text-[#6B7280] font-medium text-right pb-2">Emisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {factorajeCfdis.map(fc => (
                  <tr key={fc.id}>
                    <td className="py-2.5">
                      <p className="text-xs font-medium text-[#1A1A1A] max-w-[160px] truncate">{fc.receiver_name ?? fc.receiver_rfc}</p>
                      <p className="text-[10px] text-[#6B7280] font-mono">{fc.receiver_rfc}</p>
                    </td>
                    <td className="py-2.5 font-mono text-xs text-[#6B7280]">{fc.cfdi_uuid.slice(0, 8).toUpperCase()}…</td>
                    <td className="py-2.5 text-right text-xs text-[#6B7280]">{formatMXN(fc.monto_nominal)}</td>
                    <td className="py-2.5 text-right text-xs text-[#6B7280]">{fc.aforo_pct}%</td>
                    <td className="py-2.5 text-right text-xs font-semibold text-emerald-600">{formatMXN(fc.monto_a_dispersar)}</td>
                    <td className="py-2.5 text-right text-xs text-[#6B7280]">
                      {fc.issued_at ? new Date(fc.issued_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td className="pt-2.5 text-xs font-semibold text-[#1A1A1A]" colSpan={2}>Total</td>
                  <td className="pt-2.5 text-right text-xs font-semibold text-[#1A1A1A]">
                    {formatMXN(factorajeCfdis.reduce((s, r) => s + r.monto_nominal, 0))}
                  </td>
                  <td />
                  <td className="pt-2.5 text-right text-xs font-bold text-emerald-600">
                    {formatMXN(factorajeCfdis.reduce((s, r) => s + r.monto_a_dispersar, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Sección 3: Análisis financiero del solicitante ─────────────────── */}
      {analisis && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Análisis financiero del solicitante</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!analisis.synced ? (
              <p className="text-sm text-[#6B7280]">Sin datos SAT sincronizados para esta empresa.</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'DSO', value: `${analisis.dso}d`, status: analisis.dsoStatus, hint: 'Días de cobro' },
                    { label: 'DPO', value: `${analisis.dpo}d`, status: analisis.dpoStatus, hint: 'Días de pago' },
                    { label: 'Concentración', value: `${analisis.concentracionTop}%`, status: analisis.concentracionStatus, hint: analisis.topClienteNombre },
                    { label: 'Gastos/Ingresos', value: `${analisis.ratioGastos}%`, status: analisis.ratioStatus, hint: 'Ratio mes actual' },
                  ].map(ind => {
                    const colors = ind.status === 'verde'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : ind.status === 'amarillo'
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                    return (
                      <div key={ind.label} className={`rounded-xl border p-3 ${colors}`}>
                        <p className="text-xs font-semibold opacity-70">{ind.label}</p>
                        <p className="text-xl font-bold text-[#1A1A1A] mt-1">{ind.value}</p>
                        <p className="text-xs opacity-60 mt-0.5 truncate">{ind.hint}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Por cobrar', value: formatMXN(analisis.totalPorCobrar) },
                    { label: 'Por pagar', value: formatMXN(analisis.totalPorPagar) },
                    { label: 'Capital de trabajo', value: formatMXN(analisis.capitalTrabajo), highlight: analisis.capitalTrabajo < 0 },
                  ].map(item => (
                    <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-[#6B7280]">{item.label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${item.highlight ? 'text-red-600' : 'text-[#1A1A1A]'}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Sección 4: Proveedor a pagar ───────────────────────────────────── */}
      {vendor && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Proveedor a pagar — Verificación</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Info label="Empresa" value={vendor.vendor_name} />
              <Info label="RFC" value={<span className="font-mono">{vendor.vendor_rfc}</span>} />
              <Info label="CLABE" value={<span className="font-mono tracking-widest">{vendor.clabe}</span>} />
              <Info label="Monto a desembolsar" value={<span className="font-bold text-base">{formatMXN(vendor.monto_asignado)}</span>} />
            </div>
            <div className="flex gap-3 border-t border-slate-100 pt-4">
              <Button
                onClick={() => handleVerificar('clabe')}
                disabled={vendor.clabe_verificada || verifying === 'clabe'}
                size="sm"
                className={vendor.clabe_verificada ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50' : 'bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white'}
              >
                {verifying === 'clabe' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                {vendor.clabe_verificada ? 'CLABE verificada ✓' : 'Marcar CLABE verificada'}
              </Button>
              <Button
                onClick={() => handleVerificar('rfc')}
                disabled={vendor.rfc_verificado || verifying === 'rfc'}
                size="sm"
                variant="outline"
                className={vendor.rfc_verificado ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-[#6B7280]'}
              >
                {verifying === 'rfc' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                {vendor.rfc_verificado ? 'RFC verificado ✓' : 'Marcar RFC verificado'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sección 5: Documentos del proyecto ─────────────────────────────── */}
      {financDocs.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Documentos del proyecto ({financDocs.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {financDocs.map(doc => {
                const labels: Record<string, string> = {
                  orden_compra: 'Orden de compra',
                  correo_pagador: 'Correo del pagador',
                  contrato: 'Contrato del proyecto',
                  factura_aceptada: 'Factura aceptada',
                }
                const isRequired = ['orden_compra', 'correo_pagador'].includes(doc.tipo)
                return (
                  <div key={doc.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[#1A1A1A]">
                          {labels[doc.tipo] ?? doc.tipo}
                          {isRequired && <span className="ml-1.5 text-xs text-emerald-600 font-normal">✓ requerido</span>}
                        </p>
                        <p className="text-xs text-[#6B7280] truncate max-w-[240px]">{doc.nombre_archivo}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleOpenFinancDoc(doc.storage_path)}
                      className="gap-1.5 text-[#3CBEDB] border-[#3CBEDB]/20 hover:bg-[#3CBEDB]/5">
                      <Download className="h-3.5 w-3.5" />
                      Ver
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sección 5b: Análisis de orden de compra ────────────────────────── */}
      {oc && app.tipoCredito === 'proyecto' && (
        <Card className="border-[#3CBEDB]/30 shadow-sm">
          <CardHeader className="bg-[#3CBEDB]/5 border-b border-[#3CBEDB]/20">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#3CBEDB]" />
              <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Análisis de orden de compra</CardTitle>
              <span className="ml-auto text-xs text-[#6B7280]">Claude AI</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <section>
              <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Resumen</h4>
              <p className="text-sm text-[#1A1A1A] bg-slate-50 rounded-lg p-3 leading-relaxed">{oc.resumen}</p>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 flex gap-2.5">
                <DollarSign className="h-4 w-4 text-[#3CBEDB] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-[#6B7280]">Monto detectado</p>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{oc.monto_total ? formatMXN(oc.monto_total, oc.moneda) : '—'}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 flex gap-2.5">
                <FileText className="h-4 w-4 text-[#3CBEDB] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-[#6B7280]">Cliente pagador</p>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{oc.cliente_nombre || '—'}</p>
                  {oc.cliente_rfc && <p className="text-xs text-[#6B7280] font-mono mt-0.5">{oc.cliente_rfc}</p>}
                </div>
              </div>
            </section>

            {oc.descripcion_servicio && (
              <section>
                <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Servicio / Producto</h4>
                <p className="text-sm text-[#1A1A1A] bg-slate-50 rounded-lg p-3">{oc.descripcion_servicio}</p>
              </section>
            )}

            {oc.riesgos?.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Riesgos</h4>
                <ul className="space-y-2">
                  {oc.riesgos.map((riesgo, i) => (
                    <li key={i} className="flex items-start gap-2.5 bg-slate-50 rounded-lg p-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="flex-1 text-sm text-[#1A1A1A]">{riesgo.descripcion}</p>
                      <RiesgoBadge nivel={riesgo.nivel} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#1A1A1A]" />
                  <h4 className="text-sm font-semibold text-[#1A1A1A]">Score de viabilidad</h4>
                </div>
                <span className="text-2xl font-bold text-[#1A1A1A]">
                  {oc.viabilidad_score}<span className="text-sm text-[#6B7280] font-normal">/100</span>
                </span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full ${ocViabilidadColor}`} style={{ width: `${oc.viabilidad_score}%` }} />
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{oc.viabilidad_razon}</p>
            </section>
          </CardContent>
        </Card>
      )}

      {/* ── Sección 6: Contrato de respaldo ───────────────────────────────── */}
      {app.contract && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Contrato de respaldo</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(app.contract!.storagePath)}
                className="gap-1.5 text-[#1A1A1A] border-[#3CBEDB]/20 hover:bg-[#3CBEDB]/5"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-2 text-sm text-[#6B7280]">
              <FileText className="h-4 w-4" />
              {getFileName(app.contract.storagePath)}
            </div>

            {r && (
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <section>
                  <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Resumen</h4>
                  <p className="text-sm text-[#1A1A1A] bg-slate-50 rounded-lg p-3 leading-relaxed">{r.resumen}</p>
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 flex gap-2.5">
                    <DollarSign className="h-4 w-4 text-[#3CBEDB] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-[#6B7280]">Monto contrato</p>
                      <p className="text-sm font-semibold text-[#1A1A1A]">{r.monto_total ? formatMXN(r.monto_total, r.moneda) : '—'}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 flex gap-2.5">
                    <FileText className="h-4 w-4 text-[#3CBEDB] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-[#6B7280]">Cliente del contrato</p>
                      <p className="text-sm font-semibold text-[#1A1A1A]">{r.cliente_nombre || '—'}</p>
                    </div>
                  </div>
                </section>

                {r.fechas_pago?.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Fechas de pago</h4>
                    <div className="flex flex-wrap gap-2">
                      {r.fechas_pago.map((f, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1">{f}</span>
                      ))}
                    </div>
                  </section>
                )}

                {r.entregables?.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Entregables</h4>
                    <ul className="space-y-1.5">
                      {r.entregables.map((e, i) => (
                        <li key={i} className="flex gap-2 text-sm text-[#1A1A1A]">
                          <CheckCircle2 className="h-4 w-4 text-[#3CBEDB] shrink-0 mt-0.5" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {r.riesgos?.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Riesgos</h4>
                    <ul className="space-y-2">
                      {r.riesgos.map((riesgo, i) => (
                        <li key={i} className="flex items-start gap-2.5 bg-slate-50 rounded-lg p-3">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="flex-1 text-sm text-[#1A1A1A]">{riesgo.descripcion}</p>
                          <RiesgoBadge nivel={riesgo.nivel} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#1A1A1A]" />
                      <h4 className="text-sm font-semibold text-[#1A1A1A]">Score de viabilidad</h4>
                    </div>
                    <span className="text-2xl font-bold text-[#1A1A1A]">
                      {r.viabilidad_score}<span className="text-sm text-[#6B7280] font-normal">/100</span>
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full ${viabilidadColor}`} style={{ width: `${r.viabilidad_score}%` }} />
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed">{r.viabilidad_razon}</p>
                </section>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Sección 4: Notas internas ──────────────────────────────────────── */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Notas internas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {notes.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Sin notas aún.</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {notes.map((note) => {
                const isSystem = note.note.startsWith('[SISTEMA]')
                return (
                  <div key={note.id} className={`rounded-lg p-3 ${isSystem ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'}`}>
                    <p className={`text-sm leading-relaxed ${isSystem ? 'text-blue-700' : 'text-[#1A1A1A]'}`}>
                      {isSystem ? note.note.replace('[SISTEMA] ', '') : note.note}
                    </p>
                    <p className="text-xs text-[#6B7280] mt-1.5">
                      {isSystem ? '⚙️ Sistema' : note.authorEmail} · {formatDate(note.createdAt)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Agregar nota interna..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/20 focus:border-[#3CBEDB] resize-none"
            />
            <Button
              onClick={handleAddNote}
              disabled={!newNote.trim() || addingNote}
              size="sm"
              className="bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white"
            >
              {addingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Agregar nota
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Sección 5: Acciones ────────────────────────────────────────────── */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Acciones</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={handleMarkReviewing}
            disabled={updatingStatus || app.status === 'en_revision'}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-40"
          >
            {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Clock className="h-4 w-4 mr-1.5" />}
            Marcar en revisión
          </Button>

          <Button
            onClick={() => setApproveOpen(true)}
            disabled={updatingStatus || app.status === 'aprobado'}
            className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Aprobar
          </Button>

          <Button
            onClick={() => setDispersarOpen(true)}
            disabled={updatingStatus || app.status !== 'aprobado'}
            variant="outline"
            className="border-teal-200 text-teal-700 hover:bg-teal-50 disabled:opacity-40"
          >
            Liberar fondos
          </Button>

          <Button
            onClick={handleEnEjecucion}
            disabled={updatingStatus || !['fondos_liberados'].includes(app.status)}
            variant="outline"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
          >
            Marcar en ejecución
          </Button>

          <Button
            onClick={handleLiquidar}
            disabled={updatingStatus || app.status === 'liquidado'}
            variant="outline"
            className="border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Liquidar
          </Button>

          <Button
            onClick={() => setRejectOpen(true)}
            disabled={updatingStatus || app.status === 'rechazado'}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            Rechazar
          </Button>

          <Button
            onClick={async () => {
              const notas = prompt('Indica qué documentos adicionales se necesitan:')
              if (!notas?.trim()) return
              const ok = await changeStatus('docs_pendientes', `Documentos adicionales requeridos: ${notas.trim()}`)
              if (ok) toast({ title: 'Solicitud regresada al cliente' })
            }}
            disabled={updatingStatus || ['docs_pendientes', 'liquidado', 'rechazado'].includes(app.status)}
            variant="outline"
            className="border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Pedir más docs
          </Button>
        </CardContent>
      </Card>

      {/* ── Modal: Aprobar ─────────────────────────────────────────────────── */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#1A1A1A]">Confirmar aprobación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6B7280]">
            ¿Confirmas que deseas <strong>aprobar</strong> la solicitud de{' '}
            <strong>{app.company?.nombreRazonSocial}</strong> por{' '}
            <strong>{formatMXN(app.montoSolicitado)}</strong>?
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setApproveOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Sí, aprobar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Liberar fondos ──────────────────────────────────────────── */}
      <Dialog open={dispersarOpen} onOpenChange={setDispersarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#1A1A1A]">Liberar fondos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6B7280]">
            Registra los datos de la dispersión para{' '}
            <strong>{app.company?.nombreRazonSocial}</strong>.
          </p>
          <div className="space-y-3 mt-1">
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">Referencia bancaria / SPEI</label>
              <input
                type="text"
                value={dispersarReferencia}
                onChange={e => setDispersarReferencia(e.target.value)}
                placeholder="Ej. SPEI-20240315-001"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/20 focus:border-[#3CBEDB]"
              />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">Monto dispersado (MXN)</label>
              <input
                type="number"
                value={dispersarMonto}
                onChange={e => setDispersarMonto(e.target.value)}
                placeholder={String(app.montoSolicitado)}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/20 focus:border-[#3CBEDB]"
              />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">Fecha de liquidación estimada</label>
              <input
                type="date"
                value={dispersarFechaLiq}
                onChange={e => setDispersarFechaLiq(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/20 focus:border-[#3CBEDB]"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setDispersarOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleLiberarFondos}
              disabled={!dispersarReferencia.trim() || !dispersarMonto || !dispersarFechaLiq || updatingStatus}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {updatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Confirmar dispersión
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Rechazar ────────────────────────────────────────────────── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6B7280]">Escribe la razón del rechazo (se guardará en el historial):</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Razón del rechazo..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Rechazar solicitud
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Helper: fila de info ───────────────────────────────────────────────────────
function Info({ label, value }: { label: string; value: React.ReactNode | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-[#6B7280] mb-1">{label}</p>
      <div className="text-sm font-medium text-[#1A1A1A]">{value ?? '—'}</div>
    </div>
  )
}
