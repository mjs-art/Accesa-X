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
  issuedAt: string
  receiver: { rfc: string; name: string }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Autenticar usuario
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonError('Unauthorized', 401)

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 2. Obtener empresa del usuario
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc, nombre_razon_social, syntage_validated_at, credential_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) return jsonError('Empresa no encontrada', 404)

    const verified = !!company.syntage_validated_at

    // 3. Fetch facturas emitidas por RFC — no depende del estado de verificación en AccesaX
    // GET /taxpayers/{RFC}/invoices solo necesita el API key de Syntage
    const invoicesUrl = new URL(`${SYNTAGE_BASE_URL}/taxpayers/${encodeURIComponent(company.rfc)}/invoices`)
    invoicesUrl.searchParams.set('isIssuer', 'true')
    invoicesUrl.searchParams.set('type', 'I')
    invoicesUrl.searchParams.set('status', 'VIGENTE')
    invoicesUrl.searchParams.set('itemsPerPage', '1000')
    invoicesUrl.searchParams.set('order[issuedAt]', 'desc')

    const invoicesRes = await fetch(invoicesUrl.toString(), {
      headers: { 'X-API-Key': SYNTAGE_API_KEY },
    })

    if (!invoicesRes.ok) {
      const err = await invoicesRes.text()
      console.error('Syntage invoices error:', invoicesRes.status, err)
      return json({ verified, resumen: null, clientes: [] })
    }

    const invoicesData = await invoicesRes.json()
    const invoices: SyntageInvoice[] = invoicesData['hydra:member'] ?? []

    // 4. Agregar datos
    let totalFacturado = 0
    const clientesMap = new Map<string, {
      rfc: string
      nombre: string
      totalFacturado: number
      facturas: number
      ultimaFactura: string
    }>()

    for (const inv of invoices) {
      totalFacturado += inv.total ?? 0

      const rfc = inv.receiver?.rfc ?? 'DESCONOCIDO'
      const nombre = inv.receiver?.name ?? rfc
      const fecha = inv.issuedAt ?? ''

      const existing = clientesMap.get(rfc)
      if (existing) {
        existing.totalFacturado += inv.total ?? 0
        existing.facturas += 1
        if (fecha > existing.ultimaFactura) existing.ultimaFactura = fecha
      } else {
        clientesMap.set(rfc, {
          rfc,
          nombre,
          totalFacturado: inv.total ?? 0,
          facturas: 1,
          ultimaFactura: fecha,
        })
      }
    }

    const clientes = Array.from(clientesMap.values())
      .sort((a, b) => b.totalFacturado - a.totalFacturado)

    return json({
      verified,
      resumen: {
        totalFacturado,
        clientesUnicos: clientes.length,
        facturasEmitidas: invoices.length,
      },
      clientes,
    })
  } catch (err) {
    console.error('get-dashboard-data error:', err)
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500)
  }
})

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
