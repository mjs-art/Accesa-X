'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getResumenAction } from '@/app/actions/inteligencia'
import type { ResumenData } from '@/app/actions/inteligencia'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Loader2, TrendingUp, TrendingDown, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { syncCfdisAction as triggerSync } from '@/app/actions/sync-cfdis'

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

export default function InteligenciaResumenPage() {
  const router = useRouter()
  const [data, setData] = useState<ResumenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await getResumenAction()
    if (!('error' in res)) setData(res)
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    await triggerSync()
    await load()
    setSyncing(false)
  }

  const kpis = [
    { label: 'Ingresos este mes', value: data ? fmtFull(data.ingresosMesActual) : '—', icon: <TrendingUp className="h-4 w-4 text-emerald-500" />, color: 'text-emerald-600', href: '/dashboard/inteligencia/ingresos' },
    { label: 'Gastos este mes', value: data ? fmtFull(data.gastosMesActual) : '—', icon: <TrendingDown className="h-4 w-4 text-[#6B7280]" />, color: 'text-[#1A1A1A]', href: '/dashboard/inteligencia/gastos' },
    { label: 'Por cobrar', value: data ? fmtFull(data.totalPorCobrar) : '—', icon: <Clock className="h-4 w-4 text-[#3CBEDB]" />, color: 'text-[#3CBEDB]', href: '/dashboard/inteligencia/cxc' },
    { label: 'Por pagar', value: data ? fmtFull(data.totalPorPagar) : '—', icon: <AlertCircle className="h-4 w-4 text-amber-500" />, color: data?.totalPorPagar ? 'text-amber-600' : 'text-[#1A1A1A]', href: '/dashboard/inteligencia/cxp' },
  ]

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A1A1A]">Inteligencia — Resumen</span>
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#1A1A1A] transition-colors disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar SAT'}
        </button>
      </header>

      <div className="px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Resumen financiero</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Datos del SAT · últimos 6 meses</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[#3CBEDB]" />
          </div>
        ) : !data?.synced ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <RefreshCw className="h-10 w-10 text-slate-300 mb-4" />
            <p className="text-sm font-medium text-[#1A1A1A]">Sin datos sincronizados</p>
            <p className="text-xs text-[#6B7280] mt-1 max-w-xs">
              Conecta Syntage y presiona "Sincronizar SAT" para ver tu información financiera.
            </p>
            <button onClick={handleSync} disabled={syncing}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-[#3CBEDB] rounded-lg hover:bg-[#3CBEDB]/90 disabled:opacity-50">
              {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((k) => (
                <button key={k.label} onClick={() => router.push(k.href)}
                  className="bg-white rounded-xl border border-slate-200 px-5 py-4 text-left hover:border-[#3CBEDB]/40 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-[#6B7280] font-medium">{k.label}</p>
                    {k.icon}
                  </div>
                  <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-5">Ingresos vs Gastos — últimos 6 meses</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.meses} barGap={4} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v) => fmtFull(v as number)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#3CBEDB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastos" name="Gastos" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { href: '/dashboard/inteligencia/cxc', label: 'Ver aging de cuentas por cobrar →', color: 'text-[#3CBEDB]' },
                { href: '/dashboard/inteligencia/cxp', label: 'Ver cuentas por pagar →', color: 'text-amber-600' },
              ].map((l) => (
                <button key={l.href} onClick={() => router.push(l.href)}
                  className="bg-white rounded-xl border border-slate-200 px-5 py-4 text-left hover:border-slate-300 transition-colors">
                  <p className={`text-sm font-medium ${l.color}`}>{l.label}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
