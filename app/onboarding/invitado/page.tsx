'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import type { OnboardingInvitation } from '@/features/onboarding/types/onboarding.types'
import {
  getInvitationByTokenAction,
  acceptShareholderInvitationAction,
  acceptLegalRepInvitationAction,
} from '@/app/actions/invitado'

type PageState = 'loading' | 'already_accepted' | 'expired' | 'not_found' | 'form' | 'success'

function InvitadoPageInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [pageState, setPageState] = useState<PageState>('loading')
  const [invitation, setInvitation] = useState<OnboardingInvitation | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Shareholder form
  const [nombres, setNombres] = useState('')
  const [apellidoPaterno, setApellidoPaterno] = useState('')
  const [apellidoMaterno, setApellidoMaterno] = useState('')
  const [curp, setCurp] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [ocupacion, setOcupacion] = useState('')
  const [telefono, setTelefono] = useState('')
  // Legal rep extras
  const [rfcPersonal, setRfcPersonal] = useState('')

  useEffect(() => {
    if (!token) {
      setPageState('not_found')
      return
    }
    getInvitationByTokenAction(token).then(({ invitation: inv, error }) => {
      if (!inv || error === 'Invitación no encontrada') {
        setPageState('not_found')
        return
      }
      if (inv.status === 'accepted') {
        setPageState('already_accepted')
        return
      }
      if (inv.status === 'expired' || error === 'expired') {
        setPageState('expired')
        return
      }
      setInvitation(inv)
      // Pre-fill name from invitation if available
      if (inv.inviteeName) {
        const parts = inv.inviteeName.trim().split(' ')
        setNombres(parts[0] ?? '')
        setApellidoPaterno(parts[1] ?? '')
        setApellidoMaterno(parts[2] ?? '')
      }
      setPageState('form')
    })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invitation) return
    setSubmitting(true)
    setSubmitError(null)

    let result: { success?: boolean; error?: string }

    if (invitation.invitationType === 'shareholder') {
      result = await acceptShareholderInvitationAction({
        token,
        companyId: invitation.companyId,
        esPersonaMoral: false,
        poseeMas25Porciento: true,
        nombres: nombres || null,
        apellidoPaterno: apellidoPaterno || null,
        apellidoMaterno: apellidoMaterno || null,
        curp: curp || null,
        fechaNacimiento: fechaNacimiento || null,
        ocupacion: ocupacion || null,
        telefono: telefono || null,
      })
    } else {
      result = await acceptLegalRepInvitationAction({
        token,
        companyId: invitation.companyId,
        nombres: nombres || null,
        apellidoPaterno: apellidoPaterno || null,
        apellidoMaterno: apellidoMaterno || null,
        curp: curp || null,
        rfcPersonal: rfcPersonal || null,
        email: invitation.inviteeEmail,
        telefono: telefono || null,
      })
    }

    if (result.error === 'already_accepted') {
      setPageState('already_accepted')
    } else if (result.error === 'expired') {
      setPageState('expired')
    } else if (result.error) {
      setSubmitError('Ocurrió un error al guardar tu información. Intenta de nuevo.')
    } else {
      setPageState('success')
    }
    setSubmitting(false)
  }

  if (pageState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F2D5E]" />
        <p className="text-[#64748B]">Cargando invitación...</p>
      </div>
    )
  }

  if (pageState === 'not_found') {
    return (
      <StatusScreen
        icon={<XCircle className="h-12 w-12 text-red-500" />}
        title="Invitación no encontrada"
        description="Este enlace no es válido o no existe. Por favor contacta a quien te invitó."
      />
    )
  }

  if (pageState === 'expired') {
    return (
      <StatusScreen
        icon={<Clock className="h-12 w-12 text-amber-500" />}
        title="Enlace expirado"
        description="Este enlace de invitación ya expiró (72 horas). Pide a la empresa que te envíe una nueva invitación."
      />
    )
  }

  if (pageState === 'already_accepted') {
    return (
      <StatusScreen
        icon={<CheckCircle className="h-12 w-12 text-green-500" />}
        title="Información ya completada"
        description="Tu información ya fue registrada exitosamente. No es necesario hacer nada más."
      />
    )
  }

  if (pageState === 'success') {
    return (
      <StatusScreen
        icon={<CheckCircle className="h-12 w-12 text-green-500" />}
        title="¡Información enviada!"
        description="Tu información fue registrada correctamente. La empresa continuará con el proceso de evaluación."
      />
    )
  }

  // Form state
  const isShareholder = invitation?.invitationType === 'shareholder'
  const roleLabel = isShareholder ? 'accionista' : 'representante legal'

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0F2D5E]/10 mb-4">
            <span className="text-2xl font-bold text-[#0F2D5E]">A</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F2D5E] mb-1">Completa tu información</h1>
          <p className="text-[#64748B] text-sm">
            Fuiste invitado como <strong>{roleLabel}</strong>
            {invitation?.inviteeName ? ` — ${invitation.inviteeName}` : ''}.
            Por favor llena los datos a continuación.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#0F172A]">Nombre(s) <span className="text-red-500">*</span></Label>
              <Input
                required
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Juan"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#0F172A]">Apellido paterno <span className="text-red-500">*</span></Label>
              <Input
                required
                value={apellidoPaterno}
                onChange={(e) => setApellidoPaterno(e.target.value)}
                placeholder="García"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#0F172A]">Apellido materno</Label>
              <Input
                value={apellidoMaterno}
                onChange={(e) => setApellidoMaterno(e.target.value)}
                placeholder="López"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#0F172A]">CURP</Label>
              <Input
                value={curp}
                onChange={(e) => setCurp(e.target.value.toUpperCase())}
                placeholder="GARL900101HDFRCN01"
                className="h-11 font-mono uppercase"
                maxLength={18}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#0F172A]">Fecha de nacimiento</Label>
              <Input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#0F172A]">Teléfono celular</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] text-sm">
                  +52
                </span>
                <Input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="5512345678"
                  className="h-11 rounded-l-none"
                  maxLength={10}
                />
              </div>
            </div>
            {!isShareholder && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#0F172A]">RFC personal</Label>
                <Input
                  value={rfcPersonal}
                  onChange={(e) => setRfcPersonal(e.target.value.toUpperCase())}
                  placeholder="GARL900101ABC"
                  className="h-11 font-mono uppercase"
                  maxLength={13}
                />
              </div>
            )}
            {isShareholder && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#0F172A]">Ocupación</Label>
                <Input
                  value={ocupacion}
                  onChange={(e) => setOcupacion(e.target.value)}
                  placeholder="Director General"
                  className="h-11"
                />
              </div>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{submitError}</p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-[#00C896] hover:bg-[#00b384] text-white font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              'Enviar información'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

function StatusScreen({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="mb-4">{icon}</div>
      <h1 className="text-2xl font-bold text-[#0F2D5E] mb-2">{title}</h1>
      <p className="text-[#64748B] max-w-sm">{description}</p>
    </div>
  )
}

export default function InvitadoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-[#0F2D5E]" />
        </div>
      }
    >
      <InvitadoPageInner />
    </Suspense>
  )
}
