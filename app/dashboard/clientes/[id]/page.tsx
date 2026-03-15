'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
} from 'lucide-react'


interface AnalysisResult {
  resumen: string
  monto_total: number
  moneda: string
  fecha_inicio: string | null
  fecha_fin: string | null
  fechas_pago: string[]
  entregables: string[]
  riesgos: { descripcion: string; nivel: 'alto' | 'medio' | 'bajo' }[]
  cliente_nombre: string
  viabilidad_score: number
  viabilidad_razon: string
}

interface Contrato {
  id: string
  nombre_cliente: string
  storage_path: string
  analysis_status: 'pending' | 'processing' | 'completed' | 'error'
  analysis_result: AnalysisResult | null
  uploaded_at: string
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Contrato['analysis_status'] }) {
  const map = {
    pending: { label: 'Pendiente', icon: Clock, classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    processing: { label: 'Analizando...', icon: Loader2, classes: 'bg-blue-50 text-blue-700 border-blue-200' },
    completed: { label: 'Analizado ✓', icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function getFileName(path: string) {
  return path.split('/').pop() ?? path
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ClientePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const rfc = decodeURIComponent(id)
  const [clienteNombre, setClienteNombre] = useState(searchParams.get('nombre') ?? rfc)

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loadingContratos, setLoadingContratos] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchContratos() }, [id])

  async function fetchContratos() {
    setLoadingContratos(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!company) { setLoadingContratos(false); return }

    const { data } = await supabase
      .from('contracts')
      .select('id, nombre_cliente, storage_path, analysis_status, analysis_result, uploaded_at')
      .eq('company_id', company.id)
      .eq('nombre_cliente', clienteNombre)
      .order('uploaded_at', { ascending: false })

    const parsed = (data as unknown as Contrato[]) ?? []
    setContratos(parsed)
    if (parsed.length > 0) setClienteNombre(parsed[0].nombre_cliente)
    setLoadingContratos(false)
  }

  async function uploadFile(file: File) {
    if (file.type !== 'application/pdf') {
      toast({ title: 'Solo se aceptan archivos PDF', variant: 'destructive' }); return
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'El archivo supera el límite de 50 MB', variant: 'destructive' }); return
    }

    setUploading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!company) {
      toast({ title: 'No se encontró empresa registrada', variant: 'destructive' })
      setUploading(false); return
    }

    // Subir PDF a Storage
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${user.id}/${timestamp}-${safeName}`

    const { error: storageError } = await supabase.storage
      .from('contracts')
      .upload(storagePath, file, { contentType: 'application/pdf' })

    if (storageError) {
      toast({ title: 'Error al subir el archivo', description: storageError.message, variant: 'destructive' })
      setUploading(false); return
    }

    // Crear registro en DB
    const { data: newContract, error: dbError } = await supabase
      .from('contracts')
      .insert({
        company_id: company.id,
        nombre_cliente: clienteNombre,
        storage_path: storagePath,
        analysis_status: 'pending',
      })
      .select('id')
      .single()

    if (dbError || !newContract) {
      toast({ title: 'Archivo subido pero no se pudo registrar', variant: 'destructive' })
      setUploading(false); return
    }

    toast({ title: 'Contrato subido', description: 'Iniciando análisis con Claude...' })
    await fetchContratos()
    setUploading(false)

    // Disparar análisis y mostrar error si falla
    await triggerAnalysis(newContract.id, storagePath)
  }

  async function triggerAnalysis(contractId: string, storagePath: string) {
    await supabase.auth.getUser()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) {
      toast({ title: 'Sesión expirada', description: 'Vuelve a iniciar sesión.', variant: 'destructive' })
      router.push('/')
      return
    }

    setAnalyzing(contractId)
    toast({ title: 'Analizando con Claude...', description: 'Esto puede tardar hasta 2 minutos. No cierres la página.' })

    const { data, error } = await supabase.functions.invoke('analyze-contract', {
      body: { contract_id: contractId, storage_path: storagePath },
      headers: { Authorization: `Bearer ${token}` },
    })

    if (error) {
      let errorDetail = error.message ?? 'Error desconocido'
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = await (error as any).context?.json()
        errorDetail = body?.error ?? errorDetail
      } catch {}
      toast({ title: 'Error al analizar', description: errorDetail, variant: 'destructive' })
      setAnalyzing(null)
      await fetchContratos()
    } else if (data && !data.success) {
      toast({ title: 'Error en el análisis', description: data.error ?? 'Claude no pudo procesar el contrato.', variant: 'destructive' })
      setAnalyzing(null)
      await fetchContratos()
    } else if (data?.success) {
      router.push(`/dashboard/clientes/${id}/contratos/${contractId}`)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  return (
    <div>

      {/* Overlay de análisis */}
      {analyzing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-5">
          <div className="h-14 w-14 rounded-full border-4 border-[#0F2D5E]/10 border-t-[#0F2D5E] animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-base font-semibold text-[#0F172A]">Analizando con Claude...</p>
            <p className="text-sm text-[#64748B]">Leyendo el contrato, un momento</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="text-[#64748B] hover:text-[#0F2D5E] -ml-2"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-xl font-bold text-[#0F2D5E]">
            Accesa<span className="text-[#00C896]">X</span>
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{clienteNombre}</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Contratos y documentos</p>
        </div>

        {/* Zona drag & drop */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#0F172A]">Subir contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && inputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                ${dragOver ? 'border-[#00C896] bg-emerald-50' : 'border-slate-300 hover:border-[#0F2D5E] hover:bg-slate-50'}
                ${uploading ? 'pointer-events-none opacity-60' : ''}
              `}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-[#0F2D5E]" />
                  <p className="text-sm font-medium text-[#0F2D5E]">Subiendo archivo…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <UploadCloud className={`h-10 w-10 ${dragOver ? 'text-[#00C896]' : 'text-slate-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">
                      Arrastra tu PDF aquí o{' '}
                      <span className="text-[#0F2D5E] underline">haz click para seleccionar</span>
                    </p>
                    <p className="text-xs text-[#64748B] mt-1">Solo PDF · Máximo 50 MB</p>
                  </div>
                </div>
              )}
            </div>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
          </CardContent>
        </Card>

        {/* Tabla de contratos */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#0F172A]">Contratos subidos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingContratos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-[#64748B]" />
              </div>
            ) : contratos.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-[#64748B]">Aún no hay contratos subidos</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-[#64748B] pl-6">Archivo</TableHead>
                    <TableHead className="text-xs font-semibold text-[#64748B]">Fecha subida</TableHead>
                    <TableHead className="text-xs font-semibold text-[#64748B]">Estado</TableHead>
                    <TableHead className="text-xs font-semibold text-[#64748B] pr-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratos.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/60">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#64748B] shrink-0" />
                          <span className="text-sm text-[#0F172A] font-medium truncate max-w-xs">
                            {getFileName(c.storage_path)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[#64748B]">{formatDate(c.uploaded_at)}</TableCell>
                      <TableCell><StatusBadge status={c.analysis_status} /></TableCell>
                      <TableCell className="pr-6">
                        {c.analysis_status === 'completed' && c.analysis_result && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/dashboard/clientes/${id}/contratos/${c.id}`)}
                            className="text-[#0F2D5E] hover:bg-[#0F2D5E]/5 font-medium"
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Ver análisis
                          </Button>
                        )}
                        {(c.analysis_status === 'pending' || c.analysis_status === 'error') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => triggerAnalysis(c.id, c.storage_path)}
                            disabled={analyzing === c.id}
                            className="text-amber-600 hover:bg-amber-50 font-medium"
                          >
                            <Loader2 className={`mr-1.5 h-3.5 w-3.5 ${analyzing === c.id ? 'animate-spin' : ''}`} />
                            {analyzing === c.id ? 'Analizando...' : 'Analizar'}
                          </Button>
                        )}
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
