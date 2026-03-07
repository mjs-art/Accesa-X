'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOnboardingSummaryAction } from '@/app/actions/onboarding'
import { getDashboardDataAction, signOutAction, syncSatDataAction } from '@/app/actions/dashboard'
import type { DashboardCompany, Resumen, Cliente } from '@/features/dashboard/types/dashboard.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  Users,
  DollarSign,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Loader2,
  InboxIcon,
  RefreshCw,
  LogOut,
  User,
  Bug,
} from 'lucide-react'

const DOC_LABELS: Record<string, string> = {
  acta_constitutiva: 'Acta constitutiva',
  actas_asamblea: 'Actas de asamblea',
  documento_poderes: 'Poderes notariales',
  estado_cuenta_bancario: 'Estado de cuenta bancario',
}

function formatMXN(amount: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function DashboardPage() {
  const router = useRouter()

  const [company, setCompany] = useState<DashboardCompany | null>(null)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [profileSummary, setProfileSummary] = useState<{
    satVerificado: boolean
    legalRepRegistrado: boolean
    accionistasRegistrados: boolean
    documentosCargados: boolean
    documentosFaltantes: string[]
  } | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    async function load() {
      const [dashResult, summaryResult] = await Promise.all([
        getDashboardDataAction(),
        getOnboardingSummaryAction(),
      ])

      if ('data' in dashResult && dashResult.data) {
        setCompany(dashResult.data.company)
        if (dashResult.data.verified) {
          setResumen(dashResult.data.resumen)
          setClientes(dashResult.data.clientes)
        }
      }

      if ('summary' in summaryResult && summaryResult.summary) {
        setProfileSummary(summaryResult.summary)
      }

      setLoadingData(false)
    }
    load()
  }, [])

  const isVerified = !!company?.syntageValidatedAt
  const hasData = resumen !== null

  async function handleLogout() {
    await signOutAction()
    router.push('/')
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)

    const result = await syncSatDataAction()

    if ('error' in result) {
      setSyncMsg({ type: 'error', text: result.error ?? 'Error desconocido' })
      setSyncing(false)
      return
    }

    setSyncMsg({ type: 'success', text: 'Sincronización iniciada. Los datos se actualizarán en unos minutos.' })

    setLoadingData(true)
    const dashResult = await getDashboardDataAction()
    if ('data' in dashResult && dashResult.data?.verified) {
      setResumen(dashResult.data.resumen)
      setClientes(dashResult.data.clientes)
    }
    setLoadingData(false)
    setSyncing(false)
  }

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-[#0F2D5E]">
            Accesa<span className="text-[#00C896]">X</span>
          </span>

          <div className="flex items-center gap-3">
            {company && (
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-[#0F172A]">{company.nombreRazonSocial}</p>
                <p className="text-xs text-[#64748B] font-mono">{company.rfc}</p>
              </div>
            )}
            {isVerified ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1.5 px-2.5 py-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  SAT Conectado
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-[#64748B] hover:text-[#0F2D5E]"
                  onClick={handleSync}
                  disabled={syncing}
                  title="Sincronizar datos del SAT"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0F2D5E]"
                >
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => router.push('/dashboard/perfil')}>
                  <User className="mr-2 h-4 w-4" />
                  Mi perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dashboard/debug')}>
                  <Bug className="mr-2 h-4 w-4 text-slate-400" />
                  <span className="text-slate-500">Debug</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Mensaje resultado de sincronización */}
        {syncMsg && (
          <div className={`flex items-start gap-3 rounded-xl px-5 py-3 border text-sm ${
            syncMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {syncMsg.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            }
            {syncMsg.text}
          </div>
        )}

        {/* Banner expediente incompleto */}
        {profileSummary && (!profileSummary.satVerificado || !profileSummary.legalRepRegistrado || !profileSummary.accionistasRegistrados || !profileSummary.documentosCargados) && (
          <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                Tu expediente está incompleto
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Tu solicitud <span className="font-semibold">no será evaluada</span> por un asesor hasta que completes:
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {!profileSummary.satVerificado && (
                  <li className="text-sm text-amber-700">• Verificación fiscal (SAT)</li>
                )}
                {!profileSummary.legalRepRegistrado && (
                  <li className="text-sm text-amber-700">• Representante legal</li>
                )}
                {!profileSummary.accionistasRegistrados && (
                  <li className="text-sm text-amber-700">• Accionistas</li>
                )}
                {profileSummary.documentosFaltantes?.map((doc) => (
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

        {/* Título + CTA */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Dashboard</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              Resumen financiero de tu empresa
            </p>
          </div>
          <Button
            onClick={() => router.push('/solicitar-credito')}
            className="bg-[#00C896] hover:bg-[#00C896]/90 text-white font-medium px-6"
          >
            Solicitar crédito
          </Button>
        </div>

        {/* Cards de resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            title="Total facturado"
            icon={<DollarSign className="h-4 w-4 text-[#00C896]" />}
            loading={loadingData}
            empty={!hasData}
            emptyText="Sin datos"
          >
            {resumen && (
              <>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {formatMXN(resumen.totalFacturado)}
                </p>
                <p className="text-xs text-[#64748B] mt-1">Últimos 12 meses</p>
              </>
            )}
          </SummaryCard>

          <SummaryCard
            title="Clientes únicos"
            icon={<Users className="h-4 w-4 text-[#00C896]" />}
            loading={loadingData}
            empty={!hasData}
            emptyText="Sin datos"
          >
            {resumen && (
              <>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {resumen.clientesUnicos}
                </p>
                <p className="text-xs text-[#64748B] mt-1">Con al menos 1 factura</p>
              </>
            )}
          </SummaryCard>

          <SummaryCard
            title="Facturas emitidas"
            icon={<FileText className="h-4 w-4 text-[#00C896]" />}
            loading={loadingData}
            empty={!hasData}
            emptyText="Sin datos"
          >
            {resumen && (
              <>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {resumen.facturasEmitidas}
                </p>
                <p className="text-xs text-[#64748B] mt-1">CFDI vigentes</p>
              </>
            )}
          </SummaryCard>
        </div>

        {/* Tabla de clientes */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#0F172A]">
              Mis Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingData ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[#0F2D5E]" />
              </div>
            ) : clientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <InboxIcon className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-[#0F172A]">
                  {isVerified ? 'No hay facturas emitidas aún' : 'Conecta tu empresa con el SAT'}
                </p>
                <p className="text-xs text-[#64748B] mt-1 max-w-xs">
                  {isVerified
                    ? 'Los clientes aparecerán aquí una vez que Syntage termine de extraer tus CFDI del SAT.'
                    : 'Verifica tu empresa para ver tus clientes y facturas reales.'}
                </p>
                {!isVerified && (
                  <Button
                    size="sm"
                    className="mt-4 bg-[#0F2D5E] hover:bg-[#0F2D5E]/90 text-white"
                    onClick={() => router.push('/dashboard/verificacion-fiscal')}
                  >
                    Verificar empresa
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-[#64748B] pl-6">Cliente</TableHead>
                    <TableHead className="text-xs font-semibold text-[#64748B]">RFC</TableHead>
                    <TableHead className="text-xs font-semibold text-[#64748B]">Total facturado</TableHead>
                    <TableHead className="text-xs font-semibold text-[#64748B]">Facturas</TableHead>
                    <TableHead className="text-xs font-semibold text-[#64748B]">Última factura</TableHead>
                    <TableHead className="text-xs font-semibold text-[#64748B] pr-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente) => (
                    <TableRow key={cliente.rfc} className="hover:bg-slate-50/60">
                      <TableCell className="font-medium text-[#0F172A] pl-6">
                        {cliente.nombre}
                      </TableCell>
                      <TableCell className="text-xs text-[#64748B] font-mono">
                        {cliente.rfc}
                      </TableCell>
                      <TableCell className="text-[#0F172A]">
                        {formatMXN(cliente.totalFacturado)}
                      </TableCell>
                      <TableCell className="text-[#64748B]">{cliente.facturas}</TableCell>
                      <TableCell className="text-[#64748B]">
                        {formatDate(cliente.ultimaFactura)}
                      </TableCell>
                      <TableCell className="pr-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#0F2D5E] hover:text-[#0F2D5E] hover:bg-[#0F2D5E]/5 font-medium"
                          onClick={() => router.push(`/dashboard/clientes/${encodeURIComponent(cliente.rfc)}?nombre=${encodeURIComponent(cliente.nombre)}`)}
                        >
                          Ver contratos
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function SummaryCard({
  title,
  icon,
  loading,
  empty,
  emptyText,
  children,
}: {
  title: string
  icon: React.ReactNode
  loading: boolean
  empty: boolean
  emptyText: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[#64748B]">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
        ) : empty ? (
          <p className="text-sm text-slate-400">{emptyText}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
