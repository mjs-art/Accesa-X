'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getSyncStatusAction } from '@/app/actions/sync'
import type { SyncJob } from '@/features/inteligencia/types/inteligencia.types'
import { SYNC_PHASE_INFO } from '@/features/inteligencia/types/inteligencia.types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  // Si true, muestra el banner incluso cuando la sync está completada (primera vez)
  showWhenEmpty?: boolean
}

// Banner compacto que aparece en las sub-páginas de inteligencia cuando la sync
// está en progreso o no se ha realizado aún. No muestra nada cuando hay datos.
export function SyncBanner({ showWhenEmpty = true }: Props) {
  const [job, setJob]     = useState<SyncJob | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getSyncStatusAction().then((res) => {
      if ('id' in res) setJob(res)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return

    const supabase = createClient()
    const channel  = supabase
      .channel(`sync-banner-${job.id}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'sat_sync_jobs',
          filter: `id=eq.${job.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          setJob((prev) => prev ? {
            ...prev,
            status:      row.status as SyncJob['status'],
            phase:       row.phase  as SyncJob['phase'],
            progressPct: row.progress_pct as number,
          } : null)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [job?.id, job?.status])

  if (!loaded) return null

  // Sin job: mostrar CTA para conectar SAT
  if (!job && showWhenEmpty) {
    return (
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">
        <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
        <p className="text-[#6B7280]">
          Sin datos fiscales.{' '}
          <Link href="/onboarding/verificacion-fiscal" className="text-[#3CBEDB] hover:underline font-medium">
            Conecta tu empresa con el SAT
          </Link>{' '}
          para ver esta información.
        </p>
      </div>
    )
  }

  if (!job) return null

  // Job activo: mostrar progreso compacto
  if (job.status === 'queued' || job.status === 'running') {
    const phaseInfo = SYNC_PHASE_INFO[job.phase]
    return (
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-[#3CBEDB] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-blue-800 font-medium">{phaseInfo.label} — {job.progressPct}%</p>
          <p className="text-xs text-blue-600 mt-0.5">{phaseInfo.description}</p>
        </div>
        <div className="w-20 h-1.5 bg-blue-100 rounded-full overflow-hidden shrink-0">
          <div
            className="h-full bg-[#3CBEDB] rounded-full transition-all duration-700"
            style={{ width: `${job.progressPct}%` }}
          />
        </div>
      </div>
    )
  }

  // Job fallido: mostrar error
  if (job.status === 'failed') {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
        <p className="text-sm text-red-700">
          La sincronización falló: {job.errorMessage ?? 'Error desconocido'}.{' '}
          <Link href="/dashboard/inteligencia" className="underline">Reintentar</Link>
        </p>
      </div>
    )
  }

  // Job completado: no mostrar nada (datos ya disponibles)
  return null
}
