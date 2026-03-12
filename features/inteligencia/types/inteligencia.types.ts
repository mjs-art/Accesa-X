// Dominio: tipos de sincronización SAT/Syntage
// Sin imports externos — solo definiciones de dominio

export type SyncPhase =
  | 'queued'
  | 'credential_check'
  | 'entity_resolution'
  | 'trigger_extractions'
  | 'fetch_cfdis_emitidos'
  | 'fetch_cfdis_recibidos'
  | 'upsert_cfdis'
  | 'fetch_annual_returns'
  | 'completed'

export type SyncStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface SyncJob {
  id:            string
  companyId:     string
  status:        SyncStatus
  phase:         SyncPhase
  progressPct:   number
  cfdisFetched:  number
  cfdisUpserted: number
  startedAt:     string | null
  completedAt:   string | null
  failedAt:      string | null
  errorMessage:  string | null
  createdAt:     string
}

export interface SyncPhaseInfo {
  label:       string
  description: string
}

export const SYNC_PHASE_INFO: Record<SyncPhase, SyncPhaseInfo> = {
  queued: {
    label:       'En cola',
    description: 'Esperando inicio...',
  },
  credential_check: {
    label:       'Verificando CIEC',
    description: 'Confirmando credenciales con el SAT',
  },
  entity_resolution: {
    label:       'Identificando empresa',
    description: 'Resolviendo entidad fiscal en Syntage',
  },
  trigger_extractions: {
    label:       'Iniciando extracción',
    description: 'Solicitando datos al SAT via Syntage',
  },
  fetch_cfdis_emitidos: {
    label:       'Facturas emitidas',
    description: 'Descargando CFDIs que emitiste',
  },
  fetch_cfdis_recibidos: {
    label:       'Facturas recibidas',
    description: 'Descargando CFDIs que recibiste',
  },
  upsert_cfdis: {
    label:       'Guardando facturas',
    description: 'Almacenando en base de datos segura',
  },
  fetch_annual_returns: {
    label:       'Declaraciones anuales',
    description: 'Descargando declaraciones fiscales',
  },
  completed: {
    label:       'Sincronización completa',
    description: 'Todos los datos están disponibles',
  },
}
