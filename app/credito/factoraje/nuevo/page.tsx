'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getCfdisDisponiblesAction,
  createFactorajeAction,
  submitFactorajeAction,
} from '@/app/actions/factoraje'
import type { CfdiDisponible } from '@/app/actions/factoraje'
import {
  CheckCircle2, ChevronRight, Loader2, Check, AlertTriangle,
  FileText, Search, ArrowUpDown,
} from 'lucide-react'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}
function shortUUID(uuid: string) {
  return uuid.slice(0, 8).toUpperCase()
}

const STEPS = [
  { num: 1, label: 'Seleccionar facturas' },
  { num: 2, label: 'Condiciones' },
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
            <div className={`h-0.5 w-24 mb-5 mx-1 ${s.num < current ? 'bg-[#3CBEDB]' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function NuevoFactorajePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Step 1
  const [cfdis, setCfdis] = useState<CfdiDisponible[]>([])
  const [loadingCfdis, setLoadingCfdis] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [sortAsc, setSortAsc] = useState(false)

  // Step 2
  const [aforo, setAforo] = useState(85)
  const [notificarDeudor, setNotificarDeudor] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Done
  const [applicationId, setApplicationId] = useState('')
  const [autoAprobado, setAutoAprobado] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    getCfdisDisponiblesAction().then(res => {
      if (!('error' in res)) setCfdis(res)
      setLoadingCfdis(false)
    })
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = cfdis
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        c.receiver_name?.toLowerCase().includes(q) ||
        c.receiver_rfc.toLowerCase().includes(q) ||
        c.cfdi_uuid.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => sortAsc ? a.due_amount - b.due_amount : b.due_amount - a.due_amount)

  const selectedCfdis = cfdis.filter(c => selected.has(c.id))
  const totalNominal = selectedCfdis.reduce((s, c) => s + c.due_amount, 0)
  const montoARecibir = Math.round(totalNominal * (aforo / 100))
  const retencion = totalNominal - montoARecibir

  const byDeudor = selectedCfdis.reduce<Record<string, { nombre: string; total: number; count: number }>>((acc, c) => {
    const key = c.receiver_rfc
    if (!acc[key]) acc[key] = { nombre: c.receiver_name ?? c.receiver_rfc, total: 0, count: 0 }
    acc[key].total += c.due_amount
    acc[key].count += 1
    return acc
  }, {})

  // ── Handlers ──────────────────────────────────────────────────────────────

  function toggleCfdi(id: string) {
    setSelected(prev => {
      const next = new Set(Array.from(prev))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(c => c.id)))
    }
  }

  async function handleSubmit() {
    setError('')
    setSubmitting(true)
    const createRes = await createFactorajeAction(Array.from(selected), aforo, notificarDeudor)
    if ('error' in createRes) { setError(createRes.error); setSubmitting(false); return }
    const submitRes = await submitFactorajeAction(createRes.id)
    if ('error' in submitRes) { setError(submitRes.error); setSubmitting(false); return }
    setApplicationId(createRes.id)
    setAutoAprobado(submitRes.auto_aprobado)
    setDone(true)
    setSubmitting(false)
  }

  // ── Confirmation screen ───────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-5 ${autoAprobado ? 'bg-emerald-100' : 'bg-[#3CBEDB]/10'}`}>
            <CheckCircle2 className={`h-8 w-8 ${autoAprobado ? 'text-emerald-600' : 'text-[#3CBEDB]'}`} />
          </div>
          <h1 className="text-xl font-bold text-[#1A1A1A] mb-2">
            {autoAprobado ? '¡Solicitud aprobada!' : 'Solicitud enviada'}
          </h1>
          <p className="text-sm text-[#6B7280] mb-6">
            {autoAprobado
              ? 'Tu solicitud fue aprobada automáticamente. Te contactaremos para coordinar la dispersión.'
              : 'Tu solicitud está en revisión. Nuestro equipo te notificará en 24–48 horas hábiles.'}
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-6">
            <div className="flex justify-between text-xs">
              <span className="text-[#6B7280]">Facturas descontadas</span>
              <span className="font-semibold text-[#1A1A1A]">{selectedCfdis.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#6B7280]">Total nominal</span>
              <span className="font-semibold text-[#1A1A1A]">{formatMXN(totalNominal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#6B7280]">Monto a recibir ({aforo}%)</span>
              <span className="font-bold text-emerald-600">{formatMXN(montoARecibir)}</span>
            </div>
          </div>
          <button onClick={() => router.push(`/dashboard/credito/${applicationId}`)}
            className="w-full py-2.5 bg-[#3CBEDB] text-white text-sm font-medium rounded-lg hover:bg-[#3CBEDB]/90 transition-colors">
            Ver detalle de la solicitud
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => router.push('/dashboard/credito')} className="text-xs text-[#6B7280] hover:text-[#1A1A1A]">
          ← Mis solicitudes
        </button>
        <span className="text-sm font-semibold text-[#1A1A1A]">Nueva solicitud — Factoraje</span>
        <div />
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex justify-center">
          <Stepper current={step} />
        </div>

        {/* ── STEP 1: Select CFDIs ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#1A1A1A]">Selecciona las facturas a descontar</h2>
              <p className="text-sm text-[#6B7280] mt-0.5">Facturas emitidas vigentes con saldo pendiente de cobro</p>
            </div>

            {selected.size > 0 && (
              <div className="bg-[#3CBEDB]/10 border border-[#3CBEDB]/30 rounded-xl px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-[#1A7A8A]">
                  {selected.size} factura{selected.size !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}
                </span>
                <span className="text-sm font-bold text-[#1A7A8A]">
                  Total: {formatMXN(totalNominal)}
                </span>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por deudor, RFC o UUID..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/30 focus:border-[#3CBEDB]"
                  />
                </div>
                <button onClick={() => setSortAsc(v => !v)}
                  className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#1A1A1A]">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Monto {sortAsc ? '↑' : '↓'}
                </button>
              </div>

              {loadingCfdis ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-[#3CBEDB]" />
                </div>
              ) : cfdis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <FileText className="h-10 w-10 text-slate-300 mb-4" />
                  <p className="text-sm font-medium text-[#1A1A1A]">Sin facturas disponibles</p>
                  <p className="text-xs text-[#6B7280] mt-1 max-w-xs">
                    Necesitas tener CFDIs de tipo Ingreso vigentes con saldo pendiente. Sincroniza tu información fiscal primero.
                  </p>
                  <button onClick={() => router.push('/dashboard/inteligencia')}
                    className="mt-4 text-xs text-[#3CBEDB] hover:underline">
                    Ir a Inteligencia de Negocio →
                  </button>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="w-10 px-4 py-2.5">
                        <input type="checkbox"
                          checked={filtered.length > 0 && selected.size === filtered.length}
                          onChange={toggleAll}
                          className="rounded border-slate-300 text-[#3CBEDB] focus:ring-[#3CBEDB]/30" />
                      </th>
                      <th className="text-xs text-[#6B7280] font-medium text-left py-2.5">Deudor</th>
                      <th className="text-xs text-[#6B7280] font-medium text-left py-2.5">UUID</th>
                      <th className="text-xs text-[#6B7280] font-medium text-right py-2.5">Monto total</th>
                      <th className="text-xs text-[#6B7280] font-medium text-right py-2.5 pr-4">Saldo pendiente</th>
                      <th className="text-xs text-[#6B7280] font-medium text-right py-2.5 pr-4">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map(c => (
                      <tr key={c.id}
                        onClick={() => toggleCfdi(c.id)}
                        className={`cursor-pointer transition-colors ${selected.has(c.id) ? 'bg-[#3CBEDB]/5' : 'hover:bg-slate-50/60'}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggleCfdi(c.id)}
                            onClick={e => e.stopPropagation()}
                            className="rounded border-slate-300 text-[#3CBEDB] focus:ring-[#3CBEDB]/30" />
                        </td>
                        <td className="py-3">
                          <p className="text-xs font-medium text-[#1A1A1A] max-w-[180px] truncate">
                            {c.receiver_name ?? c.receiver_rfc}
                          </p>
                          <p className="text-[10px] text-[#6B7280] font-mono">{c.receiver_rfc}</p>
                        </td>
                        <td className="py-3 font-mono text-xs text-[#6B7280]">{shortUUID(c.cfdi_uuid)}…</td>
                        <td className="py-3 text-right text-xs text-[#6B7280]">{formatMXN(c.total)}</td>
                        <td className="py-3 text-right pr-4">
                          <span className="text-xs font-semibold text-[#1A1A1A]">{formatMXN(c.due_amount)}</span>
                        </td>
                        <td className="py-3 text-right pr-4 text-xs text-[#6B7280]">{formatDate(c.issued_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => { setError(''); setStep(2) }}
                disabled={selected.size === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#3CBEDB] text-white text-sm font-medium rounded-lg hover:bg-[#3CBEDB]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Continuar
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Condiciones ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5 max-w-xl mx-auto">
            <div>
              <h2 className="text-xl font-bold text-[#1A1A1A]">Condiciones del factoraje</h2>
              <p className="text-sm text-[#6B7280] mt-0.5">Elige el aforo y acepta los términos</p>
            </div>

            {/* Resumen por deudor */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Resumen de facturas</p>
              <div className="space-y-2">
                {Object.entries(byDeudor).map(([rfc, d]) => (
                  <div key={rfc} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-[#1A1A1A]">{d.nombre}</p>
                      <p className="text-[10px] text-[#6B7280] font-mono">{rfc} · {d.count} factura{d.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#1A1A1A]">{formatMXN(d.total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between">
                <span className="text-xs text-[#6B7280]">Total nominal ({selectedCfdis.length} facturas)</span>
                <span className="text-sm font-bold text-[#1A1A1A]">{formatMXN(totalNominal)}</span>
              </div>
            </div>

            {/* Aforo */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Porcentaje de aforo</p>
              <div className="flex gap-3">
                {[80, 85, 90].map(pct => (
                  <button key={pct} onClick={() => setAforo(pct)}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-colors ${
                      aforo === pct
                        ? 'border-[#3CBEDB] bg-[#3CBEDB]/10 text-[#1A7A8A]'
                        : 'border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}>
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="space-y-2 pt-1 border-t border-slate-100">
                {[
                  { label: 'Monto nominal', value: formatMXN(totalNominal), highlight: false },
                  { label: `Monto a recibir (${aforo}%)`, value: formatMXN(montoARecibir), highlight: true },
                  { label: 'Retención AccesaX', value: formatMXN(retencion), highlight: false },
                ].map(r => (
                  <div key={r.label} className="flex justify-between pt-2">
                    <span className={`text-xs ${r.highlight ? 'font-semibold text-[#1A1A1A]' : 'text-[#6B7280]'}`}>{r.label}</span>
                    <span className={`text-xs font-bold ${r.highlight ? 'text-emerald-600' : 'text-[#1A1A1A]'}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notificación al deudor */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={notificarDeudor}
                  onChange={e => setNotificarDeudor(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#3CBEDB] focus:ring-[#3CBEDB]/30" />
                <div>
                  <p className="text-xs font-semibold text-[#1A1A1A]">Notificar al deudor</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    AccesaX enviará una notificación formal al deudor sobre la cesión del crédito.
                    Recomendado para mayor certeza jurídica.
                  </p>
                </div>
              </label>
            </div>

            {/* Términos */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#3CBEDB] focus:ring-[#3CBEDB]/30" />
                <div>
                  <p className="text-xs font-semibold text-[#1A1A1A]">Acepto las condiciones de factoraje</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Confirmo que las facturas seleccionadas son legítimas, están vigentes ante el SAT
                    y no han sido cedidas previamente a ningún otro intermediario financiero.
                  </p>
                </div>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#1A1A1A] transition-colors">
                ← Atrás
              </button>
              <button onClick={handleSubmit}
                disabled={!termsAccepted || submitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#3CBEDB] text-white text-sm font-medium rounded-lg hover:bg-[#3CBEDB]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
