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
  return { supabase, user, company }
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function last12MonthKeys(): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

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
}

export interface GastosData {
  meses: MesData[]
  topProveedores: TopItem[]
  totalAnual: number
  totalMesActual: number
}

export interface CxcData {
  buckets: AgingBucket[]
  facturas: FacturaPendiente[]
  totalPorCobrar: number
}

export interface CxpData {
  buckets: AgingBucket[]
  facturas: FacturaPendiente[]
  totalPorPagar: number
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

export async function getIngresosAction(): Promise<IngresosData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const since = new Date()
  since.setMonth(since.getMonth() - 11)
  since.setDate(1)

  const { data: rows, error } = await supabase
    .from('cfdis')
    .select('cfdi_uuid, total, issued_at, receiver_rfc, receiver_name')
    .eq('company_id', company.id)
    .eq('issuer_rfc', company.rfc)
    .eq('cfdi_type', 'I')
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', since.toISOString())
    .order('issued_at', { ascending: false })

  if (error) return { error: error.message }
  if (!rows || rows.length === 0) {
    const keys = last12MonthKeys()
    return {
      meses: keys.map((k) => ({ mes: k, label: monthLabel(k), total: 0 })),
      topClientes: [],
      totalAnual: 0,
      totalMesActual: 0,
    }
  }

  const keys = last12MonthKeys()
  const byMonth: Record<string, number> = {}
  keys.forEach((k) => (byMonth[k] = 0))

  const byCliente: Record<string, { nombre: string; total: number; count: number }> = {}
  let totalAnual = 0

  for (const r of rows) {
    const mk = monthKey(r.issued_at)
    if (byMonth[mk] !== undefined) byMonth[mk] += r.total ?? 0
    totalAnual += r.total ?? 0

    const rfc = r.receiver_rfc?.toUpperCase() ?? 'DESCONOCIDO'
    if (!byCliente[rfc]) byCliente[rfc] = { nombre: r.receiver_name ?? rfc, total: 0, count: 0 }
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
  }
}

// ── Gastos ─────────────────────────────────────────────────────────────────────

export async function getGastosAction(): Promise<GastosData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const since = new Date()
  since.setMonth(since.getMonth() - 11)
  since.setDate(1)

  const { data: rows, error } = await supabase
    .from('cfdis')
    .select('cfdi_uuid, total, issued_at, issuer_rfc, issuer_name')
    .eq('company_id', company.id)
    .eq('receiver_rfc', company.rfc)
    .eq('cfdi_type', 'I')
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', since.toISOString())
    .order('issued_at', { ascending: false })

  if (error) return { error: error.message }
  if (!rows || rows.length === 0) {
    const keys = last12MonthKeys()
    return {
      meses: keys.map((k) => ({ mes: k, label: monthLabel(k), total: 0 })),
      topProveedores: [],
      totalAnual: 0,
      totalMesActual: 0,
    }
  }

  const keys = last12MonthKeys()
  const byMonth: Record<string, number> = {}
  keys.forEach((k) => (byMonth[k] = 0))

  const byProveedor: Record<string, { nombre: string; total: number; count: number }> = {}
  let totalAnual = 0

  for (const r of rows) {
    const mk = monthKey(r.issued_at)
    if (byMonth[mk] !== undefined) byMonth[mk] += r.total ?? 0
    totalAnual += r.total ?? 0

    const rfc = r.issuer_rfc?.toUpperCase() ?? 'DESCONOCIDO'
    if (!byProveedor[rfc]) byProveedor[rfc] = { nombre: r.issuer_name ?? rfc, total: 0, count: 0 }
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
  }
}

// ── CxC — Cuentas por cobrar ───────────────────────────────────────────────────

export async function getCxcAction(): Promise<CxcData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { data: rows, error } = await supabase
    .from('cfdis')
    .select('cfdi_uuid, total, due_amount, issued_at, receiver_rfc, receiver_name')
    .eq('company_id', company.id)
    .eq('issuer_rfc', company.rfc)
    .eq('cfdi_type', 'I')
    .eq('cfdi_status', 'vigente')
    .gt('due_amount', 0)
    .order('issued_at', { ascending: true })

  if (error) return { error: error.message }

  const facturas: FacturaPendiente[] = (rows ?? []).map((r) => ({
    uuid: r.cfdi_uuid,
    contraparte: r.receiver_name ?? r.receiver_rfc ?? '—',
    contraparteRfc: r.receiver_rfc ?? '',
    monto: r.total ?? 0,
    dueAmount: r.due_amount ?? 0,
    issuedAt: r.issued_at,
    diasVencida: daysSince(r.issued_at),
  }))

  const buckets = calcBuckets(facturas)
  const totalPorCobrar = facturas.reduce((s, f) => s + f.dueAmount, 0)

  return { buckets, facturas: facturas.sort((a, b) => b.diasVencida - a.diasVencida), totalPorCobrar }
}

// ── CxP — Cuentas por pagar ────────────────────────────────────────────────────

