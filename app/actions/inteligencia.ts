'use server'

import { createClient } from '@/lib/supabase/server'

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getCompanyContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: company } = await supabase
    .from('companies')
    .select('id, rfc')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!company) return null
  return { supabase, user, company: company as unknown as { id: string; rfc: string } }
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

export type Periodo = '3m' | '6m' | '12m' | 'ytd'

function periodoToSince(periodo: Periodo): Date {
  const now = new Date()
  if (periodo === '3m') {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    return d
  }
  if (periodo === '6m') {
    const d = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    return d
  }
  if (periodo === 'ytd') {
    return new Date(now.getFullYear(), 0, 1)
  }
  // '12m' default
  const d = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  return d
}

function periodoToMonthKeys(periodo: Periodo): string[] {
  if (periodo === '3m') return monthKeysFor(3)
  if (periodo === '6m') return monthKeysFor(6)
  if (periodo === 'ytd') {
    const now = new Date()
    const count = now.getMonth() + 1 // months elapsed this year
    return monthKeysFor(count)
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
  hasSatData: boolean
}

export interface GastosData {
  meses: MesData[]
  topProveedores: TopItem[]
  totalAnual: number
  totalMesActual: number
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

export async function getIngresosAction(periodo: Periodo = '12m'): Promise<IngresosData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const since = periodoToSince(periodo)
  const keys = periodoToMonthKeys(periodo)

  const { count: satCount } = await supabase
    .from('sat_cfdis')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
  const hasSatData = (satCount ?? 0) > 0

  const { data: cfdis, error } = await supabase
    .from('sat_cfdis')
    .select('id, cfdi_uuid, total, issued_at, receiver_rfc')
    .eq('company_id', company.id)
    .eq('issuer_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', since.toISOString())
    .order('issued_at', { ascending: false })

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
    hasSatData,
  }
}

// ── Gastos ─────────────────────────────────────────────────────────────────────

export async function getGastosAction(periodo: Periodo = '12m'): Promise<GastosData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const since = periodoToSince(periodo)
  const keys = periodoToMonthKeys(periodo)

  const { count: satCount } = await supabase
    .from('sat_cfdis')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
  const hasSatData = (satCount ?? 0) > 0

  const { data: cfdis, error } = await supabase
    .from('sat_cfdis')
    .select('id, cfdi_uuid, total, issued_at, issuer_rfc')
    .eq('company_id', company.id)
    .eq('receiver_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', since.toISOString())
    .order('issued_at', { ascending: false })

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
    hasSatData,
  }
}

// ── CxC — Cuentas por cobrar ───────────────────────────────────────────────────

export async function getCxcAction(): Promise<CxcData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { count: satCount } = await supabase
    .from('sat_cfdis')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
  const hasSatData = (satCount ?? 0) > 0

  const { data: cfdis, error } = await supabase
    .from('sat_cfdis')
    .select('id, cfdi_uuid, total, issued_at, receiver_rfc')
    .eq('company_id', company.id)
    .eq('issuer_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .order('issued_at', { ascending: true })

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

export async function getCxpAction(): Promise<CxpData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { count: satCount } = await supabase
    .from('sat_cfdis')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
  const hasSatData = (satCount ?? 0) > 0

  const { data: cfdis, error } = await supabase
    .from('sat_cfdis')
    .select('id, cfdi_uuid, total, issued_at, issuer_rfc')
    .eq('company_id', company.id)
    .eq('receiver_rfc', company.rfc.toUpperCase().trim())
    .eq('cfdi_status', 'vigente')
    .order('issued_at', { ascending: true })

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
