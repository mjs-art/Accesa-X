'use server'

import { createClient } from '@/lib/supabase/server'
import { getEffectiveCompany } from '@/lib/get-company-context'

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getCompanyContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const company = await getEffectiveCompany(supabase, user.id)
  if (!company) return null
  return { supabase, user, company }
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthKeysFor(n: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function last12MonthKeys(): string[] { return monthKeysFor(12) }

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const d = new Date(parseInt(y), parseInt(m) - 1, 1)
  return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
}

function daysSince(dateStr: string): number {
  const now = new Date()
  const issued = new Date(dateStr)
  return Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
}

export type Periodo = '3m' | '6m' | '12m' | 'ytd' | 'custom'

function periodoToSince(periodo: Periodo, customFrom?: string): Date {
  if (periodo === 'custom' && customFrom) {
    const d = new Date(customFrom)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const now = new Date()
  if (periodo === '3m') return new Date(now.getFullYear(), now.getMonth() - 2, 1)
  if (periodo === '6m') return new Date(now.getFullYear(), now.getMonth() - 5, 1)
  if (periodo === 'ytd') return new Date(now.getFullYear(), 0, 1)
  return new Date(now.getFullYear(), now.getMonth() - 11, 1)
}

function periodoToUntil(periodo: Periodo, customTo?: string): string | null {
  if (periodo === 'custom' && customTo) {
    const d = new Date(customTo)
    d.setDate(d.getDate() + 1) // inclusive end
    return d.toISOString()
  }
  return null
}

function periodoToPrevSince(periodo: Periodo, since: Date, customFrom?: string, customTo?: string): Date {
  if (periodo === 'custom' && customFrom && customTo) {
    const duration = new Date(customTo).getTime() - new Date(customFrom).getTime()
    return new Date(since.getTime() - duration)
  }
  if (periodo === '3m') return new Date(since.getFullYear(), since.getMonth() - 3, 1)
  if (periodo === '6m') return new Date(since.getFullYear(), since.getMonth() - 6, 1)
  if (periodo === 'ytd') return new Date(since.getFullYear() - 1, 0, 1)
  return new Date(since.getFullYear() - 1, since.getMonth(), 1)
}

function monthKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = []
  const cur = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cur <= end) {
    keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return keys
}

function periodoToMonthKeys(periodo: Periodo, customFrom?: string, customTo?: string): string[] {
  if (periodo === 'custom' && customFrom && customTo) {
    return monthKeysBetween(new Date(customFrom), new Date(customTo))
  }
  if (periodo === '3m') return monthKeysFor(3)
  if (periodo === '6m') return monthKeysFor(6)
  if (periodo === 'ytd') {
    const now = new Date()
    return monthKeysFor(now.getMonth() + 1)
  }
  return monthKeysFor(12)
}

// ── Tipos exportados ───────────────────────────────────────────────────────────

export interface MesData { mes: string; label: string; total: number }
export interface TopItem { rfc: string; nombre: string; total: number; count: number }
export interface AgingBucket { label: string; dias: string; total: number; count: number }
export interface FacturaPendiente {
  uuid: string
  contraparte: string
  contraparteRfc: string
  monto: number
  dueAmount: number
  issuedAt: string
  diasVencida: number
}

export interface IngresosData {
  meses: MesData[]
  topClientes: TopItem[]
  totalAnual: number
  totalMesActual: number
  totalPeriodoAnterior: number
  hasSatData: boolean
}

export interface GastosData {
  meses: MesData[]
  topProveedores: TopItem[]
  totalAnual: number
  totalMesActual: number
  totalPeriodoAnterior: number
  hasSatData: boolean
}

export interface CxcData {
  buckets: AgingBucket[]
  facturas: FacturaPendiente[]
  totalPorCobrar: number
  hasSatData: boolean
}

export interface CxpData {
  buckets: AgingBucket[]
  facturas: FacturaPendiente[]
  totalPorPagar: number
  hasSatData: boolean
}

export interface ResumenData {
  ingresosMesActual: number
  gastosMesActual: number
  totalPorCobrar: number
  totalPorPagar: number
  meses: { mes: string; label: string; ingresos: number; gastos: number }[]
  synced: boolean
}

// ── Ingresos ───────────────────────────────────────────────────────────────────

