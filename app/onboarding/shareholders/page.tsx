'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getOnboardingStateAction, saveShareholdersAction, advanceToStepAction, getShareholdersAction } from '@/app/actions/onboarding'
import { sendInvitationAction } from '@/app/actions/send-invitation'
import type { ShareholderFormData } from '@/features/onboarding/schemas/shareholder.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2 } from 'lucide-react'

const EMPTY_SHAREHOLDER: ShareholderFormData = {
  esPersonaMoral: false,
  poseeMas25Porciento: false,
  porcentajeParticipacion: undefined,
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  curp: '',
  fechaNacimiento: '',
  ocupacion: '',
  telefono: '',
  email: '',
}

export default function ShareholdersPage() {
  return <Suspense><ShareholdersPageInner /></Suspense>
}

function ShareholdersPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPerfil = searchParams.get('from') === 'perfil'

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [shareholders, setShareholders] = useState<ShareholderFormData[]>([{ ...EMPTY_SHAREHOLDER }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getOnboardingStateAction().then(async (result) => {
      if (result.error || !result.company) {
        router.push('/onboarding/empresa')
        return
      }
      const id = result.company.id
      setCompanyId(id)

      // Pre-load existing shareholders so the form shows current state and
      // validation accounts for all already-saved records.
      const existing = await getShareholdersAction(id)
      if (existing.success && existing.shareholders && existing.shareholders.length > 0) {
        setShareholders(existing.shareholders.map((s) => ({
          esPersonaMoral: s.esPersonaMoral,
          poseeMas25Porciento: s.poseeMas25Porciento,
          porcentajeParticipacion: s.porcentajeParticipacion ?? undefined,
          nombres: s.nombres ?? '',
          apellidoPaterno: s.apellidoPaterno ?? '',
          apellidoMaterno: s.apellidoMaterno ?? '',
          curp: s.curp ?? '',
          fechaNacimiento: s.fechaNacimiento ?? '',
          ocupacion: s.ocupacion ?? '',
          // Strip +52 prefix stored in DB before showing in form
          telefono: s.telefono ? s.telefono.replace(/^\+52/, '') : '',
          email: '',
        })))
      }

      setLoadingInit(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateShareholder(index: number, field: keyof ShareholderFormData, value: unknown) {
    setShareholders((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setError(null)
  }

  function addShareholder() {
    setShareholders((prev) => [...prev, { ...EMPTY_SHAREHOLDER }])
  }

  function removeShareholder(index: number) {
    setShareholders((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId) return

    // Validar datos requeridos por accionista
    for (let i = 0; i < shareholders.length; i++) {
      const s = shareholders[i]
      if (!s.porcentajeParticipacion) {
        setError(`El accionista ${i + 1} debe tener un porcentaje de participación.`)
        return
      }
      if (s.poseeMas25Porciento && !s.esPersonaMoral) {
        if (!s.nombres?.trim()) {
          setError(`El nombre del accionista ${i + 1} es requerido.`)
          return
        }
        if (!s.apellidoPaterno?.trim()) {
          setError(`El apellido paterno del accionista ${i + 1} es requerido.`)
          return
        }
      }
    }

    const totalPorcentaje = shareholders.reduce((sum, s) => sum + (s.porcentajeParticipacion ?? 0), 0)
    if (totalPorcentaje > 100) {
      setError(`La suma de participaciones es ${totalPorcentaje.toFixed(2)}%. No puede superar el 100%.`)
      return
    }

    setLoading(true)
    setError(null)

    const result = await saveShareholdersAction(companyId, shareholders)

    if (result.error) {
      setError(typeof result.error === 'string' ? result.error : 'Error al guardar accionistas')
      setLoading(false)
      return
    }

    // Invitar a accionistas mayoritarios con email (fire-and-forget)
    shareholders.forEach((s) => {
      if (s.email && s.poseeMas25Porciento && !s.esPersonaMoral) {
        const nombre = [s.nombres, s.apellidoPaterno].filter(Boolean).join(' ') || undefined
        sendInvitationAction(companyId!, s.email, 'shareholder', nombre)
          .catch(() => {})
      }
    })

    router.push(fromPerfil ? '/dashboard/perfil' : '/onboarding/company-docs')
  }

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#0F2D5E]" />
      </div>
    )
  }

  return (
    <>
      {!fromPerfil && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#0F2D5E]">Paso 5 de 7</span>
            <span className="text-sm text-[#64748B]">Accionistas</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#00C896] transition-all" style={{ width: '71%' }} />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {shareholders.map((s, index) => (
          <div key={index} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[#0F172A]">
                Accionista {index + 1}
              </h2>
              {shareholders.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeShareholder(index)}
                  className="text-[#64748B] hover:text-red-500 transition-colors"
                  aria-label="Eliminar accionista"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Checkboxes */}
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-sm text-[#0F172A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.esPersonaMoral}
                    onChange={(e) => updateShareholder(index, 'esPersonaMoral', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0F2D5E]"
                  />
                  Persona moral
                </label>
                <label className="flex items-center gap-2 text-sm text-[#0F172A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.poseeMas25Porciento}
                    onChange={(e) => updateShareholder(index, 'poseeMas25Porciento', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0F2D5E]"
                  />
                  Posee más del 25%
                </label>
              </div>

              {/* Porcentaje */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#0F172A]">% de participación</Label>
                <Input
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  placeholder="Ej. 51.00"
                  value={s.porcentajeParticipacion ?? ''}
                  onChange={(e) => updateShareholder(index, 'porcentajeParticipacion', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="h-11 w-40"
                />
              </div>

              {/* Personal data — only if poseeMas25Porciento */}
              {s.poseeMas25Porciento && !s.esPersonaMoral && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#0F172A]">Nombre(s)</Label>
                    <Input
                      placeholder="Ej. Juan"
                      value={s.nombres ?? ''}
                      onChange={(e) => updateShareholder(index, 'nombres', e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#0F172A]">Apellido paterno</Label>
                    <Input
                      placeholder="Ej. Pérez"
                      value={s.apellidoPaterno ?? ''}
                      onChange={(e) => updateShareholder(index, 'apellidoPaterno', e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#0F172A]">Apellido materno</Label>
                    <Input
                      placeholder="Ej. García"
                      value={s.apellidoMaterno ?? ''}
                      onChange={(e) => updateShareholder(index, 'apellidoMaterno', e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#0F172A]">CURP</Label>
                    <Input
                      placeholder="18 caracteres"
                      value={s.curp ?? ''}
                      onChange={(e) => updateShareholder(index, 'curp', e.target.value.toUpperCase())}
                      className="h-11 font-mono tracking-wider"
                      maxLength={18}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#0F172A]">Fecha de nacimiento</Label>
                    <Input
                      type="date"
                      value={s.fechaNacimiento ?? ''}
                      onChange={(e) => updateShareholder(index, 'fechaNacimiento', e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#0F172A]">Teléfono (10 dígitos)</Label>
                    <Input
                      type="tel"
                      placeholder="Ej. 5512345678"
                      value={s.telefono ?? ''}
                      onChange={(e) => updateShareholder(index, 'telefono', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="h-11 font-mono"
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-sm font-medium text-[#0F172A]">Ocupación</Label>
                    <Input
                      placeholder="Ej. Director General"
                      value={s.ocupacion ?? ''}
                      onChange={(e) => updateShareholder(index, 'ocupacion', e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-sm font-medium text-[#0F172A]">
                      Correo electrónico{' '}
                      <span className="text-[#64748B] font-normal">(opcional — para invitarlo a completar su información)</span>
                    </Label>
                    <Input
                      type="email"
                      placeholder="accionista@empresa.com"
                      value={s.email ?? ''}
                      onChange={(e) => updateShareholder(index, 'email', e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add shareholder */}
        <button
          type="button"
          onClick={addShareholder}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-4 text-sm text-[#64748B] hover:text-[#0F2D5E] hover:border-[#0F2D5E]/30 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar otro accionista
        </button>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-11 bg-[#0F2D5E] hover:bg-[#0F2D5E]/90 text-white font-medium"
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continuar'}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full h-10 text-[#64748B] hover:text-[#0F172A] text-sm"
          disabled={loading}
          onClick={async () => {
            if (companyId) await advanceToStepAction(companyId, 'company-docs')
            router.push(fromPerfil ? '/dashboard/perfil' : '/onboarding/company-docs')
          }}
        >
          Saltar por ahora
        </Button>
      </form>
    </>
  )
}
