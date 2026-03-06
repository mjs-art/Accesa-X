'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveLegalRepAction, getOnboardingStateAction, getLegalRepAction } from '@/app/actions/onboarding'
import { sendInvitationAction } from '@/app/actions/send-invitation'
import { legalRepSchema } from '@/features/onboarding/schemas/legal-rep.schema'
import type { LegalRepFormData } from '@/features/onboarding/schemas/legal-rep.schema'
import type { LegalRepresentative } from '@/features/onboarding/types/onboarding.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

type FieldErrors = Partial<Record<keyof LegalRepFormData, string[]>>

export default function LegalRepPage() {
  return <Suspense><LegalRepPageInner /></Suspense>
}

function LegalRepPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPerfil = searchParams.get('from') === 'perfil'

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loadingCompany, setLoadingCompany] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [savedLegalRep, setSavedLegalRep] = useState<LegalRepresentative | null>(null)

  const [form, setForm] = useState<LegalRepFormData>({
    esElUsuario: false,
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    curp: '',
    rfcPersonal: '',
    email: '',
    telefono: '',
  })
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getOnboardingStateAction().then(async (result) => {
      if (result.error || !result.company) {
        router.push('/onboarding/empresa')
        return
      }
      const id = result.company.id
      setCompanyId(id)
      setUserEmail(result.userEmail ?? null)

      // Load existing legal rep data for autocomplete
      const legalRepResult = await getLegalRepAction(id)
      if (legalRepResult.success && legalRepResult.legalRep) {
        const lr = legalRepResult.legalRep
        setSavedLegalRep(lr)
        // Pre-fill form if data already exists
        setForm({
          esElUsuario: lr.esElUsuario,
          nombres: lr.nombres ?? '',
          apellidoPaterno: lr.apellidoPaterno ?? '',
          apellidoMaterno: lr.apellidoMaterno ?? '',
          curp: lr.curp ?? '',
          rfcPersonal: lr.rfcPersonal ?? '',
          email: lr.email ?? '',
          telefono: lr.telefono ? lr.telefono.replace(/^\+52/, '') : '',
        })
      }

      setLoadingCompany(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleChange(field: keyof LegalRepFormData, value: string | boolean) {
    if (field === 'esElUsuario') {
      if (value === true) {
        // Auto-fill: email from auth account, other fields from previously saved data if any
        setForm((prev) => ({
          ...prev,
          esElUsuario: true,
          nombres: savedLegalRep?.nombres ?? prev.nombres ?? '',
          apellidoPaterno: savedLegalRep?.apellidoPaterno ?? prev.apellidoPaterno ?? '',
          apellidoMaterno: savedLegalRep?.apellidoMaterno ?? prev.apellidoMaterno ?? '',
          curp: savedLegalRep?.curp ?? prev.curp ?? '',
          rfcPersonal: savedLegalRep?.rfcPersonal ?? prev.rfcPersonal ?? '',
          email: userEmail ?? savedLegalRep?.email ?? prev.email ?? '',
          telefono: savedLegalRep?.telefono
            ? savedLegalRep.telefono.replace(/^\+52/, '')
            : (prev.telefono ?? ''),
        }))
      } else {
        // Clear all personal fields when unchecking
        setForm((prev) => ({
          ...prev,
          esElUsuario: false,
          nombres: '',
          apellidoPaterno: '',
          apellidoMaterno: '',
          curp: '',
          rfcPersonal: '',
          email: '',
          telefono: '',
        }))
      }
      setFieldErrors({})
      setError(null)
      return
    }
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId) return

    const parsed = legalRepSchema.safeParse(form)
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors)
      return
    }

    setLoading(true)
    setError(null)

    const result = await saveLegalRepAction(companyId, form)

    if (result.error) {
      if (typeof result.error === 'string') {
        setError(result.error)
      } else {
        setFieldErrors(result.error as FieldErrors)
      }
      setLoading(false)
      return
    }

    // Invitar al representante legal si no es el usuario (fire-and-forget)
    if (!form.esElUsuario && form.email) {
      sendInvitationAction(companyId, form.email, 'legal_rep', form.nombres || undefined)
        .catch(() => {})
    }

    router.push(fromPerfil ? '/dashboard/perfil' : '/onboarding/legal-rep-docs')
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
      {!fromPerfil && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#0F2D5E]">Paso 3 de 7</span>
            <span className="text-sm text-[#64748B]">Representante legal</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#00C896] transition-all" style={{ width: '42%' }} />
          </div>
        </div>
      )}

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#0F172A]">Datos del representante legal</h1>
          <p className="text-sm text-[#64748B] mt-1">
            La persona con poder notarial para obligar a la empresa.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ¿Eres tú el rep legal? */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <input
              id="esElUsuario"
              type="checkbox"
              checked={form.esElUsuario}
              onChange={(e) => handleChange('esElUsuario', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#0F2D5E] focus:ring-[#0F2D5E]/30"
            />
            <Label htmlFor="esElUsuario" className="text-sm text-[#0F172A] cursor-pointer">
              Soy yo el representante legal
            </Label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nombres */}
            <div className="space-y-1.5">
              <Label htmlFor="nombres" className="text-sm font-medium text-[#0F172A]">
                Nombre(s)<span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                id="nombres"
                placeholder="Ej. María Guadalupe"
                value={form.nombres ?? ''}
                onChange={(e) => handleChange('nombres', e.target.value)}
                disabled={loading}
                className="h-11"
              />
              {fieldErrors.nombres && (
                <p className="text-xs text-red-500">{fieldErrors.nombres[0]}</p>
              )}
            </div>

            {/* Apellido paterno */}
            <div className="space-y-1.5">
              <Label htmlFor="apellidoPaterno" className="text-sm font-medium text-[#0F172A]">
                Apellido paterno<span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                id="apellidoPaterno"
                placeholder="Ej. González"
                value={form.apellidoPaterno ?? ''}
                onChange={(e) => handleChange('apellidoPaterno', e.target.value)}
                disabled={loading}
                className="h-11"
              />
              {fieldErrors.apellidoPaterno && (
                <p className="text-xs text-red-500">{fieldErrors.apellidoPaterno[0]}</p>
              )}
            </div>

            {/* Apellido materno */}
            <div className="space-y-1.5">
              <Label htmlFor="apellidoMaterno" className="text-sm font-medium text-[#0F172A]">
                Apellido materno
              </Label>
              <Input
                id="apellidoMaterno"
                placeholder="Ej. López"
                value={form.apellidoMaterno ?? ''}
                onChange={(e) => handleChange('apellidoMaterno', e.target.value)}
                disabled={loading}
                className="h-11"
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-1.5">
              <Label htmlFor="telefono" className="text-sm font-medium text-[#0F172A]">
                Teléfono (10 dígitos)
              </Label>
              <Input
                id="telefono"
                type="tel"
                placeholder="Ej. 5512345678"
                value={form.telefono ?? ''}
                onChange={(e) => handleChange('telefono', e.target.value.replace(/\D/g, '').slice(0, 10))}
                disabled={loading}
                className="h-11 font-mono tracking-wider"
                maxLength={10}
              />
              {fieldErrors.telefono && (
                <p className="text-xs text-red-500">{fieldErrors.telefono[0]}</p>
              )}
            </div>

            {/* CURP */}
            <div className="space-y-1.5">
              <Label htmlFor="curp" className="text-sm font-medium text-[#0F172A]">
                CURP<span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                id="curp"
                placeholder="18 caracteres"
                value={form.curp ?? ''}
                onChange={(e) => handleChange('curp', e.target.value.toUpperCase())}
                disabled={loading}
                className="h-11 font-mono tracking-wider"
                maxLength={18}
              />
              {fieldErrors.curp && (
                <p className="text-xs text-red-500">{fieldErrors.curp[0]}</p>
              )}
            </div>

            {/* RFC personal */}
            <div className="space-y-1.5">
              <Label htmlFor="rfcPersonal" className="text-sm font-medium text-[#0F172A]">
                RFC (persona física)<span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                id="rfcPersonal"
                placeholder="13 caracteres"
                value={form.rfcPersonal ?? ''}
                onChange={(e) => handleChange('rfcPersonal', e.target.value.toUpperCase())}
                disabled={loading}
                className="h-11 font-mono tracking-wider"
                maxLength={13}
              />
              {fieldErrors.rfcPersonal && (
                <p className="text-xs text-red-500">{fieldErrors.rfcPersonal[0]}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-[#0F172A]">
              Correo electrónico<span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="representante@empresa.com"
              value={form.email ?? ''}
              onChange={(e) => handleChange('email', e.target.value)}
              disabled={loading}
              className="h-11"
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-500">{fieldErrors.email[0]}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-11 bg-[#0F2D5E] hover:bg-[#0F2D5E]/90 text-white font-medium mt-2"
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continuar'}
          </Button>
        </form>
      </div>
    </>
  )
}
