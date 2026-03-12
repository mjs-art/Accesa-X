'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCompanyDetailAdminAction, getAdminStorageUrlAction } from '@/app/actions/admin'
import type { AdminEmpresaDetail } from '@/app/actions/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft, CheckCircle2, Download, FileText, Loader2, User, Users, XCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ── Config visual ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  submitted:        { label: 'En revisión',      classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  en_revision:      { label: 'Revisando',        classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  aprobado:         { label: 'Aprobado',         classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  fondos_liberados: { label: 'Fondos liberados', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  en_ejecucion:     { label: 'En ejecución',     classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  liquidado:        { label: 'Liquidado',        classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  rechazado:        { label: 'Rechazado',        classes: 'bg-red-50 text-red-700 border-red-200' },
  borrador:         { label: 'Borrador',         classes: 'bg-slate-100 text-slate-500 border-slate-200' },
  docs_pendientes:  { label: 'Docs pendientes',  classes: 'bg-orange-50 text-orange-700 border-orange-200' },
}

const TIPO_LABELS: Record<string, string> = { proyecto: 'Por proyecto', factoraje: 'Factoraje' }

const DOC_TYPE_LABELS: Record<string, string> = {
  id_oficial:           'ID oficial',
  comprobante_domicilio: 'Comprobante de domicilio',
  acta_constitutiva:    'Acta constitutiva',
  actas_asamblea:       'Actas de asamblea',
  documento_poderes:    'Documento de poderes',
  estado_cuenta_bancario: 'Estado de cuenta bancario',
  documento_adicional:  'Documento adicional',
}

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function AdminEmpresaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [company, setCompany] = useState<AdminEmpresaDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { init() }, [id])

  async function init() {
    setLoading(true)
    const result = await getCompanyDetailAdminAction(id)
    if ('company' in result) setCompany(result.company)
    setLoading(false)
  }

  async function handleDocDownload(bucket: string, path: string | null) {
    if (!path) return
    const res = await getAdminStorageUrlAction(bucket, path)
    if ('url' in res) window.open(res.url, '_blank')
    else toast({ title: 'No se pudo abrir el documento', variant: 'destructive' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-[#6B7280]" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#6B7280]">Empresa no encontrada.</p>
        <Button variant="ghost" onClick={() => router.push('/admin/empresas')} className="mt-4">Volver</Button>
      </div>
    )
  }

  const fullName = (lr: AdminEmpresaDetail['legalRep']) =>
    lr ? [lr.nombres, lr.apellidoPaterno, lr.apellidoMaterno].filter(Boolean).join(' ') : '—'

  return (
    <div className="px-8 py-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/empresas')} className="text-[#6B7280] -ml-2">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Empresas
        </Button>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">{company.nombreRazonSocial}</h1>
          <p className="text-sm text-[#6B7280] font-mono">{company.rfc}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {company.estatusSat ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" />SAT conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
              <XCircle className="h-3.5 w-3.5" />SAT sin conectar
            </span>
          )}
        </div>
      </div>

      {/* Datos generales */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Datos generales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Info label="Industria" value={company.industria} />
          <Info label="Tamaño" value={company.tamanoEmpresa} />
          <Info label="Registro" value={formatDate(company.createdAt)} />
          <Info
            label="Onboarding"
            value={
              company.onboardingCompleted
                ? <span className="text-emerald-600 font-medium">Completado</span>
                : <span className="text-amber-600 font-medium">En paso: {company.onboardingStep ?? '—'}</span>
            }
          />
        </CardContent>
      </Card>

      {/* Representante legal */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#6B7280]" />
            <CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Representante legal</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {!company.legalRep ? (
            <p className="text-sm text-[#6B7280]">Sin representante legal registrado.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Info label="Nombre completo" value={fullName(company.legalRep)} />
                <Info label="CURP" value={<span className="font-mono text-xs">{company.legalRep.curp}</span>} />
                <Info label="RFC personal" value={<span className="font-mono">{company.legalRep.rfcPersonal}</span>} />
                <Info label="Email" value={company.legalRep.email} />
                <Info label="Teléfono" value={company.legalRep.telefono} />
              </div>

              {company.legalRepDocs.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Documentos</p>
                  {company.legalRepDocs.map(doc => (
                    <DocRow
                      key={doc.id}
                      label={DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                      status={doc.status}
                      hasFile={!!doc.storagePath}
                      onDownload={() => handleDocDownload('legal-rep-docs', doc.storagePath)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accionistas */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#6B7280]" />
            <CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">
              Accionistas ({company.shareholders.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {company.shareholders.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Sin accionistas registrados.</p>
          ) : (
            <div className="space-y-4">
              {company.shareholders.map((sh, i) => (
                <div key={sh.id} className={`${i > 0 ? 'border-t border-slate-100 pt-4' : ''} grid grid-cols-2 gap-3`}>
                  <Info
                    label="Nombre"
                    value={[sh.nombres, sh.apellidoPaterno, sh.apellidoMaterno].filter(Boolean).join(' ') || '—'}
                  />
                  <Info
                    label="Participación"
                    value={sh.porcentajeParticipacion != null ? `${sh.porcentajeParticipacion}%` : '—'}
                  />
                  <Info label="CURP" value={<span className="font-mono text-xs">{sh.curp ?? '—'}</span>} />
                  <Info label="Tipo" value={sh.esPersonaMoral ? 'Persona moral' : 'Persona física'} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentos de la empresa */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#6B7280]" />
            <CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">
              Documentos de la empresa ({company.companyDocs.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {company.companyDocs.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Sin documentos subidos.</p>
          ) : (
            <div className="space-y-2">
              {company.companyDocs.map(doc => (
                <DocRow
                  key={doc.id}
                  label={DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                  status={doc.status}
                  hasFile={!!doc.storagePath}
                  onDownload={() => handleDocDownload('company-docs', doc.storagePath)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de créditos */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">
            Historial de créditos ({company.creditApplications.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {company.creditApplications.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Sin solicitudes.</p>
          ) : (
            <div className="space-y-2">
              {company.creditApplications.map(app => {
                const sc = STATUS_CONFIG[app.status] ?? { label: app.status, classes: 'bg-slate-100 text-slate-600 border-slate-200' }
                return (
                  <div
                    key={app.id}
                    className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50/60 rounded-lg px-2 -mx-2 transition-colors"
                    onClick={() => router.push(`/admin/solicitudes/${app.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={`${sc.classes} border text-xs px-2 py-0.5`}>{sc.label}</Badge>
                      <span className="text-sm text-[#6B7280]">{TIPO_LABELS[app.tipoCredito] ?? app.tipoCredito}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-[#1A1A1A]">{formatMXN(app.montoSolicitado)}</span>
                      <span className="text-xs text-[#6B7280]">{formatDate(app.createdAt)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Info({ label, value }: { label: string; value: React.ReactNode | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-[#6B7280] mb-1">{label}</p>
      <div className="text-sm font-medium text-[#1A1A1A]">{value ?? '—'}</div>
    </div>
  )
}

function DocRow({ label, status, hasFile, onDownload }: {
  label: string
  status: string
  hasFile: boolean
  onDownload: () => void
}) {
  const statusClasses = status === 'approved'
    ? 'text-emerald-600'
    : status === 'rejected' ? 'text-red-500' : 'text-[#6B7280]'

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-[#1A1A1A]">{label}</p>
          <p className={`text-xs capitalize ${statusClasses}`}>{status}</p>
        </div>
      </div>
      {hasFile && (
        <Button variant="outline" size="sm" onClick={onDownload}
          className="gap-1.5 text-[#3CBEDB] border-[#3CBEDB]/20 hover:bg-[#3CBEDB]/5">
          <Download className="h-3.5 w-3.5" />
          Ver
        </Button>
      )}
    </div>
  )
}
