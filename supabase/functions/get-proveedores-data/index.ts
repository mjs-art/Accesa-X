import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt)
    if (authError || !user) return jsonError('Unauthorized', 401)
    const userId = user.id

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) return jsonError('Empresa no encontrada', 404)

    // DEBUG: count total rows for company
    const { count: totalCount } = await adminClient
      .from('sat_cfdis')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)

    const { count: receiverCount } = await adminClient
      .from('sat_cfdis')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .eq('receiver_rfc', company.rfc.toUpperCase().trim())

    console.log(`DEBUG company=${company.id} rfc=${company.rfc} totalSatCfdis=${totalCount} receiverMatch=${receiverCount}`)

    // Leer facturas recibidas desde cfdis (ya sincronizadas)
    const { data: cfdis, error: cfdiError } = await adminClient
      .from('cfdis')
      .select('issuer_rfc, issuer_name, total, due_amount, issued_at, cfdi_status')
      .eq('company_id', company.id)
      .eq('receiver_rfc', company.rfc.toUpperCase().trim())
      .eq('cfdi_status', 'vigente')
      .order('issued_at', { ascending: false })

    if (cfdiError) {
      console.error('cfdis query error:', cfdiError)
      return jsonError('Error al leer facturas', 500)
    }

    // Agrupar por proveedor (issuer_rfc)
    const map = new Map<string, {
      rfc: string
      nombre: string
      totalComprado: number
      numFacturas: number
      porPagar: number
      ultimaFactura: string | null
    }>()

    for (const inv of (cfdis ?? [])) {
      const rfc = inv.issuer_rfc?.toUpperCase() ?? 'DESCONOCIDO'
      const existing = map.get(rfc)
      const dueAmount = inv.due_amount ?? 0

      if (existing) {
        existing.totalComprado += inv.total ?? 0
        existing.numFacturas  += 1
        existing.porPagar     += dueAmount
        if (!existing.ultimaFactura || inv.issued_at > existing.ultimaFactura) {
          existing.ultimaFactura = inv.issued_at
        }
      } else {
        map.set(rfc, {
          rfc,
          nombre:        inv.issuer_name ?? rfc,
          totalComprado: inv.total ?? 0,
          numFacturas:   1,
          porPagar:      dueAmount,
          ultimaFactura: inv.issued_at ?? null,
        })
      }
    }

    const proveedores = Array.from(map.values()).sort((a, b) => b.totalComprado - a.totalComprado)
    const totalGasto    = proveedores.reduce((s, p) => s + p.totalComprado, 0)
    const totalPorPagar = proveedores.reduce((s, p) => s + p.porPagar, 0)

    return json({ proveedores, totalGasto, totalPorPagar, _debug: { totalCount, receiverCount, rfc: company.rfc } })
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
