'use client'

import { useRouter } from 'next/navigation'
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
import { useToast } from '@/hooks/use-toast'
import { FileText, Users, DollarSign, CheckCircle2, ChevronRight } from 'lucide-react'

// TODO: Reemplazar con datos reales de Syntage una vez que el API key esté activo
const MOCK_EMPRESA = {
  nombre: 'Empresa Demo SA de CV',
  rfc: 'EDM123456789',
  satConectado: true,
}

// TODO: Reemplazar con datos reales de Syntage (CFDI extractions)
const MOCK_RESUMEN = {
  totalFacturado: 2450000,
  clientesUnicos: 8,
  facturasEmitidas: 34,
}

// TODO: Reemplazar con datos reales de Syntage (clientes por CFDI)
const MOCK_CLIENTES = [
  {
    id: '1',
    nombre: 'Constructora Norteña SA',
    totalFacturado: 980000,
    facturas: 14,
    ultimaFactura: '2024-11-28',
  },
  {
    id: '2',
    nombre: 'Logística del Bajío SC',
    totalFacturado: 740000,
    facturas: 9,
    ultimaFactura: '2024-12-05',
  },
  {
    id: '3',
    nombre: 'Distribuidora Pacífico',
    totalFacturado: 510000,
    facturas: 7,
    ultimaFactura: '2024-12-01',
  },
  {
    id: '4',
    nombre: 'Servicios Industriales MX',
    totalFacturado: 220000,
    facturas: 4,
    ultimaFactura: '2024-10-18',
  },
]

function formatMXN(amount: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-[#0F2D5E]">
            Accesa<span className="text-[#00C896]">X</span>
          </span>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-[#0F172A]">{MOCK_EMPRESA.nombre}</p>
              <p className="text-xs text-[#64748B] font-mono">{MOCK_EMPRESA.rfc}</p>
            </div>
            {MOCK_EMPRESA.satConectado && (
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1.5 px-2.5 py-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                SAT Conectado
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Título + botón CTA */}
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

        {/* Cards de resumen financiero */}
        {/* TODO: Reemplazar MOCK_RESUMEN con datos reales de Syntage CFDI extractions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#64748B]">
                Total facturado
              </CardTitle>
              <DollarSign className="h-4 w-4 text-[#00C896]" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#0F172A]">
                {formatMXN(MOCK_RESUMEN.totalFacturado)}
              </p>
              <p className="text-xs text-[#64748B] mt-1">Últimos 12 meses</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#64748B]">
                Clientes únicos
              </CardTitle>
              <Users className="h-4 w-4 text-[#00C896]" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#0F172A]">
                {MOCK_RESUMEN.clientesUnicos}
              </p>
              <p className="text-xs text-[#64748B] mt-1">Con al menos 1 factura</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#64748B]">
                Facturas emitidas
              </CardTitle>
              <FileText className="h-4 w-4 text-[#00C896]" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#0F172A]">
                {MOCK_RESUMEN.facturasEmitidas}
              </p>
              <p className="text-xs text-[#64748B] mt-1">CFDI vigentes</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de clientes */}
        {/* TODO: Reemplazar MOCK_CLIENTES con datos reales de Syntage CFDI extractions */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#0F172A]">
              Mis Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-[#64748B] pl-6">
                    Cliente
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-[#64748B]">
                    Total facturado
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-[#64748B]">
                    Facturas
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-[#64748B]">
                    Última factura
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-[#64748B] pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_CLIENTES.map((cliente) => (
                  <TableRow key={cliente.id} className="hover:bg-slate-50/60">
                    <TableCell className="font-medium text-[#0F172A] pl-6">
                      {cliente.nombre}
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
                        onClick={() => router.push(`/dashboard/clientes/${cliente.id}`)}
                      >
                        Ver contratos
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
