'use server'

import { createClient } from '@/lib/supabase/server'

export interface SyncResult {
  synced: number
  emitidos?: number
  recibidos?: number
  message: string
}

/**
 * Dispara la sincronización de CFDIs desde Syntage hacia la tabla cfdis.
 * Se llama en segundo plano al visitar Clientes o Proveedores.
 * Es idempotente — corre sin problema aunque ya existan los CFDIs.
 */
export async function syncCfdisAction(): Promise<SyncResult | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase.functions.invoke('sync-cfdis')
  if (error) return { error: error.message ?? 'Error en sincronización' }
  if (!data) return { error: 'Sin respuesta' }
  return data as SyncResult
}
