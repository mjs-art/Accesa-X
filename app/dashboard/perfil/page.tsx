'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProfileDataAction } from '@/app/actions/onboarding'
import type { Company, LegalRepresentative, Shareholder, CompanyDocument } from '@/features/onboarding/types/onboarding.types'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
  Users,
  FileText,
  ChevronLeft,
  Loader2,
  Plus,
} from 'lucide-react'

const DOC_LABELS: Record<string, string> = {
  acta_constitutiva: 'Acta constitutiva',
  actas_asamblea: 'Actas de asamblea',
  documento_poderes: 'Poderes notariales',
  estado_cuenta_bancario: 'Estado de cuenta bancario',
  documento_adicional: 'Documento adicional',
}

function SectionHeader({
  icon,
  title,
  done,
  onComplete,
  completeLabel = 'Completar',
}: {
  icon: React.ReactNode
  title: string
  done: boolean
  onComplete?: () => void
  completeLabel?: string
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-lg ${done ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          {icon}
        </div>
        <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
        {done
          ? <CheckCircle2 className="h-4 w-4 text-[#00C896]" />
          : <AlertCircle className="h-4 w-4 text-amber-500" />
        }
      </div>
      {!done && onComplete && (
        <Button
          size="sm"
          variant="outline"
          className="border-[#0F2D5E] text-[#0F2D5E] hover:bg-[#0F2D5E]/5 h-8 text-xs"
          onClick={onComplete}
        >
          {completeLabel}
        </Button>
      )}
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-[#64748B] shrink-0">{label}</span>
      <span className="text-sm font-medium text-[#0F172A] text-right">{value || '—'}</span>
    </div>
  )
}

export default function PerfilPage() {
  const router = useRouter()

  const [company, setCompany] = useState<Company | null>(null)
  const [legalRep, setLegalRep] = useState<LegalRepresentative | null>(null)
  const [shareholders, setShareholders] = useState<Shareholder[]>([])
  const [companyDocs, setCompanyDocs] = useState<CompanyDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProfileDataAction().then((result) => {
      if ('error' in result) {
        router.push('/dashboard')
        return
      }
      setCompany(result.company)
      setLegalRep(result.legalRep ?? null)
      setShareholders(result.shareholders)
      setCompanyDocs(result.companyDocs)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function goComplete(path: string) {
    router.push(`${path}?from=perfil`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0F2D5E]" />
      </div>
    )
  }

  const hasShareholders = shareholders.length > 0
  const hasDocs = companyDocs.length > 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-bold text-[#0F2D5E]">
            Accesa<span className="text-[#00C896]">X</span>
          </span>
          <span className="text-sm text-[#64748B]">/ Mi perfil</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* ── Empresa ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <SectionHeader
            icon={<Building2 className="h-4 w-4 text-[#0F2D5E]" />}
            title="Empresa"
            done={true}
          />
          <DataRow label="Razón social" value={company?.nombreRazonSocial} />
          <DataRow label="RFC" value={company?.rfc} />
          <DataRow label="Industria" value={company?.industria} />
          <DataRow label="Tamaño" value={company?.tamanoEmpresa} />
        </div>

        {/* ── Verificación SAT ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <SectionHeader
            icon={<ShieldCheck className={`h-4 w-4 ${company?.syntageValidatedAt ? 'text-[#0F2D5E]' : 'text-slate-400'}`} />}
            title="Verificación fiscal (SAT)"
            done={!!company?.syntageValidatedAt}
            onComplete={() => router.push('/onboarding/verificacion-fiscal?from=perfil')}
            completeLabel="Conectar SAT"
          />
          {company?.syntageValidatedAt ? (
            <DataRow
              label="Verificado el"
              value={new Date(company.syntageValidatedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
            />
          ) : (
            <p className="text-sm text-[#64748B]">
              No se ha conectado con el SAT. Conecta tu empresa para obtener mejores condiciones de crédito.
            </p>
          )}
        </div>

        {/* ── Representante legal ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <SectionHeader
            icon={<Users className={`h-4 w-4 ${legalRep ? 'text-[#0F2D5E]' : 'text-slate-400'}`} />}
            title="Representante legal"
            done={!!legalRep}
            onComplete={() => goComplete('/onboarding/legal-rep')}
          />
          {legalRep ? (
            <>
              <DataRow
                label="Nombre"
                value={[legalRep.nombres, legalRep.apellidoPaterno, legalRep.apellidoMaterno].filter(Boolean).join(' ') || null}
              />
              <DataRow label="CURP" value={legalRep.curp} />
              <DataRow label="RFC personal" value={legalRep.rfcPersonal} />
              <DataRow label="Email" value={legalRep.email} />
              <DataRow label="Teléfono" value={legalRep.telefono} />
            </>
          ) : (
            <p className="text-sm text-[#64748B]">
              Aún no has registrado al representante legal de la empresa.
            </p>
          )}
        </div>

        {/* ── Accionistas ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <SectionHeader
            icon={<Users className={`h-4 w-4 ${hasShareholders ? 'text-[#0F2D5E]' : 'text-slate-400'}`} />}
            title="Accionistas"
            done={hasShareholders}
            onComplete={() => goComplete('/onboarding/shareholders')}
            completeLabel="Agregar"
          />
          {hasShareholders ? (
            <div className="space-y-4">
              {shareholders.map((s, i) => (
                <div key={s.id} className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
                  <p className="text-xs font-medium text-[#64748B] mb-2">Accionista {i + 1}</p>
                  <DataRow
                    label="Nombre"
                    value={[s.nombres, s.apellidoPaterno, s.apellidoMaterno].filter(Boolean).join(' ') || (s.esPersonaMoral ? 'Persona moral' : null)}
                  />
                  <DataRow label="% participación" value={s.porcentajeParticipacion != null ? `${s.porcentajeParticipacion}%` : null} />
                  {s.poseeMas25Porciento && <DataRow label="CURP" value={s.curp} />}
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full border-dashed border-slate-300 text-[#64748B] hover:text-[#0F2D5E] gap-1.5 h-9"
                onClick={() => goComplete('/onboarding/shareholders')}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar accionista
              </Button>
            </div>
          ) : (
            <p className="text-sm text-[#64748B]">
              No has registrado accionistas aún.
            </p>
          )}
        </div>

        {/* ── Documentos ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <SectionHeader
            icon={<FileText className={`h-4 w-4 ${hasDocs ? 'text-[#0F2D5E]' : 'text-slate-400'}`} />}
            title="Documentos de la empresa"
            done={hasDocs}
            onComplete={() => goComplete('/onboarding/company-docs')}
            completeLabel="Subir documentos"
          />
          {hasDocs ? (
            <div className="space-y-2">
              {companyDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-[#64748B]">{DOC_LABELS[doc.documentType] ?? doc.documentType}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Cargado
                  </span>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full border-dashed border-slate-300 text-[#64748B] hover:text-[#0F2D5E] gap-1.5 h-9 mt-2"
                onClick={() => goComplete('/onboarding/company-docs')}
              >
                <Plus className="h-3.5 w-3.5" />
                Subir más documentos
              </Button>
            </div>
          ) : (
            <p className="text-sm text-[#64748B]">
              No has subido documentos corporativos aún.
            </p>
          )}
        </div>

      </main>
    </div>
  )
}
