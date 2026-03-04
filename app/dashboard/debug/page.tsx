'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

interface ResetResult {
  success: boolean
  syntage?: string[]
  error?: string
}

export default function DebugPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResetResult | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  async function handleReset() {
    setLoading(true)
    setResult(null)

    const { data, error } = await supabase.functions.invoke('debug-reset-syntage')

    if (error) {
      setResult({ success: false, error: error.message })
    } else {
      setResult(data)
    }
    setLoading(false)
    setConfirmed(false)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-bold text-[#0F2D5E]">
            Accesa<span className="text-[#00C896]">X</span>
          </span>
          <span className="text-xs font-mono bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
            DEBUG
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Herramientas de desarrollo</h1>
          <p className="text-sm text-[#64748B] mt-1">Solo visible en modo debug. No usar en producción.</p>
        </div>

        {/* Reset Syntage */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-50 rounded-lg shrink-0">
              <Trash2 className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">Reset Syntage</h2>
              <p className="text-sm text-[#64748B] mt-0.5">
                Elimina las credenciales de tu RFC en Syntage y deja tu cuenta en Supabase
                como <span className="font-medium text-[#0F172A]">no verificada</span>.
                Tu empresa, contratos y solicitudes se conservan.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              Esta acción borrará tus credenciales e historial de extracciones en Syntage.
              Tendrás que volver a verificar tu empresa con tu CIEC.
            </p>
          </div>

          {!confirmed ? (
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 w-full"
              onClick={() => setConfirmed(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Resetear datos de Syntage
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleReset}
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {loading ? 'Reseteando...' : 'Confirmar reset'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmed(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          )}

          {result && (
            <div className={`rounded-xl border px-4 py-3 text-sm space-y-2 ${
              result.success
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 font-medium">
                {result.success
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  : <AlertTriangle className="h-4 w-4 text-red-500" />
                }
                {result.success ? 'Reset completado' : `Error: ${result.error}`}
              </div>
              {result.syntage && result.syntage.length > 0 && (
                <ul className="font-mono text-xs text-slate-600 space-y-0.5 pl-6">
                  {result.syntage.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              )}
              {result.success && (
                <Button
                  size="sm"
                  className="mt-2 bg-[#0F2D5E] hover:bg-[#0F2D5E]/90 text-white"
                  onClick={() => router.push('/dashboard')}
                >
                  Ir al dashboard
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
