'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProyectoAction, uploadDocumentoAction, submitProyectoAction, analyzeOrdenCompraAction } from '@/app/actions/proyecto'
import { getAnalisisAction } from '@/app/actions/inteligencia'
import type { CreateProyectoInput, OrdenCompraAnalysis } from '@/app/actions/proyecto'
import { CheckCircle2, ChevronRight, Loader2, Upload, X, AlertTriangle, Check, TrendingUp, Sparkles } from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function isCorreoCorporativo(email: string) {
  const personales = ['gmail', 'hotmail', 'outlook', 'yahoo', 'icloud', 'live']
  const domain = email.split('@')[1] ?? ''
  return !personales.some(p => domain.includes(p))
}

function validarCLABE(clabe: string) {
  return /^\d{18}$/.test(clabe.replace(/\s/g, ''))
}

const STEPS = [
  { num: 1, label: 'El proyecto' },
  { num: 2, label: 'Pagador final' },
  { num: 3, label: 'Proveedor' },
  { num: 4, label: 'Documentos' },
  { num: 5, label: 'Confirmar' },
]

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
              s.num < current ? 'bg-[#3CBEDB] border-[#3CBEDB] text-white'
              : s.num === current ? 'bg-white border-[#3CBEDB] text-[#3CBEDB]'
              : 'bg-white border-slate-200 text-slate-400'
            }`}>
              {s.num < current ? <Check className="h-4 w-4" /> : s.num}
            </div>
            <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${s.num === current ? 'text-[#1A1A1A]' : 'text-slate-400'}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-10 mb-5 mx-1 ${s.num < current ? 'bg-[#3CBEDB]' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function Field({ label, error, children, hint }: {
  label: string; error?: string; children: React.ReactNode; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-[#6B7280] mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/30 focus:border-[#3CBEDB] placeholder:text-slate-400"

type FormState = {
  project_name: string
  descripcion_proyecto: string
  monto_total: string
  porcentaje_anticipo: number
  client_name: string
  client_rfc: string
  pagador_contacto_nombre: string
  pagador_contacto_correo: string
  proveedor_nombre: string
  proveedor_rfc: string
  proveedor_clabe: string
  proveedor_monto: string
}

const INIT: FormState = {
  project_name: '', descripcion_proyecto: '', monto_total: '', porcentaje_anticipo: 80,
  client_name: '', client_rfc: '', pagador_contacto_nombre: '', pagador_contacto_correo: '',
  proveedor_nombre: '', proveedor_rfc: '', proveedor_clabe: '', proveedor_monto: '',
}

export default function NuevoProyectoPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(INIT)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [docs, setDocs] = useState<Record<string, File | null>>({
    orden_compra: null, correo_pagador: null, contrato: null, factura_aceptada: null,
  })
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [uploadedDocs, setUploadedDocs] = useState<Set<string>>(new Set())
  const [analisis, setAnalisis] = useState<{ dso: number; dpo: number; capitalTrabajo: number } | null>(null)
  const [ordenAnalysis, setOrdenAnalysis] = useState<OrdenCompraAnalysis | null>(null)
  const [analyzingOrden, setAnalyzingOrden] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [autoAprobado, setAutoAprobado] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const set = (k: keyof FormState, v: string | number) => setForm(f => ({ ...f, [k]: v }))
  const clearErr = (k: keyof FormState) => setErrors(e => { const n = { ...e }; delete n[k]; return n })

  const montoTotal = parseFloat(form.monto_total.replace(/,/g, '')) || 0
  const montoFinanciado = Math.round(montoTotal * (form.porcentaje_anticipo / 100))
  const aportacionCliente = montoTotal - montoFinanciado

  function validateStep1(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.project_name.trim()) e.project_name = 'Requerido'
    if (!form.descripcion_proyecto.trim()) e.descripcion_proyecto = 'Requerido'
    if (!montoTotal || montoTotal < 500_000) e.monto_total = 'Mínimo $500,000 MXN'
    if (montoTotal > 20_000_000) e.monto_total = 'Máximo $20,000,000 MXN'
    setErrors(e); return Object.keys(e).length === 0
  }

  function validateStep2(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.client_name.trim()) e.client_name = 'Requerido'
    if (!form.client_rfc.trim()) e.client_rfc = 'Requerido'
    if (!/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/i.test(form.client_rfc.trim())) e.client_rfc = 'RFC inválido'
    if (!form.pagador_contacto_nombre.trim()) e.pagador_contacto_nombre = 'Requerido'
    if (!form.pagador_contacto_correo.trim()) e.pagador_contacto_correo = 'Requerido'
    if (!isCorreoCorporativo(form.pagador_contacto_correo)) e.pagador_contacto_correo = 'Debe ser correo corporativo (no gmail/hotmail)'
    setErrors(e); return Object.keys(e).length === 0
  }

  function validateStep3(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.proveedor_nombre.trim()) e.proveedor_nombre = 'Requerido'
    if (!form.proveedor_rfc.trim()) e.proveedor_rfc = 'Requerido'
    if (!/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/i.test(form.proveedor_rfc.trim())) e.proveedor_rfc = 'RFC inválido'
    if (!validarCLABE(form.proveedor_clabe)) e.proveedor_clabe = 'CLABE debe tener 18 dígitos'
    const montoP = parseFloat(form.proveedor_monto.replace(/,/g, '')) || 0
    if (!montoP || montoP <= 0) e.proveedor_monto = 'Requerido'
    if (montoP > montoFinanciado) e.proveedor_monto = 'No puede superar el monto financiado'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleNext() {
    setGlobalError(null)
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    if (step === 3 && !validateStep3()) return

    if (step === 3) {
      setSaving(true)
      const input: CreateProyectoInput = {
        project_name: form.project_name,
        descripcion_proyecto: form.descripcion_proyecto,
        monto_total: montoTotal,
        porcentaje_anticipo: form.porcentaje_anticipo,
        client_name: form.client_name,
        client_rfc: form.client_rfc.toUpperCase(),
        pagador_contacto_nombre: form.pagador_contacto_nombre,
        pagador_contacto_correo: form.pagador_contacto_correo,
        proveedor_nombre: form.proveedor_nombre,
        proveedor_rfc: form.proveedor_rfc.toUpperCase(),
        proveedor_clabe: form.proveedor_clabe.replace(/\s/g, ''),
        proveedor_monto: parseFloat(form.proveedor_monto.replace(/,/g, '')) || 0,
      }
      const res = await createProyectoAction(input)
      setSaving(false)
      if ('error' in res) { setGlobalError(res.error); return }
      setApplicationId(res.id)

      // Cargar análisis para el paso 5
      const analisisRes = await getAnalisisAction()
      if (!('error' in analisisRes) && analisisRes.synced) {
        setAnalisis({ dso: analisisRes.dso, dpo: analisisRes.dpo, capitalTrabajo: analisisRes.capitalTrabajo })
      }
    }

    setStep(s => s + 1)
  }

  async function handleUploadDoc(tipo: string, file: File) {
    if (!applicationId) return
    setUploadingDoc(tipo)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadDocumentoAction(applicationId, tipo as 'orden_compra', fd)
    setUploadingDoc(null)
    if (!('error' in res)) {
      setUploadedDocs(prev => new Set(Array.from(prev).concat(tipo)))
      setDocs(d => ({ ...d, [tipo]: file }))

      // Analizar la orden de compra automáticamente con Claude
      if (tipo === 'orden_compra') {
        setAnalyzingOrden(true)
        analyzeOrdenCompraAction(applicationId, res.path)
          .then(r => { if (!('error' in r)) setOrdenAnalysis(r.analysis) })
          .finally(() => setAnalyzingOrden(false))
      }
    }
  }

  async function handleSubmit() {
    if (!applicationId) return
    setGlobalError(null)
    setSubmitting(true)
    const res = await submitProyectoAction(applicationId)
    setSubmitting(false)
    if ('error' in res) { setGlobalError(res.error); return }
    setAutoAprobado(res.auto_aprobado)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md w-full text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#1A1A1A]">
            {autoAprobado ? '¡Solicitud aprobada!' : 'Solicitud enviada'}
          </h1>
          <p className="text-sm text-[#6B7280] mt-2">
            {autoAprobado
              ? 'Tu solicitud fue aprobada automáticamente. Te contactaremos para coordinar el desembolso.'
              : 'Nuestro equipo revisará tu solicitud y te responderá en 24–48 horas hábiles.'}
          </p>
          <button onClick={() => router.push('/dashboard/credito')}
            className="mt-6 w-full px-4 py-2.5 bg-[#3CBEDB] text-white text-sm font-medium rounded-lg hover:bg-[#3CBEDB]/90 transition-colors">
            Ver mis solicitudes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <button onClick={() => router.push('/dashboard/credito')}
          className="text-xs text-[#6B7280] hover:text-[#1A1A1A] mb-1 block">
          ← Mis solicitudes
        </button>
        <h1 className="text-base font-semibold text-[#1A1A1A]">Nueva solicitud — Crédito por Proyecto</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex justify-center mb-8">
          <Stepper current={step} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">

          {/* Paso 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A]">El proyecto</h2>
                <p className="text-sm text-[#6B7280] mt-0.5">Cuéntanos sobre el proyecto que necesitas financiar</p>
              </div>
              <Field label="Nombre del proyecto" error={errors.project_name}>
                <input className={inputCls} placeholder="Ej. Suministro de equipo médico IMSS 2025"
                  value={form.project_name}
                  onChange={e => { set('project_name', e.target.value); clearErr('project_name') }} />
              </Field>
              <Field label="Descripción" error={errors.descripcion_proyecto}>
                <textarea className={inputCls + ' resize-none'} rows={3}
                  placeholder="Describe brevemente el alcance del proyecto..."
                  value={form.descripcion_proyecto}
                  onChange={e => { set('descripcion_proyecto', e.target.value); clearErr('descripcion_proyecto') }} />
              </Field>
              <Field label="Monto total del contrato / orden de compra" error={errors.monto_total}
                hint="Mínimo $500,000 · Máximo $20,000,000 MXN">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">$</span>
                  <input className={inputCls + ' pl-7'} placeholder="1,000,000"
                    value={form.monto_total}
                    onChange={e => { set('monto_total', e.target.value); clearErr('monto_total') }} />
                </div>
              </Field>
              <Field label={`Porcentaje a financiar: ${form.porcentaje_anticipo}%`}
                hint={montoTotal > 0 ? `AccesaX financia ${formatMXN(montoFinanciado)} · Tu aportación: ${formatMXN(aportacionCliente)}` : ''}>
                <input type="range" min={80} max={90} step={5} value={form.porcentaje_anticipo}
                  onChange={e => set('porcentaje_anticipo', parseInt(e.target.value))}
                  className="w-full accent-[#3CBEDB]" />
                <div className="flex justify-between text-xs text-[#6B7280] mt-1">
                  <span>80%</span><span>85%</span><span>90%</span>
                </div>
              </Field>
              {montoTotal > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#3CBEDB]/5 border border-[#3CBEDB]/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-[#6B7280]">AccesaX financia</p>
                    <p className="text-lg font-bold text-[#1A1A1A] mt-0.5">{formatMXN(montoFinanciado)}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-[#6B7280]">Tu aportación</p>
                    <p className="text-lg font-bold text-[#1A1A1A] mt-0.5">{formatMXN(aportacionCliente)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paso 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A]">Pagador final</h2>
                <p className="text-sm text-[#6B7280] mt-0.5">La empresa que pagará el proyecto y respalda el financiamiento</p>
              </div>
              <Field label="Empresa pagadora" error={errors.client_name}>
                <input className={inputCls} placeholder="Ej. IMSS — Instituto Mexicano del Seguro Social"
                  value={form.client_name}
                  onChange={e => { set('client_name', e.target.value); clearErr('client_name') }} />
              </Field>
              <Field label="RFC del pagador" error={errors.client_rfc}>
                <input className={inputCls + ' uppercase font-mono'} placeholder="IME551019XU3" maxLength={13}
                  value={form.client_rfc}
                  onChange={e => { set('client_rfc', e.target.value.toUpperCase()); clearErr('client_rfc') }} />
              </Field>
              <Field label="Nombre del contacto en la empresa pagadora" error={errors.pagador_contacto_nombre}>
                <input className={inputCls} placeholder="Ej. Lic. Juan Pérez González"
                  value={form.pagador_contacto_nombre}
                  onChange={e => { set('pagador_contacto_nombre', e.target.value); clearErr('pagador_contacto_nombre') }} />
              </Field>
              <Field label="Correo corporativo del contacto" error={errors.pagador_contacto_correo}
                hint="Debe ser correo institucional — no gmail, hotmail u otro proveedor público">
                <input className={inputCls} type="email" placeholder="jperez@imss.gob.mx"
                  value={form.pagador_contacto_correo}
                  onChange={e => { set('pagador_contacto_correo', e.target.value); clearErr('pagador_contacto_correo') }} />
              </Field>
            </div>
          )}

          {/* Paso 3 */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A]">Proveedor a pagar</h2>
                <p className="text-sm text-[#6B7280] mt-0.5">El desembolso irá directo a la CLABE de este proveedor</p>
              </div>
              <Field label="Empresa del proveedor" error={errors.proveedor_nombre}>
                <input className={inputCls} placeholder="Ej. Distribuidora Médica SA de CV"
                  value={form.proveedor_nombre}
                  onChange={e => { set('proveedor_nombre', e.target.value); clearErr('proveedor_nombre') }} />
              </Field>
              <Field label="RFC del proveedor" error={errors.proveedor_rfc}>
                <input className={inputCls + ' uppercase font-mono'} placeholder="DMA890312AB3" maxLength={13}
                  value={form.proveedor_rfc}
                  onChange={e => { set('proveedor_rfc', e.target.value.toUpperCase()); clearErr('proveedor_rfc') }} />
              </Field>
              <Field label="CLABE interbancaria (18 dígitos)" error={errors.proveedor_clabe}
                hint="Verificaremos esta cuenta antes del desembolso">
                <input className={inputCls + ' font-mono tracking-widest'} placeholder="123456789012345678"
                  maxLength={18} inputMode="numeric"
                  value={form.proveedor_clabe}
                  onChange={e => { set('proveedor_clabe', e.target.value.replace(/\D/g, '')); clearErr('proveedor_clabe') }} />
                {form.proveedor_clabe.length === 18 && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" /> 18 dígitos ✓
                  </p>
                )}
              </Field>
              <Field label="Monto a desembolsar al proveedor" error={errors.proveedor_monto}
                hint={montoFinanciado > 0 ? `Monto financiado disponible: ${formatMXN(montoFinanciado)}` : ''}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">$</span>
                  <input className={inputCls + ' pl-7'} placeholder="800,000"
                    value={form.proveedor_monto}
                    onChange={e => { set('proveedor_monto', e.target.value); clearErr('proveedor_monto') }} />
                </div>
              </Field>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  AccesaX verificará que la CLABE y RFC del proveedor correspondan a una empresa real antes del desembolso.
                </p>
              </div>
            </div>
          )}

          {/* Paso 4 */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A]">Documentos</h2>
                <p className="text-sm text-[#6B7280] mt-0.5">Sube los documentos que respaldan el proyecto</p>
              </div>
              {([
                { tipo: 'orden_compra', label: 'Orden de compra', desc: 'Debe incluir monto, descripción y datos del pagador', req: true },
                { tipo: 'correo_pagador', label: 'Correo de confirmación del pagador', desc: 'Verificación de que el correo pertenece al dominio corporativo del pagador', req: true },
                { tipo: 'contrato', label: 'Contrato del proyecto', desc: 'Si existe, sube como respaldo adicional', req: false },
                { tipo: 'factura_aceptada', label: 'Factura aceptada en portal del pagador', desc: 'Opcional — acelera la aprobación si está disponible', req: false },
              ] as const).map((doc) => {
                const uploaded = uploadedDocs.has(doc.tipo)
                const uploading = uploadingDoc === doc.tipo
                return (
                  <div key={doc.tipo} className={`rounded-xl border px-4 py-4 transition-colors ${uploaded ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A1A]">
                          {doc.label}
                          {doc.req && <span className="ml-1 text-red-500">*</span>}
                          {!doc.req && <span className="ml-1 text-xs text-[#6B7280] font-normal">(opcional)</span>}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-0.5">{doc.desc}</p>
                        {docs[doc.tipo] && <p className="text-xs text-[#6B7280] mt-1 truncate">{docs[doc.tipo]?.name}</p>}
                      </div>
                      {uploaded ? (
                        <div className="flex items-center gap-1 text-emerald-700 text-xs font-medium shrink-0">
                          <CheckCircle2 className="h-4 w-4" /> Subido
                        </div>
                      ) : (
                        <label className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer border shrink-0 transition-colors ${uploading ? 'opacity-50 pointer-events-none border-slate-200 text-slate-400' : 'border-[#3CBEDB] text-[#3CBEDB] hover:bg-[#3CBEDB]/5'}`}>
                          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          {uploading ? 'Subiendo...' : 'Subir'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadDoc(doc.tipo, f) }} />
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-[#6B7280]">* Obligatorios para enviar la solicitud. Máx. 20 MB por archivo (PDF, JPG, PNG).</p>

              {/* Indicador de análisis */}
              {(analyzingOrden || ordenAnalysis) && (
                <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm ${analyzingOrden ? 'bg-blue-50 border border-blue-100 text-blue-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                  {analyzingOrden
                    ? <><Loader2 className="h-4 w-4 animate-spin shrink-0" /> Claude está analizando tu orden de compra…</>
                    : <><Sparkles className="h-4 w-4 shrink-0" /> Análisis completado — revisa el resumen en el paso siguiente</>
                  }
                </div>
              )}
            </div>
          )}

          {/* Paso 5 */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A]">Resumen de tu solicitud</h2>
                <p className="text-sm text-[#6B7280] mt-0.5">Revisa todo antes de enviar</p>
              </div>

              <div className="space-y-0 divide-y divide-slate-100">
                {[
                  { label: 'Proyecto', value: form.project_name },
                  { label: 'Monto total del contrato', value: formatMXN(montoTotal) },
                  { label: `AccesaX financia (${form.porcentaje_anticipo}%)`, value: formatMXN(montoFinanciado) },
                  { label: 'Tu aportación', value: formatMXN(aportacionCliente) },
                  { label: 'Pagador final', value: `${form.client_name} · ${form.client_rfc.toUpperCase()}` },
                  { label: 'Contacto pagador', value: form.pagador_contacto_correo },
                  { label: 'Proveedor a pagar', value: `${form.proveedor_nombre} · ${form.proveedor_rfc.toUpperCase()}` },
                  { label: 'CLABE', value: form.proveedor_clabe },
                  { label: 'Monto al proveedor', value: formatMXN(parseFloat(form.proveedor_monto.replace(/,/g, '')) || 0) },
                  { label: 'Documentos subidos', value: `${uploadedDocs.size} archivo${uploadedDocs.size !== 1 ? 's' : ''}` },
                ].map(r => (
                  <div key={r.label} className="flex items-start justify-between gap-4 py-2.5">
                    <span className="text-xs text-[#6B7280] shrink-0">{r.label}</span>
                    <span className="text-xs font-medium text-[#1A1A1A] text-right break-all">{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Análisis de la orden de compra */}
              {ordenAnalysis && (
                <div className="bg-white border border-[#3CBEDB]/30 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-[#3CBEDB]/5 border-b border-[#3CBEDB]/20">
                    <Sparkles className="h-4 w-4 text-[#3CBEDB]" />
                    <p className="text-xs font-semibold text-[#1A1A1A]">Análisis de tu orden de compra</p>
                    <span className="ml-auto text-[10px] text-[#6B7280]">Generado por Claude AI</span>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Resumen */}
                    <p className="text-xs text-[#6B7280] leading-relaxed">{ordenAnalysis.resumen}</p>

                    {/* Métricas clave */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] text-[#6B7280]">Monto detectado</p>
                        <p className={`text-sm font-bold mt-0.5 ${ordenAnalysis.monto_total > 0 && Math.abs(ordenAnalysis.monto_total - montoTotal) / montoTotal > 0.1 ? 'text-amber-600' : 'text-[#1A1A1A]'}`}>
                          {ordenAnalysis.monto_total > 0 ? formatMXN(ordenAnalysis.monto_total) : '—'}
                        </p>
                        {ordenAnalysis.monto_total > 0 && Math.abs(ordenAnalysis.monto_total - montoTotal) / montoTotal > 0.1 && (
                          <p className="text-[10px] text-amber-600 mt-0.5">Difiere del monto ingresado</p>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] text-[#6B7280]">Cliente detectado</p>
                        <p className="text-sm font-bold text-[#1A1A1A] mt-0.5 truncate">{ordenAnalysis.cliente_nombre || '—'}</p>
                        {ordenAnalysis.cliente_rfc && (
                          <p className="text-[10px] text-[#6B7280] font-mono mt-0.5">{ordenAnalysis.cliente_rfc}</p>
                        )}
                      </div>
                    </div>

                    {/* Viabilidad */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-[#1A1A1A]" />
                          <p className="text-xs font-semibold text-[#1A1A1A]">Score de viabilidad</p>
                        </div>
                        <span className="text-lg font-bold text-[#1A1A1A]">{ordenAnalysis.viabilidad_score}<span className="text-xs text-[#6B7280] font-normal">/100</span></span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${ordenAnalysis.viabilidad_score >= 70 ? 'bg-[#3CBEDB]' : ordenAnalysis.viabilidad_score >= 40 ? 'bg-amber-400' : 'bg-red-500'}`}
                          style={{ width: `${ordenAnalysis.viabilidad_score}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">{ordenAnalysis.viabilidad_razon}</p>
                    </div>

                    {/* Riesgos */}
                    {ordenAnalysis.riesgos?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Riesgos identificados</p>
                        <div className="space-y-1.5">
                          {ordenAnalysis.riesgos.map((r, i) => (
                            <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2">
                              <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${r.nivel === 'alto' ? 'text-red-500' : r.nivel === 'medio' ? 'text-amber-500' : 'text-emerald-500'}`} />
                              <p className="text-xs text-[#1A1A1A] flex-1">{r.descripcion}</p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${r.nivel === 'alto' ? 'bg-red-50 text-red-700 border-red-200' : r.nivel === 'medio' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                {r.nivel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {analyzingOrden && !ordenAnalysis && (
                <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Claude está analizando la orden de compra…
                </div>
              )}

              {analisis && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-[#1A1A1A] mb-3">Tu perfil financiero</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-[#6B7280]">DSO</p>
                      <p className="text-base font-bold text-[#1A1A1A]">{analisis.dso}d</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6B7280]">DPO</p>
                      <p className="text-base font-bold text-[#1A1A1A]">{analisis.dpo}d</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6B7280]">Cap. trabajo</p>
                      <p className={`text-base font-bold ${analisis.capitalTrabajo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {analisis.capitalTrabajo >= 0 ? '+' : ''}{(analisis.capitalTrabajo / 1000).toFixed(0)}K
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-[#3CBEDB]/5 border border-[#3CBEDB]/20 rounded-xl p-4">
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Al enviar esta solicitud confirmas que la información es verídica y autorizas a AccesaX a verificar
                  los documentos y datos del proyecto. El desembolso se realizará directamente al proveedor indicado
                  una vez aprobada la solicitud.
                </p>
              </div>

              {globalError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <X className="h-4 w-4 shrink-0" />
                  {globalError}
                </div>
              )}
            </div>
          )}

          {/* Navegación */}
          <div className={`flex mt-8 gap-3 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-sm font-medium text-[#6B7280] border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                Atrás
              </button>
            )}
            {step < 5 ? (
              <button onClick={handleNext} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#3CBEDB] text-white text-sm font-medium rounded-lg hover:bg-[#3CBEDB]/90 disabled:opacity-50 transition-colors">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Guardando...' : 'Continuar'}
                {!saving && <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#3CBEDB] text-white text-sm font-medium rounded-lg hover:bg-[#3CBEDB]/90 disabled:opacity-50 transition-colors">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
