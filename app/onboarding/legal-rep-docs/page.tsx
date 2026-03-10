'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getOnboardingStateAction,
  getLegalRepAction,
  saveLegalRepDocAction,
  advanceToStepAction,
} from '@/app/actions/onboarding'
import { Uploader } from '@/components/onboarding/uploader'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface UploadedDocs {
  id_oficial: boolean
  comprobante_domicilio: boolean
}

export default function LegalRepDocsPage() {
  return <Suspense><LegalRepDocsPageInner /></Suspense>
}

function LegalRepDocsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPerfil = searchParams.get('from') === 'perfil'

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [legalRepId, setLegalRepId] = useState<string | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [uploaded, setUploaded] = useState<UploadedDocs>({ id_oficial: false, comprobante_domicilio: false })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const state = await getOnboardingStateAction()
      if (state.error || !state.company) {
        router.push('/onboarding/empresa')
        return
      }
      const cid = state.company.id
      setCompanyId(cid)

      const lrResult = await getLegalRepAction(cid)
      if (lrResult.error || !lrResult.legalRep) {
        router.push('/onboarding/legal-rep')
        return
      }
      setLegalRepId(lrResult.legalRep.id)
      setLoadingInit(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function uploadToStorage(file: File, docType: string): Promise<{ url: string } | { error: string }> {
    if (!companyId || !legalRepId) return { error: 'Estado inválido' }

    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `onboarding/${companyId}/legal-rep/${docType}-${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('onboarding-docs')
      .upload(path, file, { upsert: true })

    if (error) return { error: 'Error al subir el archivo. Intenta de nuevo.' }

    const { data: { publicUrl } } = supabase.storage.from('onboarding-docs').getPublicUrl(path)

    const result = await saveLegalRepDocAction(
      legalRepId,
      companyId,
      docType as 'id_oficial' | 'comprobante_domicilio',
      publicUrl,
      path,
    )

    if (result.error) return { error: result.error as string }

    setUploaded((prev) => ({ ...prev, [docType]: true }))
    return { url: publicUrl }
  }

  async function handleContinue() {
    if (!companyId) return
    setSubmitting(true)
    setError(null)

    const result = await advanceToStepAction(companyId, 'shareholders')
    if (result.error) {
      setError(result.error as string)
      setSubmitting(false)
      return
    }

    router.push(fromPerfil ? '/dashboard/perfil' : '/onboarding/shareholders')
  }

  const allUploaded = uploaded.id_oficial && uploaded.comprobante_domicilio

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#1A1A1A]" />
      </div>
    )
  }

  return (
    <>
      {!fromPerfil && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#1A1A1A]">Paso 4 de 7</span>
            <span className="text-sm text-[#6B7280]">Documentos del representante</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#3CBEDB] transition-all" style={{ width: '57%' }} />
          </div>
        </div>
      )}

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#1A1A1A]">Documentos del representante legal</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Sube la identificación oficial y el comprobante de domicilio del representante.
          </p>
        </div>

        <div className="space-y-6">
          <Uploader
            label="Identificación oficial (INE, pasaporte o cédula profesional)"
            accept="application/pdf,image/*"
            maxSizeMB={10}
            onUpload={(file) => uploadToStorage(file, 'id_oficial')}
            onClear={() => setUploaded((prev) => ({ ...prev, id_oficial: false }))}
          />

          <Uploader
            label="Comprobante de domicilio (no mayor a 3 meses)"
            accept="application/pdf,image/*"
            maxSizeMB={10}
            onUpload={(file) => uploadToStorage(file, 'comprobante_domicilio')}
            onClear={() => setUploaded((prev) => ({ ...prev, comprobante_domicilio: false }))}
          />

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            onClick={handleContinue}
            disabled={!allUploaded || submitting}
            className="w-full h-11 bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white font-medium"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continuar'}
          </Button>

          <Button
            variant="ghost"
            className="w-full h-10 text-[#6B7280] hover:text-[#1A1A1A] text-sm"
            disabled={submitting}
            onClick={async () => {
              if (companyId) await advanceToStepAction(companyId, 'shareholders')
              router.push(fromPerfil ? '/dashboard/perfil' : '/onboarding/shareholders')
            }}
          >
            Saltar por ahora
          </Button>
        </div>
      </div>
    </>
  )
}
