import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SYNTAGE_API_KEY = Deno.env.get('SYNTAGE_API_KEY')!
const SYNTAGE_BASE_URL = Deno.env.get('SYNTAGE_BASE_URL')!

interface SyntageInvoice {
  id: string
  type: string
  status: string
  total: number
  subtotal: number
  paidAmount?: number
  dueAmount?: number
  fullyPaidAt?: string | null
  issuedAt: string
  issuer: { rfc: string; name: string }
  receiver: { rfc: string; name: string }
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    console.log('get-bi-data: request received', req.method)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('get-bi-data: no auth header')
      return jsonError('Unauthorized', 401)
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      console.error('get-bi-data: auth failed', userError?.message)
      return jsonError('Unauthorized', 401)
    }
    console.log('get-bi-data: user authenticated', user.id)

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc, syntage_validated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) {
      console.error('get-bi-data: company not found', companyError?.message)
      return jsonError('Empresa no encontrada', 404)
    }
    console.log('get-bi-data: company found', company.rfc)

    const baseParams = { type: 'I', status: 'VIGENTE', itemsPerPage: '1000', 'order[issuedAt]': 'desc' }
    const invoicesBase = `${SYNTAGE_BASE_URL}/taxpayers/${encodeURIComponent(company.rfc)}/invoices`

    const [emisorRes, receptorRes] = await Promise.all([
      fetch(buildUrl(invoicesBase, { ...baseParams, isIssuer: 'true' }), { headers: { 'X-API-Key': SYNTAGE_API_KEY } }),
      fetch(buildUrl(invoicesBase, { ...baseParams, isReceiver: 'true' }), { headers: { 'X-API-Key': SYNTAGE_API_KEY } }),
    ])

    const [emisorData, receptorData] = await Promise.all([
      emisorRes.ok ? emisorRes.json() : { 'hydra:member': [] },
      receptorRes.ok ? receptorRes.json() : { 'hydra:member': [] },
    ])

    const emitidas: SyntageInvoice[] = emisorData['hydra:member'] ?? []
    const recibidas: SyntageInvoice[] = receptorData['hydra:member'] ?? []

    const now = new Date()

    // Build last-12-months template
    function buildMonthMap() {
      const map = new Map<string, { label: string; total: number }>()
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now)
        d.setMonth(d.getMonth() - i)
        const key = getMonthKey(d.toISOString())
        const label = MONTH_LABELS[d.getMonth()]
        map.set(key, { label, total: 0 })
      }
      return map
    }

    // ─── INGRESOS ───────────────────────────────────────────
    const ingMensualMap = buildMonthMap()
    const clientesMap = new Map<string, { rfc: string; nombre: string; total: number; facturas: number }>()

    for (const inv of emitidas) {
      const key = getMonthKey(inv.issuedAt)
      if (ingMensualMap.has(key)) ingMensualMap.get(key)!.total += inv.total ?? 0

      const rfc = inv.receiver?.rfc ?? 'DESCONOCIDO'
      const nombre = inv.receiver?.name ?? rfc
      const ex = clientesMap.get(rfc)
      if (ex) { ex.total += inv.total ?? 0; ex.facturas += 1 }
      else clientesMap.set(rfc, { rfc, nombre, total: inv.total ?? 0, facturas: 1 })
    }

    const ingresosTotal = emitidas.reduce((s, inv) => s + (inv.total ?? 0), 0)
    const ingresosMensual = Array.from(ingMensualMap.entries()).map(([mes, v]) => ({ mes, label: v.label, total: v.total }))
    const topClientes = Array.from(clientesMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)

    // ─── GASTOS ─────────────────────────────────────────────
    const gastMensualMap = buildMonthMap()
    const proveedoresMap = new Map<string, { rfc: string; nombre: string; total: number; facturas: number }>()

    for (const inv of recibidas) {
      const key = getMonthKey(inv.issuedAt)
      if (gastMensualMap.has(key)) gastMensualMap.get(key)!.total += inv.total ?? 0

      const rfc = inv.issuer?.rfc ?? 'DESCONOCIDO'
      const nombre = inv.issuer?.name ?? rfc
      const ex = proveedoresMap.get(rfc)
      if (ex) { ex.total += inv.total ?? 0; ex.facturas += 1 }
      else proveedoresMap.set(rfc, { rfc, nombre, total: inv.total ?? 0, facturas: 1 })
    }

    const gastosTotal = recibidas.reduce((s, inv) => s + (inv.total ?? 0), 0)
    const gastosMensual = Array.from(gastMensualMap.entries()).map(([mes, v]) => ({ mes, label: v.label, total: v.total }))
    const topProveedores = Array.from(proveedoresMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)

    // ─── CxC ────────────────────────────────────────────────
    const cxcMap = new Map<string, { rfc: string; nombre: string; totalPendiente: number; facturas: number; issuedAts: string[] }>()
    for (const inv of emitidas) {
      if (!((inv.dueAmount ?? 0) > 0)) continue
      const rfc = inv.receiver?.rfc ?? 'DESCONOCIDO'
      const nombre = inv.receiver?.name ?? rfc
      const ex = cxcMap.get(rfc)
      if (ex) { ex.totalPendiente += inv.dueAmount ?? 0; ex.facturas += 1; ex.issuedAts.push(inv.issuedAt) }
      else cxcMap.set(rfc, { rfc, nombre, totalPendiente: inv.dueAmount ?? 0, facturas: 1, issuedAts: [inv.issuedAt] })
    }
    const cxcTotal = Array.from(cxcMap.values()).reduce((s, c) => s + c.totalPendiente, 0)
    const cxcClientes = Array.from(cxcMap.values())
      .map(c => ({ rfc: c.rfc, nombre: c.nombre, totalPendiente: c.totalPendiente, facturas: c.facturas, facturasMasAntigua: c.issuedAts.sort()[0] ?? null }))
      .sort((a, b) => b.totalPendiente - a.totalPendiente)

    // ─── CxP ────────────────────────────────────────────────
    const cxpMap = new Map<string, { rfc: string; nombre: string; totalPendiente: number; facturas: number; issuedAts: string[] }>()
    for (const inv of recibidas) {
      if (!((inv.dueAmount ?? 0) > 0)) continue
      const rfc = inv.issuer?.rfc ?? 'DESCONOCIDO'
      const nombre = inv.issuer?.name ?? rfc
      const ex = cxpMap.get(rfc)
      if (ex) { ex.totalPendiente += inv.dueAmount ?? 0; ex.facturas += 1; ex.issuedAts.push(inv.issuedAt) }
      else cxpMap.set(rfc, { rfc, nombre, totalPendiente: inv.dueAmount ?? 0, facturas: 1, issuedAts: [inv.issuedAt] })
    }
    const cxpTotal = Array.from(cxpMap.values()).reduce((s, c) => s + c.totalPendiente, 0)
    const cxpProveedores = Array.from(cxpMap.values())
      .map(c => ({ rfc: c.rfc, nombre: c.nombre, totalPendiente: c.totalPendiente, facturas: c.facturas, facturasMasAntigua: c.issuedAts.sort()[0] ?? null }))
      .sort((a, b) => b.totalPendiente - a.totalPendiente)

    return json({
      verified: !!company.syntage_validated_at,
      ingresos: { total: ingresosTotal, mensual: ingresosMensual, topClientes },
      gastos: { total: gastosTotal, mensual: gastosMensual, topProveedores },
      cxc: { total: cxcTotal, clientes: cxcClientes },
      cxp: { total: cxpTotal, proveedores: cxpProveedores },
    })
  } catch (err) {
    console.error('get-bi-data error:', err)
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500)
  }
})

function json(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
