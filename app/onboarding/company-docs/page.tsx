'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getOnboardingStateAction,
  saveCompanyDocAction,
  advanceToStepAction,
  getCompanyDocsAction,
} from '@/app/actions/onboarding'
import { Uploader } from '@/components/onboarding/uploader'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronDown, CheckCircle2 } from 'lucide-react'
import type { CompanyDocumentType } from '@/features/onboarding/types/onboarding.types'

interface DocConfig {
  type: CompanyDocumentType
  label: string
  description: string
  required: boolean
}

const DOC_CONFIGS: DocConfig[] = [
  {
    type: 'acta_constitutiva',
    label: 'Acta constitutiva',
    description: 'Documento notarial de constitución de la empresa',
    required: true,
  },
  {
    type: 'actas_asamblea',
    label: 'Actas de asamblea recientes',
    description: 'Últimas actas de asamblea de accionistas',
    required: false,
  },
  {
    type: 'documento_poderes',
    label: 'Documento de poderes notariales',
    description: 'Poder notarial del representante legal',
    required: true,
  },
  {
    type: 'estado_cuenta_bancario',
    label: 'Estado de cuenta bancario',
    description: 'Últimos 3 meses de la cuenta empresarial principal',
    required: true,
  },
  {
    type: 'documento_adicional',
    label: 'Documento adicional',
    description: 'Cualquier documento complementario (opcional)',
    required: false,
  },
]

export default function CompanyDocsPage() {
  return <Suspense><CompanyDocsPageInner /></Suspense>
}

function CompanyDocsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPerfil = searchParams.get('from') === 'perfil'

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [uploadedDocs, setUploadedDocs] = useState<Set<CompanyDocumentType>>(new Set())
  const [openAccordion, setOpenAccordion] = useState<CompanyDocumentType | null>('acta_constitutiva')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getOnboardingStateAction().then(async (result) => {
      if (result.error || !result.company) {
        router.push('/onboarding/empresa')
        return
      }
      const id = result.company.id
      setCompanyId(id)

      // Pre-load docs already uploaded in previous sessions
      const docsResult = await getCompanyDocsAction(id)
      if (docsResult.success && docsResult.docs) {
        const existingTypes = new Set(docsResult.docs.map((d) => d.documentType))
        setUploadedDocs(existingTypes)
      }

      setLoadingInit(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function uploadToStorage(
    file: File,
    docType: CompanyDocumentType,
  ): Promise<{ url: string } | { error: string }> {
    if (!companyId) return { error: 'Estado inválido' }

    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `onboarding/${companyId}/company/${docType}-${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('onboarding-docs')
      .upload(path, file, { upsert: true })

    if (error) return { error: 'Error al subir el archivo. Intenta de nuevo.' }

    const { data: { publicUrl } } = supabase.storage.from('onboarding-docs').getPublicUrl(path)

    const result = await saveCompanyDocAction(companyId, docType, publicUrl, path)
    if (result.error) return { error: result.error as string }

    setUploadedDocs((prev) => { const next = new Set(prev); next.add(docType); return next })
    return { url: publicUrl }
  }

  async function handleContinue() {
    if (!companyId) return
    setSubmitting(true)
    setError(null)

    const result = await advanceToStepAction(companyId, 'confirmation')
    if (result.error) {
      setError(result.error as string)
      setSubmitting(false)
      return
    }

    router.push(fromPerfil ? '/dashboard/perfil' : '/onboarding/confirmation')
  }

  const requiredTypes = DOC_CONFIGS.filter((d) => d.required).map((d) => d.type)
  const allRequiredUploaded = requiredTypes.every((t) => uploadedDocs.has(t))

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
            <span className="text-sm font-medium text-[#1A1A1A]">Paso 6 de 7</span>
            <span className="text-sm text-[#6B7280]">Documentos de la empresa</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#3CBEDB] transition-all" style={{ width: '85%' }} />
          </div>
        </div>
      )}

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 pt-8 pb-4">
          <h1 className="text-xl font-semibold text-[#1A1A1A]">Documentos de la empresa</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Sube los documentos corporativos requeridos. Los opcionales pueden enviarse después.
          </p>
        </div>

        {/* Accordion */}
        <div className="divide-y divide-slate-100">
          {DOC_CONFIGS.map((doc) => {
            const isOpen = openAccordion === doc.type
            const isDone = uploadedDocs.has(doc.type)

            return (
              <div key={doc.type}>
                <button
                  type="button"
                  onClick={() => setOpenAccordion(isOpen ? null : doc.type)}
                  className="w-full flex items-center justify-between px-8 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isDone ? 'bg-[#3CBEDB]' : doc.required ? 'bg-amber-400' : 'bg-slate-300'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">
                        {doc.label}
                        {doc.required && (
                          <span className="ml-1.5 text-xs text-amber-600 font-normal">Requerido</span>
                        )}
                      </p>
                      <p className="text-xs text-[#6B7280]">{doc.description}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-[#6B7280] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isOpen && (
                  <div className="px-8 pb-6 pt-1 space-y-3">
                    {isDone && (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Documento ya cargado — sube uno nuevo para reemplazarlo
                      </div>
                    )}
                    <Uploader
                      label={`Sube tu ${doc.label.toLowerCase()}`}
                      accept="application/pdf,image/*"
                      maxSizeMB={20}
                      onUpload={(file) => uploadToStorage(file, doc.type)}
                      onClear={() =>
                        setUploadedDocs((prev) => {
                          const next = new Set(prev)
                          next.delete(doc.type)
                          return next
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-8 pb-8 pt-4 space-y-3">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {!allRequiredUploaded && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Debes subir los documentos marcados como <strong>Requerido</strong> antes de continuar.
            </p>
          )}

          <Button
            onClick={handleContinue}
            disabled={!allRequiredUploaded || submitting}
            className="w-full h-11 bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white font-medium"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continuar'}
          </Button>

          <Button
            variant="ghost"
            className="w-full h-10 text-[#6B7280] hover:text-[#1A1A1A] text-sm"
            disabled={submitting}
            onClick={async () => {
              if (companyId) await advanceToStepAction(companyId, 'confirmation')
              router.push(fromPerfil ? '/dashboard/perfil' : '/onboarding/confirmation')
            }}
          >
            Saltar por ahora
          </Button>
        </div>
      </div>
    </>
  )
}
