'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getClientDetailAction } from '@/app/actions/clientes'
import type { ClienteDetalle, FacturaCliente } from '@/app/actions/clientes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft, UploadCloud, FileText, Loader2, CheckCircle2,
  Clock, AlertCircle, Eye, CreditCard, DollarSign, Receipt,
  TrendingUp, Calendar,
} from 'lucide-react'

interface AnalysisResult {
  resumen: string; monto_total: number; moneda: string
  fecha_inicio: string | null; fecha_fin: string | null
  fechas_pago: string[]; entregables: string[]
  riesgos: { descripcion: string; nivel: 'alto' | 'medio' | 'bajo' }[]
  cliente_nombre: string; viabilidad_score: number; viabilidad_razon: string
}

interface Contrato {
  id: string; nombre_cliente: string; storage_path: string
  analysis_status: 'pending' | 'processing' | 'completed' | 'error'
  analysis_result: AnalysisResult | null; uploaded_at: string
}

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}
function getFileName(p: string) { return p.split('/').pop() ?? p }
function truncateUUID(u: string) { return u.length > 8 ? u.slice(0, 8).toUpperCase() + '...' : u }

function ContractStatusBadge({ status }: { status: Contrato['analysis_status'] }) {
  const map = {
    pending: { label: 'Pendiente', icon: Clock, classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    processing: { label: 'Analizando...', icon: Loader2, classes: 'bg-blue-50 text-blue-700 border-blue-200' },
    completed: { label: 'Analizado', icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    error: { label: 'Error', icon: AlertCircle, classes: 'bg-red-50 text-red-700 border-red-200' },
  }
  const { label, icon: Icon, classes } = map[status]
  return (
    <Badge className={`${classes} border gap-1.5 px-2 py-0.5 font-medium`}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  )
}

function InvoiceStatusBadge({ status, dueAmount }: { status: string; dueAmount: number | null }) {
  if (dueAmount !== null && dueAmount > 0)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Por cobrar</span>
  if (dueAmount === 0)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Pagada</span>
  if (status?.toUpperCase() === 'CANCELADO')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Cancelada</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">Vigente</span>
}

function KpiCard({ title, value, subtitle, icon, accent = false }: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode; accent?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[#6B7280] font-medium">{title}</p>
        {icon}
      </div>
      <p className={`text-xl font-bold ${accent ? 'text-[#3CBEDB]' : 'text-[#1A1A1A]'}`}>{value}</p>
      {subtitle && <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>}
    </div>
  )
}

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const rfc = decodeURIComponent(id)
  const nombreParam = searchParams.get('nombre') ?? rfc

  const [clienteData, setClienteData] = useState<{ client: ClienteDetalle; invoices: FacturaCliente[] } | null>(null)
  const [loadingCliente, setLoadingCliente] = useState(true)
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loadingContratos, setLoadingContratos] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)

  useEffect(() => {
    getClientDetailAction(rfc).then((res) => {
      if (!('error' in res)) setClienteData({ client: res.client, invoices: res.invoices })
      setLoadingCliente(false)
    })
    fetchContratos()
  }, [rfc])

  async function fetchContratos() {
    setLoadingContratos(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: company } = await supabase.from('companies').select('id')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single()
    if (!company) { setLoadingContratos(false); return }
    const { data } = await supabase.from('contracts')
      .select('id, nombre_cliente, storage_path, analysis_status, analysis_result, uploaded_at')
      .eq('company_id', company.id).eq('nombre_cliente', nombreParam)
      .order('uploaded_at', { ascending: false })
    setContratos((data as unknown as Contrato[]) ?? [])
    setLoadingContratos(false)
  }

  async function uploadFile(file: File) {
    if (file.type !== 'application/pdf') { toast({ title: 'Solo PDF', variant: 'destructive' }); return }
    if (file.size > 50 * 1024 * 1024) { toast({ title: 'Máximo 50 MB', variant: 'destructive' }); return }
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: company } = await supabase.from('companies').select('id')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single()
    if (!company) { toast({ title: 'Empresa no encontrada', variant: 'destructive' }); setUploading(false); return }
    const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: storageError } = await supabase.storage.from('contracts').upload(storagePath, file, { contentType: 'application/pdf' })
    if (storageError) { toast({ title: 'Error al subir', description: storageError.message, variant: 'destructive' }); setUploading(false); return }
    const { data: newContract, error: dbError } = await supabase.from('contracts')
      .insert({ company_id: company.id, nombre_cliente: clienteData?.client.nombre ?? nombreParam, client_rfc: rfc, storage_path: storagePath, analysis_status: 'pending' })
      .select('id').single()
    if (dbError || !newContract) { toast({ title: 'Subido pero no registrado', variant: 'destructive' }); setUploading(false); return }
    toast({ title: 'Contrato subido', description: 'Iniciando análisis...' })
    await fetchContratos()
    setUploading(false)
    await triggerAnalysis(newContract.id, storagePath)
  }

  async function triggerAnalysis(contractId: string, storagePath: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { toast({ title: 'Sesión expirada', variant: 'destructive' }); router.push('/'); return }
    setAnalyzing(contractId)
    toast({ title: 'Analizando con Claude...', description: 'Puede tardar hasta 2 min.' })
    const { data, error } = await supabase.functions.invoke('analyze-contract', {
      body: { contract_id: contractId, storage_path: storagePath },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (error || !data?.success) { toast({ title: 'Error al analizar', variant: 'destructive' }); setAnalyzing(null); await fetchContratos() }
    else router.push(`/dashboard/clientes/${id}/contratos/${contractId}`)
  }

  const clienteNombre = clienteData?.client.nombre ?? nombreParam
  const client = clienteData?.client

  return (
    <div>
      {analyzing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-5">
          <div className="h-14 w-14 rounded-full border-4 border-[#3CBEDB]/10 border-t-[#3CBEDB] animate-spin" />
          <p className="text-base font-semibold text-[#1A1A1A]">Analizando con Claude...</p>
        </div>
      )}

      {/* Topbar */}
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/clientes')}
            className="text-[#6B7280] hover:text-[#1A1A1A] -ml-2 h-8 gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Clientes
          </Button>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-[#1A1A1A] truncate max-w-xs">{clienteNombre}</span>
        </div>
        <Button size="sm" variant="outline"
          className="border-[#3CBEDB] text-[#3CBEDB] hover:bg-[#3CBEDB]/5 gap-1.5 h-8 text-xs"
          onClick={() => router.push(`/credito/proyecto/nuevo?clientRfc=${encodeURIComponent(rfc)}&clientNombre=${encodeURIComponent(clienteNombre)}`)}>
          <CreditCard className="h-3.5 w-3.5" />
          Solicitar financiamiento
        </Button>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{clienteNombre}</h1>
          <p className="text-sm text-[#6B7280] font-mono mt-0.5">{rfc}</p>
        </div>

        {/* KPIs */}
        {loadingCliente ? (
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 h-24 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard title="Total facturado" value={client ? formatMXN(client.totalFacturado) : '—'} subtitle="Historial completo" icon={<DollarSign className="h-4 w-4 text-[#3CBEDB]" />} />
            <KpiCard title="Facturas emitidas" value={client ? String(client.numFacturas) : '—'} subtitle="CFDIs vigentes" icon={<Receipt className="h-4 w-4 text-[#3CBEDB]" />} />
            <KpiCard title="Por cobrar" value={client && client.porCobrar > 0 ? formatMXN(client.porCobrar) : client?.porCobrar === 0 ? '$0' : '—'} subtitle={client?.porCobrar === 0 ? 'Al corriente' : 'Pendiente'} icon={<Clock className="h-4 w-4 text-amber-500" />} />
            <KpiCard title="% del total empresa" value={client ? `${client.porcentajeDelTotal}%` : '—'} subtitle="Participación en ingresos" icon={<TrendingUp className="h-4 w-4 text-[#3CBEDB]" />} accent />
          </div>
        )}

        {/* Historial de facturas */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#3CBEDB]" />
              Historial de facturas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingCliente ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#3CBEDB]" /></div>
            ) : !clienteData || clienteData.invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-8 w-8 text-slate-300 mb-3" />
                <p className="text-sm text-[#6B7280]">Sin facturas para este cliente</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-[#6B7280] pl-6">UUID</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Concepto</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Fecha</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">Monto</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] text-right">Por cobrar</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clienteData.invoices.map((inv) => (
                    <TableRow key={inv.uuid} className="hover:bg-slate-50/60">
                      <TableCell className="pl-6">
                        <span className="text-xs font-mono text-[#6B7280]">{truncateUUID(inv.uuid)}</span>
                      </TableCell>
                      <TableCell className="text-sm text-[#1A1A1A] max-w-[200px] truncate">{inv.descripcion}</TableCell>
                      <TableCell className="text-sm text-[#6B7280]">{formatDate(inv.issuedAt)}</TableCell>
                      <TableCell className="text-sm font-medium text-[#1A1A1A] text-right">{formatMXN(inv.total)}</TableCell>
                      <TableCell className="text-sm text-right">
                        {inv.dueAmount !== null
                          ? <span className={inv.dueAmount > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>{inv.dueAmount > 0 ? formatMXN(inv.dueAmount) : '—'}</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell><InvoiceStatusBadge status={inv.status} dueAmount={inv.dueAmount} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Contratos */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#6B7280]" />
              Contratos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f) }}
              onClick={() => !uploading && inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${dragOver ? 'border-[#3CBEDB] bg-[#3CBEDB]/5' : 'border-slate-200 hover:border-[#3CBEDB] hover:bg-slate-50'}
                ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              {uploading
                ? <div className="flex flex-col items-center gap-2"><Loader2 className="h-8 w-8 animate-spin text-[#1A1A1A]" /><p className="text-sm text-[#6B7280]">Subiendo...</p></div>
                : <div className="flex flex-col items-center gap-2">
                    <UploadCloud className={`h-8 w-8 ${dragOver ? 'text-[#3CBEDB]' : 'text-slate-400'}`} />
                    <p className="text-sm text-[#1A1A1A]">Arrastra un PDF o <span className="underline">haz click</span></p>
                    <p className="text-xs text-[#6B7280]">Solo PDF · Máximo 50 MB</p>
                  </div>
              }
            </div>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }} />

            {loadingContratos ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" /></div>
            ) : contratos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-[#6B7280] pl-4">Archivo</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Fecha</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280]">Estado</TableHead>
                    <TableHead className="text-xs font-semibold text-[#6B7280] pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratos.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/60">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#6B7280] shrink-0" />
                          <span className="text-sm text-[#1A1A1A] truncate max-w-xs">{getFileName(c.storage_path)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[#6B7280]">{formatDate(c.uploaded_at)}</TableCell>
                      <TableCell><ContractStatusBadge status={c.analysis_status} /></TableCell>
                      <TableCell className="pr-4">
                        {c.analysis_status === 'completed' && c.analysis_result && (
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/clientes/${id}/contratos/${c.id}`)}
                            className="text-[#1A1A1A] hover:bg-[#3CBEDB]/5 font-medium h-7 text-xs">
                            <Eye className="mr-1 h-3 w-3" />Ver análisis
                          </Button>
                        )}
                        {(c.analysis_status === 'pending' || c.analysis_status === 'error') && (
                          <Button variant="ghost" size="sm" onClick={() => triggerAnalysis(c.id, c.storage_path)}
                            disabled={analyzing === c.id}
                            className="text-amber-600 hover:bg-amber-50 font-medium h-7 text-xs">
                            <Loader2 className={`mr-1 h-3 w-3 ${analyzing === c.id ? 'animate-spin' : ''}`} />
                            {analyzing === c.id ? 'Analizando...' : 'Analizar'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-4"><p className="text-sm text-[#6B7280]">Sin contratos subidos aún</p></div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
