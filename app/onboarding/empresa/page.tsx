'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveEmpresaAction } from '@/app/actions/onboarding'
import { companySchema, INDUSTRIAS, TAMANOS } from '@/features/onboarding/schemas/company.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

function getRfcStatus(rfc: string): 'empty' | 'valid' | 'invalid' {
  if (!rfc) return 'empty'
  return companySchema.shape.rfc.safeParse(rfc).success ? 'valid' : 'invalid'
}

export default function EmpresaPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    nombreRazonSocial: '',
    rfc: '',
    industria: '',
    tamanoEmpresa: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rfcStatus = getRfcStatus(form.rfc)

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await saveEmpresaAction(form)

    if (result.error) {
      setError(typeof result.error === 'string' ? result.error : 'Error de validación')
      setLoading(false)
      return
    }

    router.push('/onboarding/verificacion-fiscal')
  }

  return (
    <>
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#0F2D5E]">Paso 1 de 7</span>
          <span className="text-sm text-[#64748B]">Información de la empresa</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#00C896] transition-all"
            style={{ width: '14%' }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#0F172A]">
            Cuéntanos sobre tu empresa
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Necesitamos estos datos para personalizar tu experiencia de crédito.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Nombre o razón social */}
          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="text-sm font-medium text-[#0F172A]">
              Nombre o razón social
            </Label>
            <Input
              id="nombre"
              placeholder="Ej. Distribuidora González S.A. de C.V."
              value={form.nombreRazonSocial}
              onChange={(e) => handleChange('nombreRazonSocial', e.target.value)}
              required
              disabled={loading}
              className="h-11"
            />
          </div>

          {/* RFC con validación en tiempo real */}
          <div className="space-y-1.5">
            <Label htmlFor="rfc" className="text-sm font-medium text-[#0F172A]">
              RFC
            </Label>
            <div className="relative">
              <Input
                id="rfc"
                placeholder="Ej. GODE850101AB3"
                value={form.rfc}
                onChange={(e) => handleChange('rfc', e.target.value.toUpperCase())}
                required
                disabled={loading}
                maxLength={13}
                className={`h-11 pr-10 font-mono tracking-wider ${
                  rfcStatus === 'valid'
                    ? 'border-[#00C896] focus-visible:ring-[#00C896]/30'
                    : rfcStatus === 'invalid'
                    ? 'border-red-400 focus-visible:ring-red-200'
                    : ''
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {rfcStatus === 'valid' && (
                  <CheckCircle2 className="h-4 w-4 text-[#00C896]" />
                )}
                {rfcStatus === 'invalid' && (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </div>
            </div>
            <p className="text-xs text-[#64748B]">
              {rfcStatus === 'invalid'
                ? 'Formato inválido — debe tener 12 o 13 caracteres'
                : '12 caracteres (persona moral) o 13 (persona física)'}
            </p>
          </div>

          {/* Industria */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0F172A]">Industria</Label>
            <Select
              value={form.industria}
              onValueChange={(v) => handleChange('industria', v)}
              disabled={loading}
              required
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecciona una industria" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIAS.map((ind) => (
                  <SelectItem key={ind} value={ind}>
                    {ind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tamaño */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0F172A]">
              Tamaño de empresa
            </Label>
            <Select
              value={form.tamanoEmpresa}
              onValueChange={(v) => handleChange('tamanoEmpresa', v)}
              disabled={loading}
              required
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Número de empleados" />
              </SelectTrigger>
              <SelectContent>
                {TAMANOS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-11 bg-[#0F2D5E] hover:bg-[#0F2D5E]/90 text-white font-medium mt-2"
            disabled={loading || !form.nombreRazonSocial || !form.industria || !form.tamanoEmpresa}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Continuar'
            )}
          </Button>
        </form>
      </div>
    </>
  )
}
