'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOnboardingSummaryAction } from '@/app/actions/onboarding'
import { getDashboardDataAction, getCreditApplicationsAction } from '@/app/actions/dashboard'
import { getResumenAction } from '@/app/actions/inteligencia'
import type { DashboardCompany } from '@/features/dashboard/types/dashboard.types'
import type { CreditApplicationSummary } from '@/app/actions/dashboard'
import type { ResumenData } from '@/app/actions/inteligencia'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  CheckCircle2, AlertTriangle, Loader2, InboxIcon, CreditCard,
  TrendingUp, TrendingDown, Clock, AlertCircle, Activity, Wallet, Percent, RefreshCw,
} from 'lucide-react'

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const DOC_LABELS: Record<string, string> = {
  acta_constitutiva: 'Acta constitutiva',
  actas_asamblea: 'Actas de asamblea',
  documento_poderes: 'Poderes notariales',
  estado_cuenta_bancario: 'Estado de cuenta bancario',
}

const CREDIT_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  submitted:   { label: 'En revisión',  classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  en_revision: { label: 'En revisión',  classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  aprobado:    { label: 'Aprobado',     classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rechazado:   { label: 'Rechazado',    classes: 'bg-red-50 text-red-700 border-red-200' },
}

function CreditAppStatusBadge({ status }: { status: string }) {
  const cfg = CREDIT_STATUS_CONFIG[status] ?? { label: status, classes: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}

const MODULES = [
  { label: 'Ingresos',      href: '/dashboard/inteligencia/ingresos',   icon: TrendingUp,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Gastos',        href: '/dashboard/inteligencia/gastos',     icon: TrendingDown, color: 'text-red-500',     bg: 'bg-red-50' },
  { label: 'Por cobrar',    href: '/dashboard/inteligencia/cxc',        icon: Clock,        color: 'text-[#3CBEDB]',  bg: 'bg-[#3CBEDB]/10' },
  { label: 'Por pagar',     href: '/dashboard/inteligencia/cxp',        icon: AlertCircle,  color: 'text-amber-600',  bg: 'bg-amber-50' },
  { label: 'Flujo de Caja', href: '/dashboard/inteligencia/flujo-caja', icon: Wallet,       color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Análisis',      href: '/dashboard/inteligencia/analisis',   icon: Activity,     color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Margen',        href: '/dashboard/inteligencia/margen',     icon: Percent,      color: 'text-pink-600',   bg: 'bg-pink-50' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [company, setCompany] = useState<DashboardCompany | null>(null)
  const [resumen, setResumen] = useState<ResumenData | null>(null)
  const [applications, setApplications] = useState<CreditApplicationSummary[]>([])
  const [profileSummary, setProfileSummary] = useState<{
    satVerificado: boolean; legalRepRegistrado: boolean; accionistasRegistrados: boolean
    documentosCargados: boolean; documentosFaltantes: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [dashResult, summaryResult, appsResult, resumenResult] = await Promise.all([
        getDashboardDataAction(),
        getOnboardingSummaryAction(),
        getCreditApplicationsAction(),
        getResumenAction(),
      ])

      if ('data' in dashResult && dashResult.data) setCompany(dashResult.data.company)
      if ('summary' in summaryResult && summaryResult.summary) setProfileSummary(summaryResult.summary)
      if ('applications' in appsResult) setApplications(appsResult.applications)
      if (!('error' in resumenResult)) setResumen(resumenResult)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isVerified = !!company?.syntageValidatedAt
  const hasSatData = resumen?.synced ?? false
  const profileIncomplete = profileSummary && (
    !profileSummary.satVerificado || !profileSummary.legalRepRegistrado ||
    !profileSummary.accionistasRegistrados || !profileSummary.documentosCargados
  )

  const kpis = [
    {
      label: 'Ingresos este mes', value: hasSatData ? formatMXN(resumen!.ingresosMesActual) : '—',
      icon: <TrendingUp className="h-4 w-4 text-emerald-600" />, bg: 'bg-emerald-50',
      valueColor: 'text-emerald-700', href: '/dashboard/inteligencia/ingresos',
    },
    {
      label: 'Gastos este mes', value: hasSatData ? formatMXN(resumen!.gastosMesActual) : '—',
      icon: <TrendingDown className="h-4 w-4 text-red-500" />, bg: 'bg-red-50',
      valueColor: 'text-[#1A1A1A]', href: '/dashboard/inteligencia/gastos',
    },
    {
      label: 'Por cobrar', value: hasSatData ? formatMXN(resumen!.totalPorCobrar) : '—',
      icon: <Clock className="h-4 w-4 text-[#3CBEDB]" />, bg: 'bg-[#3CBEDB]/10',
      valueColor: 'text-[#1A1A1A]', href: '/dashboard/inteligencia/cxc',
    },
    {
      label: 'Por pagar', value: hasSatData ? formatMXN(resumen!.totalPorPagar) : '—',
      icon: <AlertCircle className="h-4 w-4 text-amber-500" />, bg: 'bg-amber-50',
      valueColor: resumen?.totalPorPagar ? 'text-amber-700' : 'text-[#1A1A1A]',
      href: '/dashboard/inteligencia/cxp',
    },
  ]

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <div>
          {company ? (
            <>
              <p className="text-sm font-semibold text-[#1A1A1A]">{company.nombreRazonSocial}</p>
              <p className="text-xs text-[#6B7280] font-mono">{company.rfc}</p>
            </>
          ) : (
            <p className="text-sm text-[#6B7280]">Cargando...</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isVerified ? (
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1.5 px-2.5 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              SAT Conectado
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
              onClick={() => router.push('/dashboard/verificacion-fiscal')}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Sin verificar
            </Button>
          )}
        </div>
      </header>

      <div className="px-8 py-8 space-y-6">

        {/* Banner expediente incompleto */}
        {profileIncomplete && (
          <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Tu expediente está incompleto</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Tu solicitud <span className="font-semibold">no será evaluada</span> hasta que completes:
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {!profileSummary!.satVerificado && <li className="text-sm text-amber-700">• Verificación fiscal (SAT)</li>}
                {!profileSummary!.legalRepRegistrado && <li className="text-sm text-amber-700">• Representante legal</li>}
                {!profileSummary!.accionistasRegistrados && <li className="text-sm text-amber-700">• Accionistas</li>}
                {profileSummary!.documentosFaltantes?.map((doc) => (
                  <li key={doc} className="text-sm text-amber-700">• {DOC_LABELS[doc] ?? doc}</li>
                ))}
              </ul>
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white font-medium shrink-0"
              onClick={() => router.push('/dashboard/perfil')}
            >
              Completar
            </Button>
          </div>
        )}

        {/* Título */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Dashboard</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Resumen financiero de tu empresa</p>
          </div>
          <Button
            onClick={() => router.push('/solicitar-credito')}
            className="bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white font-medium px-6"
          >
            Solicitar crédito
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#3CBEDB]" />
          </div>
        ) : !hasSatData ? (
          /* Sin datos SAT */
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-slate-200">
            <RefreshCw className="h-10 w-10 text-slate-300 mb-4" />
            <p className="text-sm font-medium text-[#1A1A1A]">Sin datos fiscales sincronizados</p>
            <p className="text-xs text-[#6B7280] mt-1 max-w-xs">
              Ve a <span className="font-medium">Inteligencia → Resumen</span> para conectar y sincronizar tus datos del SAT.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white"
              onClick={() => router.push('/dashboard/inteligencia')}
            >
              Ir a Inteligencia
            </Button>
          </div>
        ) : (
          <>
            {/* KPIs financieros */}
            <div className="grid grid-cols-4 gap-4">
              {kpis.map((k) => (
                <button
                  key={k.label}
                  onClick={() => router.push(k.href)}
                  className="bg-white rounded-xl border border-slate-200 px-5 py-4 text-left hover:border-[#3CBEDB]/50 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-[#6B7280] font-medium">{k.label}</p>
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${k.bg}`}>
                      {k.icon}
                    </div>
                  </div>
                  <p className={`text-xl font-bold ${k.valueColor}`}>{k.value}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">Este mes</p>
                </button>
              ))}
            </div>

            {/* Gráfica Ingresos vs Gastos */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-5">Ingresos vs Gastos — últimos 6 meses</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={resumen!.meses} barGap={4} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v) => formatMXN(v as number)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#3CBEDB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastos" name="Gastos" fill="#FDA4AF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Accesos rápidos a módulos */}
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest mb-3">Inteligencia de negocio</p>
              <div className="grid grid-cols-7 gap-3">
                {MODULES.map((m) => (
                  <button
                    key={m.href}
                    onClick={() => router.push(m.href)}
                    className="bg-white rounded-xl border border-slate-200 px-4 py-4 flex flex-col items-center gap-2 hover:border-[#3CBEDB]/50 hover:shadow-sm transition-all"
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${m.bg}`}>
                      <m.icon className={`h-4 w-4 ${m.color}`} />
                    </div>
                    <span className="text-xs font-medium text-[#1A1A1A] text-center leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Solicitudes de crédito */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-[#1A1A1A]">Solicitudes de Crédito</CardTitle>
            <Button
              size="sm"
              onClick={() => router.push('/solicitar-credito')}
              className="bg-[#3CBEDB] hover:bg-[#3CBEDB]/90 text-white font-medium"
            >
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Nueva solicitud
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            ) : applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <InboxIcon className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-[#1A1A1A]">Sin solicitudes aún</p>
                <p className="text-xs text-[#6B7280] mt-1">Solicita tu primer crédito empresarial, factoraje o por contrato.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-[#6B7280] pl-6">Tipo</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Monto</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Plazo</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Estatus</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] pr-6">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-medium text-[#1A1A1A] pl-6">
                        {app.tipoCredito === 'empresarial' ? 'Empresarial' : app.tipoCredito === 'factoraje' ? 'Factoraje' : 'Por contrato'}
                      </TableCell>
                      <TableCell className="text-[#1A1A1A]">{formatMXN(app.montoSolicitado)}</TableCell>
                      <TableCell className="text-[#6B7280]">{app.plazoMeses ? `${app.plazoMeses} meses` : '—'}</TableCell>
                      <TableCell><CreditAppStatusBadge status={app.status} /></TableCell>
                      <TableCell className="text-[#6B7280] pr-6">{formatDate(app.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