export async function getIngresosAction(
  periodo: Periodo = '12m',
  customFrom?: string,
  customTo?: string
): Promise<IngresosData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const since = periodoToSince(periodo, customFrom)
  const until = periodoToUntil(periodo, customTo)
  const keys = periodoToMonthKeys(periodo, customFrom, customTo)
  const prevSince = periodoToPrevSince(periodo, since, customFrom, customTo)

  let mainQ = supabase.from('sat_cfdis')
    .select('id, cfdi_uuid, total, issued_at, receiver_rfc')
    .eq('company_id', company.id)
    .eq('issuer_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', since.toISOString())
    .order('issued_at', { ascending: false })
  if (until) mainQ = mainQ.lt('issued_at', until)

  let prevQ = supabase.from('sat_cfdis')
    .select('total')
    .eq('company_id', company.id)
    .eq('issuer_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', prevSince.toISOString())
    .lt('issued_at', since.toISOString())

  const [{ count: satCount }, { data: cfdis, error }, { data: prevCfdis }] = await Promise.all([
    supabase.from('sat_cfdis').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    mainQ,
    prevQ,
  ])

  const hasSatData = (satCount ?? 0) > 0
  const totalPeriodoAnterior = ((prevCfdis ?? []) as unknown as Array<{ total: number | null }>)
    .reduce((s, r) => s + (r.total ?? 0), 0)

  if (error) return { error: error.message }

  const rows = (cfdis ?? []) as unknown as Array<{
    id: string; cfdi_uuid: string; total: number | null; issued_at: string; receiver_rfc: string | null
  }>

  if (rows.length === 0) {
    return {
      meses: keys.map((k) => ({ mes: k, label: monthLabel(k), total: 0 })),
      topClientes: [],
      totalAnual: 0,
      totalMesActual: 0,
      totalPeriodoAnterior,
      hasSatData,
    }
  }

  // Fetch receiver names
  const receiverRfcs = Array.from(new Set(rows.map(r => r.receiver_rfc).filter(Boolean))) as string[]
  const { data: taxpayers } = receiverRfcs.length > 0
    ? await supabase.from('sat_taxpayers').select('rfc, razon_social').in('rfc', receiverRfcs)
    : { data: [] }

  const nameByRfc = new Map<string, string>()
  for (const t of (taxpayers ?? []) as unknown as Array<{ rfc: string; razon_social: string | null }>) {
    if (t.razon_social) nameByRfc.set(t.rfc, t.razon_social)
  }

  const byMonth: Record<string, number> = {}
  keys.forEach((k) => (byMonth[k] = 0))

  const byCliente: Record<string, { nombre: string; total: number; count: number }> = {}
  let totalAnual = 0

  for (const r of rows) {
    const mk = monthKey(r.issued_at)
    if (byMonth[mk] !== undefined) byMonth[mk] += r.total ?? 0
    totalAnual += r.total ?? 0

    const rfc = r.receiver_rfc?.toUpperCase() ?? 'DESCONOCIDO'
    const nombre = nameByRfc.get(rfc) ?? rfc
    if (!byCliente[rfc]) byCliente[rfc] = { nombre, total: 0, count: 0 }
    byCliente[rfc].total += r.total ?? 0
    byCliente[rfc].count += 1
  }

  const currentKey = monthKey(new Date().toISOString())
  const totalMesActual = byMonth[currentKey] ?? 0

  const topClientes = Object.entries(byCliente)
    .map(([rfc, v]) => ({ rfc, nombre: v.nombre, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return {
    meses: keys.map((k) => ({ mes: k, label: monthLabel(k), total: byMonth[k] ?? 0 })),
    topClientes,
    totalAnual,
    totalMesActual,
    totalPeriodoAnterior,
    hasSatData,
  }
}

// ── Gastos ─────────────────────────────────────────────────────────────────────

export async function getGastosAction(
  periodo: Periodo = '12m',
  customFrom?: string,
  customTo?: string
): Promise<GastosData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const since = periodoToSince(periodo, customFrom)
  const until = periodoToUntil(periodo, customTo)
  const keys = periodoToMonthKeys(periodo, customFrom, customTo)
  const prevSince = periodoToPrevSince(periodo, since, customFrom, customTo)

  let mainQ = supabase.from('sat_cfdis')
    .select('id, cfdi_uuid, total, issued_at, issuer_rfc')
    .eq('company_id', company.id)
    .eq('receiver_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', since.toISOString())
    .order('issued_at', { ascending: false })
  if (until) mainQ = mainQ.lt('issued_at', until)

  let prevQ = supabase.from('sat_cfdis')
    .select('total')
    .eq('company_id', company.id)
    .eq('receiver_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', prevSince.toISOString())
    .lt('issued_at', since.toISOString())

  const [{ count: satCount }, { data: cfdis, error }, { data: prevCfdis }] = await Promise.all([
    supabase.from('sat_cfdis').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    mainQ,
    prevQ,
  ])

  const hasSatData = (satCount ?? 0) > 0
  const totalPeriodoAnterior = ((prevCfdis ?? []) as unknown as Array<{ total: number | null }>)
    .reduce((s, r) => s + (r.total ?? 0), 0)

  if (error) return { error: error.message }

  const rows = (cfdis ?? []) as unknown as Array<{
    id: string; cfdi_uuid: string; total: number | null; issued_at: string; issuer_rfc: string | null
  }>

  if (rows.length === 0) {
    return {
      meses: keys.map((k) => ({ mes: k, label: monthLabel(k), total: 0 })),
      topProveedores: [],
      totalAnual: 0,
      totalMesActual: 0,
      totalPeriodoAnterior,
      hasSatData,
    }
  }

  // Fetch issuer names
  const issuerRfcs = Array.from(new Set(rows.map(r => r.issuer_rfc).filter(Boolean))) as string[]
  const { data: taxpayers } = issuerRfcs.length > 0
    ? await supabase.from('sat_taxpayers').select('rfc, razon_social').in('rfc', issuerRfcs)
    : { data: [] }

  const nameByRfc = new Map<string, string>()
  for (const t of (taxpayers ?? []) as unknown as Array<{ rfc: string; razon_social: string | null }>) {
    if (t.razon_social) nameByRfc.set(t.rfc, t.razon_social)
  }

  const byMonth: Record<string, number> = {}
  keys.forEach((k) => (byMonth[k] = 0))

  const byProveedor: Record<string, { nombre: string; total: number; count: number }> = {}
  let totalAnual = 0

  for (const r of rows) {
    const mk = monthKey(r.issued_at)
    if (byMonth[mk] !== undefined) byMonth[mk] += r.total ?? 0
    totalAnual += r.total ?? 0

    const rfc = r.issuer_rfc?.toUpperCase() ?? 'DESCONOCIDO'
    const nombre = nameByRfc.get(rfc) ?? rfc
    if (!byProveedor[rfc]) byProveedor[rfc] = { nombre, total: 0, count: 0 }
    byProveedor[rfc].total += r.total ?? 0
    byProveedor[rfc].count += 1
  }

  const currentKey = monthKey(new Date().toISOString())
  const totalMesActual = byMonth[currentKey] ?? 0

  const topProveedores = Object.entries(byProveedor)
    .map(([rfc, v]) => ({ rfc, nombre: v.nombre, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return {
    meses: keys.map((k) => ({ mes: k, label: monthLabel(k), total: byMonth[k] ?? 0 })),
    topProveedores,
    totalAnual,
    totalMesActual,
    totalPeriodoAnterior,
    hasSatData,
  }
}

// ── CxC — Cuentas por cobrar ───────────────────────────────────────────────────

export async function getCxcAction(
  customFrom?: string,
  customTo?: string
): Promise<CxcData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { count: satCount } = await supabase
    .from('sat_cfdis')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
  const hasSatData = (satCount ?? 0) > 0

  let q = supabase.from('sat_cfdis')
    .select('id, cfdi_uuid, total, issued_at, receiver_rfc')
    .eq('company_id', company.id)
    .eq('issuer_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .order('issued_at', { ascending: true })
  if (customFrom) q = q.gte('issued_at', new Date(customFrom).toISOString())
  if (customTo) {
    const d = new Date(customTo); d.setDate(d.getDate() + 1)
    q = q.lt('issued_at', d.toISOString())
  }
  const { data: cfdis, error } = await q

  if (error) return { error: error.message }

  const rows = (cfdis ?? []) as unknown as Array<{
    id: string; cfdi_uuid: string; total: number | null; issued_at: string; receiver_rfc: string | null
  }>

  if (rows.length === 0) return { buckets: calcBuckets([]), facturas: [], totalPorCobrar: 0, hasSatData }

  // Fetch payment states — only care about due_amount > 0
  const cfdiIds = rows.map(r => r.id)
  const { data: paymentStates } = await supabase
    .from('sat_cfdi_payment_state')
    .select('cfdi_id, due_amount')
    .in('cfdi_id', cfdiIds)
    .gt('due_amount', 0)

  const dueById = new Map<string, number>()
  for (const ps of (paymentStates ?? []) as unknown as Array<{ cfdi_id: string; due_amount: number }>) {
    dueById.set(ps.cfdi_id, ps.due_amount)
  }

  // Fetch receiver names
  const receiverRfcs = Array.from(new Set(rows.map(r => r.receiver_rfc).filter(Boolean))) as string[]
  const { data: taxpayers } = receiverRfcs.length > 0
    ? await supabase.from('sat_taxpayers').select('rfc, razon_social').in('rfc', receiverRfcs)
    : { data: [] }

  const nameByRfc = new Map<string, string>()
  for (const t of (taxpayers ?? []) as unknown as Array<{ rfc: string; razon_social: string | null }>) {
    if (t.razon_social) nameByRfc.set(t.rfc, t.razon_social)
  }

  const facturas: FacturaPendiente[] = rows
    .filter(r => dueById.has(r.id))
    .map((r) => {
      const rfc = r.receiver_rfc?.toUpperCase() ?? ''
      return {
        uuid: r.cfdi_uuid,
        contraparte: (nameByRfc.get(rfc) ?? rfc) || '—',
        contraparteRfc: rfc,
        monto: r.total ?? 0,
        dueAmount: dueById.get(r.id) ?? 0,
        issuedAt: r.issued_at,
        diasVencida: daysSince(r.issued_at),
      }
    })

  const buckets = calcBuckets(facturas)
  const totalPorCobrar = facturas.reduce((s, f) => s + f.dueAmount, 0)

  return { buckets, facturas: facturas.sort((a, b) => b.diasVencida - a.diasVencida), totalPorCobrar, hasSatData }
}

// ── CxP — Cuentas por pagar ────────────────────────────────────────────────────

export async function getCxpAction(
  customFrom?: string,
  customTo?: string
): Promise<CxpData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { count: satCount } = await supabase
    .from('sat_cfdis')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
  const hasSatData = (satCount ?? 0) > 0

  let q = supabase.from('sat_cfdis')
    .select('id, cfdi_uuid, total, issued_at, issuer_rfc')
    .eq('company_id', company.id)
    .eq('receiver_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .order('issued_at', { ascending: true })
  if (customFrom) q = q.gte('issued_at', new Date(customFrom).toISOString())
  if (customTo) {
    const d = new Date(customTo); d.setDate(d.getDate() + 1)
    q = q.lt('issued_at', d.toISOString())
  }
  const { data: cfdis, error } = await q

  if (error) return { error: error.message }

  const rows = (cfdis ?? []) as unknown as Array<{
    id: string; cfdi_uuid: string; total: number | null; issued_at: string; issuer_rfc: string | null
  }>

  if (rows.length === 0) return { buckets: calcBuckets([]), facturas: [], totalPorPagar: 0, hasSatData }

  // Fetch payment states — only care about due_amount > 0
  const cfdiIds = rows.map(r => r.id)
  const { data: paymentStates } = await supabase
    .from('sat_cfdi_payment_state')
    .select('cfdi_id, due_amount')
    .in('cfdi_id', cfdiIds)
    .gt('due_amount', 0)

  const dueById = new Map<string, number>()
  for (const ps of (paymentStates ?? []) as unknown as Array<{ cfdi_id: string; due_amount: number }>) {
    dueById.set(ps.cfdi_id, ps.due_amount)
  }

  // Fetch issuer names
  const issuerRfcs = Array.from(new Set(rows.map(r => r.issuer_rfc).filter(Boolean))) as string[]
  const { data: taxpayers } = issuerRfcs.length > 0
    ? await supabase.from('sat_taxpayers').select('rfc, razon_social').in('rfc', issuerRfcs)
    : { data: [] }

  const nameByRfc = new Map<string, string>()
  for (const t of (taxpayers ?? []) as unknown as Array<{ rfc: string; razon_social: string | null }>) {
    if (t.razon_social) nameByRfc.set(t.rfc, t.razon_social)
  }

  const facturas: FacturaPendiente[] = rows
    .filter(r => dueById.has(r.id))
    .map((r) => {
      const rfc = r.issuer_rfc?.toUpperCase() ?? ''
      return {
        uuid: r.cfdi_uuid,
        contraparte: (nameByRfc.get(rfc) ?? rfc) || '—',
        contraparteRfc: rfc,
        monto: r.total ?? 0,
        dueAmount: dueById.get(r.id) ?? 0,
        issuedAt: r.issued_at,
        diasVencida: daysSince(r.issued_at),
      }
    })

  const buckets = calcBuckets(facturas)
  const totalPorPagar = facturas.reduce((s, f) => s + f.dueAmount, 0)

  return { buckets, facturas: facturas.sort((a, b) => b.diasVencida - a.diasVencida), totalPorPagar, hasSatData }
}

// ── Flujo de Caja / Margen ─────────────────────────────────────────────────────

export interface FlujoCajaData {
  meses: {
    mes: string
    label: string
    entradas: number
    salidas: number
    neto: number
    margenPct: number
  }[]
  totalEntradas: number
  totalSalidas: number
  netoTotal: number
  margenPctTotal: number
  mesesNegativos: number
  hasSatData: boolean
}

export async function getFlujoCajaAction(
  periodo: Periodo = '12m',
  customFrom?: string,
  customTo?: string
): Promise<FlujoCajaData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const since = periodoToSince(periodo, customFrom)
  const until = periodoToUntil(periodo, customTo)
  const keys = periodoToMonthKeys(periodo, customFrom, customTo)

  let emitidosQ = supabase.from('sat_cfdis')
    .select('total, issued_at')
    .eq('company_id', company.id)
    .eq('issuer_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', since.toISOString())
  if (until) emitidosQ = emitidosQ.lt('issued_at', until)

  let recibidosQ = supabase.from('sat_cfdis')
    .select('total, issued_at')
    .eq('company_id', company.id)
    .eq('receiver_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', since.toISOString())
  if (until) recibidosQ = recibidosQ.lt('issued_at', until)

  const [{ count: satCount }, emitidosRes, recibidosRes] = await Promise.all([
    supabase.from('sat_cfdis').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    emitidosQ,
    recibidosQ,
  ])

  const hasSatData = (satCount ?? 0) > 0

  const byMonth: Record<string, { entradas: number; salidas: number }> = {}
  keys.forEach((k) => (byMonth[k] = { entradas: 0, salidas: 0 }))

  for (const r of (emitidosRes.data ?? []) as unknown as Array<{ total: number | null; issued_at: string }>) {
    const mk = monthKey(r.issued_at)
    if (byMonth[mk]) byMonth[mk].entradas += r.total ?? 0
  }
  for (const r of (recibidosRes.data ?? []) as unknown as Array<{ total: number | null; issued_at: string }>) {
    const mk = monthKey(r.issued_at)
    if (byMonth[mk]) byMonth[mk].salidas += r.total ?? 0
  }

  let totalEntradas = 0
  let totalSalidas = 0
  let mesesNegativos = 0

  const meses = keys.map((k) => {
    const { entradas, salidas } = byMonth[k]
    const neto = entradas - salidas
    const margenPct = entradas > 0 ? Math.round((neto / entradas) * 100) : 0
    totalEntradas += entradas
    totalSalidas += salidas
    if (neto < 0) mesesNegativos++
    return { mes: k, label: monthLabel(k), entradas, salidas, neto, margenPct }
  })

  const netoTotal = totalEntradas - totalSalidas
  const margenPctTotal = totalEntradas > 0 ? Math.round((netoTotal / totalEntradas) * 100) : 0

  return { meses, totalEntradas, totalSalidas, netoTotal, margenPctTotal, mesesNegativos, hasSatData }
}

// ── Resumen ────────────────────────────────────────────────────────────────────

export async function getResumenAction(): Promise<ResumenData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { count } = await supabase
    .from('sat_cfdis')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)

  if (!count || count === 0) {
    return {
      ingresosMesActual: 0,
      gastosMesActual: 0,
      totalPorCobrar: 0,
      totalPorPagar: 0,
      meses: monthKeysFor(6).map((k) => ({ mes: k, label: monthLabel(k), ingresos: 0, gastos: 0 })),
      synced: false,
    }
  }

  const since = new Date()
  since.setMonth(since.getMonth() - 5)
  since.setDate(1)

  const keys = monthKeysFor(6)

  // Fetch emitidos + recibidos in parallel
  const [emitidosRes, recibidosRes] = await Promise.all([
    supabase.from('sat_cfdis')
      .select('id, total, issued_at')
      .eq('company_id', company.id)
      .eq('issuer_rfc', company.rfc.toUpperCase().trim())
      .eq('cfdi_status', 'vigente')
      .gte('issued_at', since.toISOString()),
    supabase.from('sat_cfdis')
      .select('id, total, issued_at')
      .eq('company_id', company.id)
      .eq('receiver_rfc', company.rfc.toUpperCase().trim())
      .eq('cfdi_status', 'vigente')
      .gte('issued_at', since.toISOString()),
  ])

  const emitidos = (emitidosRes.data ?? []) as unknown as Array<{ id: string; total: number | null; issued_at: string }>
  const recibidos = (recibidosRes.data ?? []) as unknown as Array<{ id: string; total: number | null; issued_at: string }>

  // Fetch payment states for CxC and CxP totals
  const emitidosIds = emitidos.map(r => r.id)
  const recibidosIds = recibidos.map(r => r.id)

  const [cxcRes, cxpRes] = await Promise.all([
    emitidosIds.length > 0
      ? supabase.from('sat_cfdi_payment_state').select('cfdi_id, due_amount').in('cfdi_id', emitidosIds).gt('due_amount', 0)
      : Promise.resolve({ data: [] }),
    recibidosIds.length > 0
      ? supabase.from('sat_cfdi_payment_state').select('cfdi_id, due_amount').in('cfdi_id', recibidosIds).gt('due_amount', 0)
      : Promise.resolve({ data: [] }),
  ])

  const byMonth: Record<string, { ingresos: number; gastos: number }> = {}
  keys.forEach((k) => (byMonth[k] = { ingresos: 0, gastos: 0 }))

  for (const r of emitidos) {
    const mk = monthKey(r.issued_at)
    if (byMonth[mk]) byMonth[mk].ingresos += r.total ?? 0
  }
  for (const r of recibidos) {
    const mk = monthKey(r.issued_at)
    if (byMonth[mk]) byMonth[mk].gastos += r.total ?? 0
  }

  const totalPorCobrar = ((cxcRes.data ?? []) as unknown as Array<{ due_amount: number }>)
    .reduce((s, r) => s + (r.due_amount ?? 0), 0)
  const totalPorPagar = ((cxpRes.data ?? []) as unknown as Array<{ due_amount: number }>)
    .reduce((s, r) => s + (r.due_amount ?? 0), 0)

  const currentKey = monthKey(new Date().toISOString())
  const ingresosMesActual = byMonth[currentKey]?.ingresos ?? 0
  const gastosMesActual = byMonth[currentKey]?.gastos ?? 0

  return {
    ingresosMesActual,
    gastosMesActual,
    totalPorCobrar,
    totalPorPagar,
    meses: keys.map((k) => ({ mes: k, label: monthLabel(k), ...byMonth[k] })),
    synced: true,
  }
}

// ── Análisis de negocio ────────────────────────────────────────────────────────

export interface AnalisisData {
  dso: number
  dpo: number
  dsoStatus: 'verde' | 'amarillo' | 'rojo'
  dpoStatus: 'verde' | 'amarillo' | 'rojo'
  capitalTrabajo: number
  totalPorCobrar: number
  totalPorPagar: number
  concentracionTop: number
  topClienteNombre: string
  concentracionStatus: 'verde' | 'amarillo' | 'rojo'
  ratioGastos: number
  ingresosMes: number
  gastosMes: number
  ratioStatus: 'verde' | 'amarillo' | 'rojo'
  entradas30: number
  entradas60: number
  entradas90: number
  totalIngresos12m: number
  synced: boolean
}

export async function getAnalisisAction(): Promise<AnalisisData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { count } = await supabase
    .from('sat_cfdis')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)

  if (!count || count === 0) {
    return {
      dso: 0, dpo: 0, dsoStatus: 'verde', dpoStatus: 'verde',
      capitalTrabajo: 0, totalPorCobrar: 0, totalPorPagar: 0,
      concentracionTop: 0, topClienteNombre: '—', concentracionStatus: 'verde',
      ratioGastos: 0, ingresosMes: 0, gastosMes: 0, ratioStatus: 'verde',
      entradas30: 0, entradas60: 0, entradas90: 0,
      totalIngresos12m: 0, synced: false,
    }
  }

  const since12m = new Date()
  since12m.setMonth(since12m.getMonth() - 11)
  since12m.setDate(1)

  // Fetch emitidos + recibidos in parallel
  const [emitidosRes, recibidosRes] = await Promise.all([
    supabase.from('sat_cfdis')
      .select('id, total, issued_at, receiver_rfc')
      .eq('company_id', company.id)
      .eq('issuer_rfc', company.rfc.toUpperCase().trim())
      .eq('cfdi_status', 'vigente')
      .gte('issued_at', since12m.toISOString()),
    supabase.from('sat_cfdis')
      .select('id, total, issued_at')
      .eq('company_id', company.id)
      .eq('receiver_rfc', company.rfc.toUpperCase().trim())
      .eq('cfdi_status', 'vigente')
      .gte('issued_at', since12m.toISOString()),
  ])

  const emitidos = (emitidosRes.data ?? []) as unknown as Array<{
    id: string; total: number | null; issued_at: string; receiver_rfc: string | null
  }>
  const recibidos = (recibidosRes.data ?? []) as unknown as Array<{
    id: string; total: number | null; issued_at: string
  }>

  // Fetch receiver names for emitidos
  const receiverRfcs = Array.from(new Set(emitidos.map(r => r.receiver_rfc).filter(Boolean))) as string[]
  const { data: taxpayers } = receiverRfcs.length > 0
    ? await supabase.from('sat_taxpayers').select('rfc, razon_social').in('rfc', receiverRfcs)
    : { data: [] }

  const nameByRfc = new Map<string, string>()
  for (const t of (taxpayers ?? []) as unknown as Array<{ rfc: string; razon_social: string | null }>) {
    if (t.razon_social) nameByRfc.set(t.rfc, t.razon_social)
  }

  // Fetch payment states for all CxC and CxP (no date filter — all pending)
  const [allCxcRes, allCxpRes] = await Promise.all([
    supabase.from('sat_cfdis')
      .select('id, issued_at')
      .eq('company_id', company.id)
      .eq('issuer_rfc', company.rfc.toUpperCase().trim())
      .eq('cfdi_status', 'vigente'),
    supabase.from('sat_cfdis')
      .select('id, issued_at')
      .eq('company_id', company.id)
      .eq('receiver_rfc', company.rfc.toUpperCase().trim())
      .eq('cfdi_status', 'vigente'),
  ])

  const allEmitidosIds = ((allCxcRes.data ?? []) as unknown as Array<{ id: string; issued_at: string }>).map(r => r.id)
  const allRecibidosIds = ((allCxpRes.data ?? []) as unknown as Array<{ id: string; issued_at: string }>).map(r => r.id)
  const allEmitidosIssuedAt = new Map<string, string>(
    ((allCxcRes.data ?? []) as unknown as Array<{ id: string; issued_at: string }>).map(r => [r.id, r.issued_at])
  )

  const [cxcPsRes, cxpPsRes] = await Promise.all([
    allEmitidosIds.length > 0
      ? supabase.from('sat_cfdi_payment_state').select('cfdi_id, due_amount').in('cfdi_id', allEmitidosIds).gt('due_amount', 0)
      : Promise.resolve({ data: [] }),
    allRecibidosIds.length > 0
      ? supabase.from('sat_cfdi_payment_state').select('cfdi_id, due_amount').in('cfdi_id', allRecibidosIds).gt('due_amount', 0)
      : Promise.resolve({ data: [] }),
  ])

  const cxcRows = (cxcPsRes.data ?? []) as unknown as Array<{ cfdi_id: string; due_amount: number }>
  const cxpRows = (cxpPsRes.data ?? []) as unknown as Array<{ cfdi_id: string; due_amount: number }>

  const now = new Date()
  const cutoff90 = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const currentKey = monthKey(now.toISOString())

  let totalIngresos12m = 0
  let ingresos90 = 0
  let ingresosMes = 0
  const byCliente: Record<string, { nombre: string; total: number }> = {}

  for (const r of emitidos) {
    const t = r.total ?? 0
    totalIngresos12m += t
    if (new Date(r.issued_at) >= cutoff90) ingresos90 += t
    if (monthKey(r.issued_at) === currentKey) ingresosMes += t
    const rfc = r.receiver_rfc?.toUpperCase() ?? 'DESCONOCIDO'
    if (!byCliente[rfc]) byCliente[rfc] = { nombre: nameByRfc.get(rfc) ?? rfc, total: 0 }
    byCliente[rfc].total += t
  }

  let gastos90 = 0
  let gastosMes = 0
  for (const r of recibidos) {
    const t = r.total ?? 0
    if (new Date(r.issued_at) >= cutoff90) gastos90 += t
    if (monthKey(r.issued_at) === currentKey) gastosMes += t
  }

  const totalPorCobrar = cxcRows.reduce((s, r) => s + (r.due_amount ?? 0), 0)
  const totalPorPagar = cxpRows.reduce((s, r) => s + (r.due_amount ?? 0), 0)

  const entradas30 = cxcRows
    .filter(r => daysSince(allEmitidosIssuedAt.get(r.cfdi_id) ?? '') <= 30)
    .reduce((s, r) => s + (r.due_amount ?? 0), 0)
  const entradas60 = cxcRows
    .filter(r => daysSince(allEmitidosIssuedAt.get(r.cfdi_id) ?? '') <= 60)
    .reduce((s, r) => s + (r.due_amount ?? 0), 0)
  const entradas90 = cxcRows
    .filter(r => daysSince(allEmitidosIssuedAt.get(r.cfdi_id) ?? '') <= 90)
    .reduce((s, r) => s + (r.due_amount ?? 0), 0)

  const dso = ingresos90 > 0 ? Math.round((totalPorCobrar / ingresos90) * 90) : 0
  const dpo = gastos90 > 0 ? Math.round((totalPorPagar / gastos90) * 90) : 0

  const topCliente = Object.entries(byCliente).sort((a, b) => b[1].total - a[1].total)[0]
  const concentracionTop = totalIngresos12m > 0 && topCliente
    ? Math.round((topCliente[1].total / totalIngresos12m) * 100) : 0
  const topClienteNombre = topCliente?.[1].nombre ?? '—'

  const ratioRaw = ingresosMes > 0 ? gastosMes / ingresosMes : 0

  return {
    dso, dpo,
    dsoStatus: dso <= 30 ? 'verde' : dso <= 60 ? 'amarillo' : 'rojo',
    dpoStatus: dpo <= 45 ? 'verde' : dpo <= 75 ? 'amarillo' : 'rojo',
    capitalTrabajo: totalPorCobrar - totalPorPagar,
    totalPorCobrar, totalPorPagar,
    concentracionTop, topClienteNombre,
    concentracionStatus: concentracionTop < 30 ? 'verde' : concentracionTop < 50 ? 'amarillo' : 'rojo',
    ratioGastos: Math.round(ratioRaw * 100),
    ingresosMes, gastosMes,
    ratioStatus: ratioRaw < 0.7 ? 'verde' : ratioRaw < 0.9 ? 'amarillo' : 'rojo',
    entradas30, entradas60, entradas90,
    totalIngresos12m, synced: true,
  }
}

// ── Util: calcular aging buckets ───────────────────────────────────────────────

function calcBuckets(facturas: FacturaPendiente[]): AgingBucket[] {
  const defs = [
    { label: 'Corriente', dias: '0–30 días', min: 0, max: 30 },
    { label: 'Vencida',   dias: '31–60 días', min: 31, max: 60 },
    { label: 'Atrasada',  dias: '61–90 días', min: 61, max: 90 },
    { label: 'Crítica',   dias: '90+ días',   min: 91, max: Infinity },
  ]
  return defs.map(({ label, dias, min, max }) => {
    const match = facturas.filter((f) => f.diasVencida >= min && f.diasVencida <= max)
    return {
      label,
      dias,
      total: match.reduce((s, f) => s + f.dueAmount, 0),
      count: match.length,
    }
  })
}