export async function getCxpAction(): Promise<CxpData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  const { data: rows, error } = await supabase
    .from('cfdis')
    .select('cfdi_uuid, total, due_amount, issued_at, issuer_rfc, issuer_name')
    .eq('company_id', company.id)
    .eq('receiver_rfc', company.rfc)
    .eq('cfdi_type', 'I')
    .eq('cfdi_status', 'vigente')
    .gt('due_amount', 0)
    .order('issued_at', { ascending: true })

  if (error) return { error: error.message }

  const facturas: FacturaPendiente[] = (rows ?? []).map((r) => ({
    uuid: r.cfdi_uuid,
    contraparte: r.issuer_name ?? r.issuer_rfc ?? '—',
    contraparteRfc: r.issuer_rfc ?? '',
    monto: r.total ?? 0,
    dueAmount: r.due_amount ?? 0,
    issuedAt: r.issued_at,
    diasVencida: daysSince(r.issued_at),
  }))

  const buckets = calcBuckets(facturas)
  const totalPorPagar = facturas.reduce((s, f) => s + f.dueAmount, 0)

  return { buckets, facturas: facturas.sort((a, b) => b.diasVencida - a.diasVencida), totalPorPagar }
}

// ── Resumen ────────────────────────────────────────────────────────────────────

export async function getResumenAction(): Promise<ResumenData | { error: string }> {
  const ctx = await getCompanyContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, company } = ctx

  // Verificar si hay CFDIs sincronizados
  const { count } = await supabase
    .from('cfdis')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)

  if (!count || count === 0) {
    return {
      ingresosMesActual: 0,
      gastosMesActual: 0,
      totalPorCobrar: 0,
      totalPorPagar: 0,
      meses: last12MonthKeys().map((k) => ({ mes: k, label: monthLabel(k), ingresos: 0, gastos: 0 })),
      synced: false,
    }
  }

  const since = new Date()
  since.setMonth(since.getMonth() - 5)
  since.setDate(1)

  const { data: rows } = await supabase
    .from('cfdis')
    .select('total, due_amount, issued_at, issuer_rfc, receiver_rfc, cfdi_type, cfdi_status')
    .eq('company_id', company.id)
    .eq('cfdi_type', 'I')
    .eq('cfdi_status', 'vigente')
    .gte('issued_at', since.toISOString())

  const keys = (() => {
    const ks: string[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      ks.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return ks
  })()

  const byMonth: Record<string, { ingresos: number; gastos: number }> = {}
  keys.forEach((k) => (byMonth[k] = { ingresos: 0, gastos: 0 }))

  let totalPorCobrar = 0
  let totalPorPagar = 0

  for (const r of rows ?? []) {
    const mk = monthKey(r.issued_at)
    const isEmitido = r.issuer_rfc?.toUpperCase() === company.rfc.toUpperCase()
    const isRecibido = r.receiver_rfc?.toUpperCase() === company.rfc.toUpperCase()

    if (byMonth[mk]) {
      if (isEmitido) byMonth[mk].ingresos += r.total ?? 0
      if (isRecibido) byMonth[mk].gastos += r.total ?? 0
    }

    if (isEmitido && (r.due_amount ?? 0) > 0) totalPorCobrar += r.due_amount ?? 0
    if (isRecibido && (r.due_amount ?? 0) > 0) totalPorPagar += r.due_amount ?? 0
  }

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
    .from('cfdis')
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

  const [emitidosRes, recibidosRes, cxcRes, cxpRes] = await Promise.all([
    supabase.from('cfdis')
      .select('total, issued_at, receiver_rfc, receiver_name')
      .eq('company_id', company.id).eq('issuer_rfc', company.rfc)
      .eq('cfdi_type', 'I').eq('cfdi_status', 'vigente')
      .gte('issued_at', since12m.toISOString()),
    supabase.from('cfdis')
      .select('total, issued_at')
      .eq('company_id', company.id).eq('receiver_rfc', company.rfc)
      .eq('cfdi_type', 'I').eq('cfdi_status', 'vigente')
      .gte('issued_at', since12m.toISOString()),
    supabase.from('cfdis')
      .select('due_amount, issued_at')
      .eq('company_id', company.id).eq('issuer_rfc', company.rfc)
      .eq('cfdi_type', 'I').eq('cfdi_status', 'vigente').gt('due_amount', 0),
    supabase.from('cfdis')
      .select('due_amount, issued_at')
      .eq('company_id', company.id).eq('receiver_rfc', company.rfc)
      .eq('cfdi_type', 'I').eq('cfdi_status', 'vigente').gt('due_amount', 0),
  ])

  const emitidos = emitidosRes.data ?? []
  const recibidos = recibidosRes.data ?? []
  const cxcRows = cxcRes.data ?? []
  const cxpRows = cxpRes.data ?? []

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
    if (!byCliente[rfc]) byCliente[rfc] = { nombre: r.receiver_name ?? rfc, total: 0 }
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

  const entradas30 = cxcRows.filter(r => daysSince(r.issued_at) <= 30).reduce((s, r) => s + (r.due_amount ?? 0), 0)
  const entradas60 = cxcRows.filter(r => daysSince(r.issued_at) <= 60).reduce((s, r) => s + (r.due_amount ?? 0), 0)
  const entradas90 = cxcRows.filter(r => daysSince(r.issued_at) <= 90).reduce((s, r) => s + (r.due_amount ?? 0), 0)

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
