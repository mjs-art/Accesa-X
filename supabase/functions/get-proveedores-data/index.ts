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
  uuid?: string
  type: string
  status: string
  total: number
  subtotal?: number
  issuedAt: string
  paidAmount?: number
  dueAmount?: number
  fullyPaidAt?: string | null
  receiver: { rfc: string; name: string }
  issuer: { rfc: string; name: string }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonError('Unauthorized', 401)

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc, nombre_razon_social')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) return jsonError('Empresa no encontrada', 404)

    // Fetch facturas recibidas por esta empresa (compras a proveedores)
    const url = new URL(`${SYNTAGE_BASE_URL}/taxpayers/${encodeURIComponent(company.rfc)}/invoices`)
    url.searchParams.set('isReceiver', 'true')
    url.searchParams.set('type', 'I')
    url.searchParams.set('status', 'VIGENTE')
    url.searchParams.set('itemsPerPage', '1000')
    url.searchParams.set('order[issuedAt]', 'desc')

    const invoicesRes = await fetch(url.toString(), {
      headers: { 'X-API-Key': SYNTAGE_API_KEY },
    })

    if (!invoicesRes.ok) {
      const err = await invoicesRes.text()
      console.error('Syntage error:', invoicesRes.status, err)
      return jsonError(`Error al obtener facturas: ${invoicesRes.status}`, 500)
    }

    const invoicesData = await invoicesRes.json()
    const allInvoices: SyntageInvoice[] = invoicesData['hydra:member'] ?? []

    // Agrupar por proveedor (issuer.rfc)
    const map = new Map<string, {
      rfc: string
      nombre: string
      totalComprado: number
      numFacturas: number
      porPagar: number
      ultimaFactura: string | null
    }>()

    for (const inv of allInvoices) {
      const rfc = inv.issuer?.rfc?.toUpperCase() ?? 'DESCONOCIDO'
      const existing = map.get(rfc)
      if (existing) {
        existing.totalComprado += inv.total ?? 0
        existing.numFacturas += 1
        existing.porPagar += inv.dueAmount ?? 0
        if (!existing.ultimaFactura || inv.issuedAt > existing.ultimaFactura) {
          existing.ultimaFactura = inv.issuedAt
        }
      } else {
        map.set(rfc, {
          rfc,
          nombre: inv.issuer?.name ?? rfc,
          totalComprado: inv.total ?? 0,
          numFacturas: 1,
          porPagar: inv.dueAmount ?? 0,
          ultimaFactura: inv.issuedAt ?? null,
        })
      }
    }

    // Ordenar por gasto total descendente
    const proveedores = Array.from(map.values()).sort((a, b) => b.totalComprado - a.totalComprado)

    const totalGasto = proveedores.reduce((s, p) => s + p.totalComprado, 0)
    const totalPorPagar = proveedores.reduce((s, p) => s + p.porPagar, 0)

    return json({ proveedores, totalGasto, totalPorPagar })
  } catch (err) {
    console.error('get-proveedores-data error:', err)
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500)
  }
})

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
