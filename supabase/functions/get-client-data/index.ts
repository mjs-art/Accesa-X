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
  concepts?: { claveProdServ?: string; description?: string }[]
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

    const { clientRfc } = await req.json()
    if (!clientRfc) return jsonError('clientRfc requerido', 400)

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Obtener empresa
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc, nombre_razon_social')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) return jsonError('Empresa no encontrada', 404)

    // Fetch facturas emitidas por esta empresa a este cliente
    const url = new URL(`${SYNTAGE_BASE_URL}/taxpayers/${encodeURIComponent(company.rfc)}/invoices`)
    url.searchParams.set('isIssuer', 'true')
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

    // Filtrar por cliente RFC
    const invoices = allInvoices.filter(
      (inv) => inv.receiver?.rfc?.toUpperCase() === clientRfc.toUpperCase()
    )

    if (invoices.length === 0) {
      return json({
        client: {
          rfc: clientRfc,
          nombre: clientRfc,
          totalFacturado: 0,
          numFacturas: 0,
          porCobrar: 0,
          ultimaFactura: null,
          porcentajeDelTotal: 0,
        },
        invoices: [],
        totalEmpresa: allInvoices.reduce((s, i) => s + (i.total ?? 0), 0),
      })
    }

    // KPIs del cliente
    const totalFacturado = invoices.reduce((s, i) => s + (i.total ?? 0), 0)
    const porCobrar = invoices.reduce((s, i) => s + (i.dueAmount ?? 0), 0)
    const totalEmpresa = allInvoices.reduce((s, i) => s + (i.total ?? 0), 0)
    const ultimaFactura = invoices[0]?.issuedAt ?? null
    const clienteNombre = invoices[0]?.receiver?.name ?? clientRfc

    return json({
      client: {
        rfc: clientRfc,
        nombre: clienteNombre,
        totalFacturado,
        numFacturas: invoices.length,
        porCobrar,
        ultimaFactura,
        porcentajeDelTotal: totalEmpresa > 0
          ? Math.round((totalFacturado / totalEmpresa) * 100 * 10) / 10
          : 0,
      },
      invoices: invoices.map((inv) => ({
        uuid: inv.uuid ?? inv.id,
        total: inv.total,
        subtotal: inv.subtotal ?? inv.total,
        paidAmount: inv.paidAmount ?? null,
        dueAmount: inv.dueAmount ?? null,
        fullyPaidAt: inv.fullyPaidAt ?? null,
        issuedAt: inv.issuedAt,
        status: inv.status,
        descripcion: inv.concepts?.[0]?.description ?? '—',
        claveProdServ: inv.concepts?.[0]?.claveProdServ ?? null,
      })),
      totalEmpresa,
    })
  } catch (err) {
    console.error('get-client-data error:', err)
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
