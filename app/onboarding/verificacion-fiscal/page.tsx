'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2, Lock } from 'lucide-react'

type Estado = 'idle' | 'loading' | 'success' | 'error'

interface CompanyData {
  id: string
  rfc: string
  nombre_razon_social: string
}

export default function VerificacionFiscalPage() {
  const router = useRouter()
  const supabase = createClient()

  const [company, setCompany] = useState<CompanyData | null>(null)
  const [ciec, setCiec] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [razonSocial, setRazonSocial] = useState<string | null>(null)
  const [loadingCompany, setLoadingCompany] = useState(true)

  // Cargar la empresa del usuario al montar
  useEffect(() => {
    async function fetchCompany() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data, error } = await supabase
        .from('companies')
        .select('id, rfc, nombre_razon_social')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        router.push('/onboarding/empresa')
        return
      }
      setCompany(data)
      setLoadingCompany(false)
    }
    fetchCompany()
  }, [])

  async function handleConectar(e: React.FormEvent) {
    e.preventDefault()
    if (!company) return

    setEstado('loading')
    setErrorMsg(null)

    const { data, error } = await supabase.functions.invoke('syntage-connect', {
      body: { rfc: company.rfc, ciec, company_id: company.id },
    })

    if (error) {
      setEstado('error')
      setErrorMsg('No se pudo conectar con el SAT. Intenta de nuevo.')
      return
    }

    if (data?.success && data?.status === 'valid') {
      setRazonSocial(data.razon_social ?? company.nombre_razon_social)
      setEstado('success')
    } else if (data?.status === 'invalid') {
      setEstado('error')
      setErrorMsg('CIEC incorrecta. Verifica tu contraseña del portal sat.gob.mx e intenta de nuevo.')
    } else {
      setEstado('error')
      setErrorMsg('No fue posible verificar tu RFC en este momento. Intenta de nuevo en unos minutos.')
    }
  }

  function handleReintentar() {
    setCiec('')
    setErrorMsg(null)
    setEstado('idle')
  }

  if (loadingCompany) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#0F2D5E]" />
      </div>
    )
  }

  return (
    <>
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#0F2D5E]">Paso 2 de 3</span>
          <span className="text-sm text-[#64748B]">Verificación fiscal</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#00C896] transition-all"
            style={{ width: '66%' }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#0F172A]">
            Conecta tu empresa con el SAT
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Verificamos tu situación fiscal en tiempo real para ofrecerte las mejores condiciones de crédito.
          </p>
        </div>

        {/* Estado: idle o loading → mostrar formulario */}
        {(estado === 'idle' || estado === 'loading') && (
          <form onSubmit={handleConectar} className="space-y-5">
            {/* RFC pre-llenado (no editable) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#0F172A]">RFC</Label>
              <Input
                value={company?.rfc ?? ''}
                disabled
                className="h-11 font-mono tracking-wider bg-slate-50 text-[#64748B]"
              />
            </div>

            {/* CIEC */}
            <div className="space-y-1.5">
              <Label htmlFor="ciec" className="text-sm font-medium text-[#0F172A]">
                CIEC — Contraseña SAT
              </Label>
              <Input
                id="ciec"
                type="password"
                placeholder="Tu contraseña del portal sat.gob.mx"
                value={ciec}
                onChange={(e) => setCiec(e.target.value)}
                required
                disabled={estado === 'loading'}
                className="h-11"
                autoComplete="current-password"
              />
            </div>

            {/* Aviso de seguridad */}
            <div className="flex gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <Lock className="h-4 w-4 text-[#64748B] mt-0.5 shrink-0" />
              <p className="text-xs text-[#64748B] leading-relaxed">
                Tus credenciales se transmiten de forma segura y{' '}
                <span className="font-medium text-[#0F172A]">
                  no se almacenan en nuestros servidores
                </span>
                . Solo se utiliza la conexión temporal con el SAT.
              </p>
            </div>

            {/* Estado loading */}
            {estado === 'loading' && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                <p className="text-sm text-blue-700">
                  Conectando con el SAT… puede tomar hasta 30 segundos
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-[#0F2D5E] hover:bg-[#0F2D5E]/90 text-white font-medium"
              disabled={estado === 'loading' || !ciec}
            >
              {estado === 'loading' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Conectar con el SAT
            </Button>
          </form>
        )}

        {/* Estado: success */}
        {estado === 'success' && (
          <div className="space-y-5">
            <div className="flex gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
              <CheckCircle2 className="h-5 w-5 text-[#00C896] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Verificación exitosa
                </p>
                {razonSocial && (
                  <p className="text-sm text-emerald-700 mt-0.5">
                    {razonSocial}
                  </p>
                )}
                <p className="text-xs text-emerald-600 mt-1">
                  Tu situación fiscal fue validada correctamente ante el SAT.
                </p>
              </div>
            </div>

            <Button
              onClick={() => router.push('/onboarding/contratos')}
              className="w-full h-11 bg-[#00C896] hover:bg-[#00C896]/90 text-white font-medium"
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Estado: error */}
        {estado === 'error' && (
          <div className="space-y-5">
            <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  No se pudo verificar
                </p>
                <p className="text-sm text-red-600 mt-0.5">
                  {errorMsg}
                </p>
              </div>
            </div>

            <Button
              onClick={handleReintentar}
              variant="outline"
              className="w-full h-11 border-[#0F2D5E] text-[#0F2D5E] hover:bg-[#0F2D5E]/5 font-medium"
            >
              Reintentar
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
