'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  Loader2,
  MessageCircle,
  Send,
  TrendingUp,
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AnalysisResult {
  resumen: string
  monto_total: number
  moneda: string
  fecha_inicio: string | null
  fecha_fin: string | null
  fechas_pago: string[]
  entregables: string[]
  riesgos: { descripcion: string; nivel: 'alto' | 'medio' | 'bajo' }[]
  cliente_nombre: string
  viabilidad_score: number
  viabilidad_razon: string
}

interface Contract {
  id: string
  nombre_cliente: string
  storage_path: string
  analysis_result: AnalysisResult | null
}

const SUGGESTED_QUESTIONS = [
  '¿Cuáles son los principales riesgos?',
  '¿Cuándo son las fechas de pago?',
  '¿Cuáles son los entregables clave?',
  '¿Es viable este contrato?',
]

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

function getFileName(path: string) {
  return path.split('/').pop() ?? path
}

export default function ContratoPage() {
  const { id, contractId } = useParams<{ id: string; contractId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchContract() }, [contractId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchContract() {
    setLoading(true)
    const { data } = await supabase
      .from('contracts')
      .select('id, nombre_cliente, storage_path, analysis_result')
      .eq('id', contractId)
      .single()
    setContract(data as unknown as Contract ?? null)
    setLoading(false)
  }

  async function sendMessage(question: string) {
    if (!question.trim() || sending) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setSending(true)

    await supabase.auth.getUser()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sesión expirada. Por favor vuelve a iniciar sesión.' }])
      setSending(false)
      return
    }

    const { data, error } = await supabase.functions.invoke('ask-contract', {
      body: { contract_id: contractId, question },
      headers: { Authorization: `Bearer ${token}` },
    })

    if (error || !data?.success) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No pude procesar tu pregunta. Intenta de nuevo.' }])
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-[#6B7280]" />
      </div>
    )
  }

  if (!contract?.analysis_result) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="text-[#6B7280]">Análisis no disponible.</p>
        <Button variant="ghost" onClick={() => router.push(`/dashboard/clientes/${id}`)} className="mt-4">
          Volver
        </Button>
      </div>
    )
  }

  const r = contract.analysis_result
  const viabilidadColor = r.viabilidad_score >= 70 ? 'bg-[#3CBEDB]' : r.viabilidad_score >= 40 ? 'bg-amber-400' : 'bg-red-500'
  const isValidDate = (d: string | null) => d && d !== 'N/A' && d !== 'null'

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/clientes/${id}`)}
            className="text-[#6B7280] hover:text-[#1A1A1A] -ml-2"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-xl font-bold text-[#1A1A1A]">
            Accesa<span className="text-[#3CBEDB]">X</span>
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Título */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-[#6B7280]" />
            <span className="text-sm text-[#6B7280]">{getFileName(contract.storage_path)}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{r.cliente_nombre || contract.nombre_cliente}</h1>
        </div>

        {/* Análisis */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#1A1A1A]">Análisis del contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            <section>
              <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Resumen</h3>
              <p className="text-sm text-[#1A1A1A] leading-relaxed bg-slate-50 rounded-lg p-3">{r.resumen}</p>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 flex gap-2.5">
                <DollarSign className="h-4 w-4 text-[#3CBEDB] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-[#6B7280]">Monto total</p>
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    {r.monto_total ? formatMXN(r.monto_total, r.moneda) : '—'}
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 flex gap-2.5">
                <FileText className="h-4 w-4 text-[#3CBEDB] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-[#6B7280]">Cliente</p>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{r.cliente_nombre || '—'}</p>
                </div>
              </div>
              {isValidDate(r.fecha_inicio) && (
                <div className="bg-slate-50 rounded-lg p-3 flex gap-2.5">
                  <Calendar className="h-4 w-4 text-[#3CBEDB] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-[#6B7280]">Inicio</p>
                    <p className="text-sm font-semibold text-[#1A1A1A]">{r.fecha_inicio}</p>
                  </div>
                </div>
              )}
              {isValidDate(r.fecha_fin) && (
                <div className="bg-slate-50 rounded-lg p-3 flex gap-2.5">
                  <Calendar className="h-4 w-4 text-[#3CBEDB] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-[#6B7280]">Vencimiento</p>
                    <p className="text-sm font-semibold text-[#1A1A1A]">{r.fecha_fin}</p>
                  </div>
                </div>
              )}
            </section>

            {r.fechas_pago?.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Fechas de pago</h3>
                <div className="flex flex-wrap gap-2">
                  {r.fechas_pago.map((f, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1">
                      {f}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {r.entregables?.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Entregables</h3>
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
                <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Riesgos identificados</h3>
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
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">Score de viabilidad</h3>
                </div>
                <span className="text-2xl font-bold text-[#1A1A1A]">
                  {r.viabilidad_score}
                  <span className="text-sm text-[#6B7280] font-normal">/100</span>
                </span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${viabilidadColor}`}
                  style={{ width: `${r.viabilidad_score}%` }}
                />
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{r.viabilidad_razon}</p>
            </section>

          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#3CBEDB]" />
              Preguntar sobre el contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Preguntas sugeridas (solo si no hay mensajes) */}
            {messages.length === 0 && (
              <div>
                <p className="text-xs text-[#6B7280] mb-2">Preguntas sugeridas:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={sending}
                      className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 text-[#1A1A1A] transition-colors disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mensajes */}
            {messages.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#3CBEDB] text-white rounded-br-sm'
                          : 'bg-slate-100 text-[#1A1A1A] rounded-bl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-[#6B7280]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu pregunta sobre el contrato..."
                disabled={sending}
                className="flex-1 h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#3CBEDB]/20 focus:border-[#3CBEDB] disabled:opacity-50 disabled:bg-slate-50"
              />
              <Button
                type="submit"
                disabled={!input.trim() || sending}
                className="h-10 w-10 p-0 bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>

          </CardContent>
        </Card>

      </main>
    </div>
  )
}
