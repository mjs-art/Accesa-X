'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

const INDUSTRIAS = [
  'Manufactura',
  'Servicios',
  'Comercio',
  'Construcción',
  'Tecnología',
  'Otro',
]

const TAMANOS = [
  { value: '1-10', label: '1 – 10 empleados' },
  { value: '11-50', label: '11 – 50 empleados' },
  { value: '51-200', label: '51 – 200 empleados' },
  { value: '200+', label: 'Más de 200 empleados' },
]

// RFC mexicano: 3-4 letras + 6 dígitos (fecha) + 3 alfanuméricos (homoclave)
// Personas morales: 12 chars | Personas físicas: 13 chars
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i

function getRfcStatus(rfc: string): 'empty' | 'valid' | 'invalid' {
  if (!rfc) return 'empty'
  return RFC_REGEX.test(rfc) ? 'valid' : 'invalid'
}

export default function EmpresaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    nombre_razon_social: '',
    rfc: '',
    industria: '',
    tamano_empresa: '',
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

    if (rfcStatus !== 'valid') {
      setError('El RFC no tiene un formato válido (12-13 caracteres)')
      return
    }

    setLoading(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push('/')
      return
    }

    const { error: insertError } = await supabase.from('companies').insert({
      user_id: user.id,
      nombre_razon_social: form.nombre_razon_social.trim(),
      rfc: form.rfc.toUpperCase().trim(),
      industria: form.industria,
      tamano_empresa: form.tamano_empresa,
    })

    if (insertError) {
      // RFC duplicado para este usuario
      if (insertError.code === '23505') {
        setError('Ya existe una empresa registrada con ese RFC en tu cuenta.')
      } else {
        setError('Error al guardar. Intenta de nuevo.')
      }
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
          <span className="text-sm font-medium text-[#0F2D5E]">Paso 1 de 3</span>
          <span className="text-sm text-[#64748B]">Información de la empresa</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#00C896] transition-all"
            style={{ width: '33%' }}
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
              value={form.nombre_razon_social}
              onChange={(e) => handleChange('nombre_razon_social', e.target.value)}
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
              value={form.tamano_empresa}
              onValueChange={(v) => handleChange('tamano_empresa', v)}
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
            disabled={loading || !form.nombre_razon_social || !form.industria || !form.tamano_empresa}
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
