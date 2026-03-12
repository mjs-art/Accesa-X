'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SyncJob, SyncPhase } from '@/features/inteligencia/types/inteligencia.types'
import { SYNC_PHASE_INFO } from '@/features/inteligencia/types/inteligencia.types'
import { triggerSyncAction } from '@/app/actions/sync'

interface Props {
  initialJob: SyncJob
  onCompleted?: () => void
  className?: string
}

export function SyncProgress({ initialJob, onCompleted, className }: Props) {
  const [job, setJob] = useState<SyncJob>(initialJob)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    // No suscribir si ya está en estado final
    if (initialJob.status === 'completed' || initialJob.status === 'failed') return

    const supabase = createClient()

    const channel = supabase
      .channel(`sync-job-${initialJob.id}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'sat_sync_jobs',
          filter: `id=eq.${initialJob.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          setJob((prev) => ({
            ...prev,
            status:        row.status        as SyncJob['status'],
            phase:         row.phase         as SyncPhase,
            progressPct:   (row.progress_pct  as number) ?? prev.progressPct,
            cfdisFetched:  (row.cfdis_fetched  as number) ?? prev.cfdisFetched,
            cfdisUpserted: (row.cfdis_upserted as number) ?? prev.cfdisUpserted,
            completedAt:   row.completed_at  as string | null,
            failedAt:      row.failed_at     as string | null,
            errorMessage:  row.error_message as string | null,
          }))

          if (row.status === 'completed') {
            onCompleted?.()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initialJob.id, initialJob.status, onCompleted])

  const isCompleted = job.status === 'completed'
  const isFailed    = job.status === 'failed'
  const isActive    = job.status === 'queued' || job.status === 'running'
  const phaseInfo   = SYNC_PHASE_INFO[job.phase]

  async function handleRetry() {
    setRetrying(true)
    await triggerSyncAction()
    setRetrying(false)
  }

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-5 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn(
            'text-sm font-semibold',
            isCompleted ? 'text-emerald-700' :
            isFailed    ? 'text-red-700'     :
            'text-[#1A1A1A]',
          )}>
            {isCompleted
              ? 'Datos del SAT sincronizados'
              : isFailed
              ? 'Error en la sincronización'
              : 'Sincronizando datos del SAT...'}
          </p>
          <p className="text-xs text-[#6B7280] mt-0.5 truncate">
            {phaseInfo.description}
          </p>
        </div>

        <div className="shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : isFailed ? (
            <AlertCircle className="h-5 w-5 text-red-500" />
          ) : (
            <Loader2 className="h-5 w-5 text-[#3CBEDB] animate-spin" />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              isCompleted ? 'bg-emerald-400' :
              isFailed    ? 'bg-red-400'     :
              'bg-[#3CBEDB]',
            )}
            style={{ width: `${job.progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">{phaseInfo.label}</span>
          <span className="text-xs font-medium text-[#1A1A1A]">{job.progressPct}%</span>
        </div>
      </div>

      {/* Contador de CFDIs */}
      {(job.cfdisUpserted > 0 || job.cfdisFetched > 0) && (
        <div className="flex items-center gap-4 text-xs text-[#6B7280]">
          {job.cfdisFetched > 0 && (
            <span>{job.cfdisFetched.toLocaleString('es-MX')} facturas descargadas</span>
          )}
          {job.cfdisUpserted > 0 && (
            <span>{job.cfdisUpserted.toLocaleString('es-MX')} guardadas</span>
          )}
        </div>
      )}

      {/* Mensaje de puede cerrar el tab */}
      {isActive && (
        <p className="text-xs text-[#6B7280] bg-slate-50 rounded-lg px-3 py-2">
          Puedes navegar libremente — la sincronización continúa en segundo plano.
        </p>
      )}

      {/* Error con opción de reintentar */}
      {isFailed && (
        <div className="space-y-3">
          {job.errorMessage && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {job.errorMessage}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full border-[#3CBEDB] text-[#1A1A1A] hover:bg-[#3CBEDB]/5"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Reintentar sincronización
          </Button>
        </div>
      )}
    </div>
  )
}
