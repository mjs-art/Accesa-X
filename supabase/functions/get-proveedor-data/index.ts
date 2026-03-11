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

    const { proveedorRfc } = await req.json()
    if (!proveedorRfc) return jsonError('proveedorRfc requerido', 400)

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc, nombre_razon_social')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) return jsonError('Empresa no encontrada', 404)

    // Fetch facturas recibidas por esta empresa (somos el receptor)
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

    // Filtrar por proveedor RFC (el emisor de las facturas)
    const invoices = allInvoices.filter(
      (inv) => inv.issuer?.rfc?.toUpperCase() === proveedorRfc.toUpperCase()
    )

    if (invoices.length === 0) {
      return json({
        proveedor: {
          rfc: proveedorRfc,
          nombre: proveedorRfc,
          totalComprado: 0,
          numFacturas: 0,
          porPagar: 0,
          ultimaFactura: null,
          porcentajeDelTotal: 0,
        },
        invoices: [],
        totalGastoEmpresa: allInvoices.reduce((s, i) => s + (i.total ?? 0), 0),
      })
    }

    // KPIs del proveedor
    const totalComprado = invoices.reduce((s, i) => s + (i.total ?? 0), 0)
    const porPagar = invoices.reduce((s, i) => s + (i.dueAmount ?? 0), 0)
    const totalGastoEmpresa = allInvoices.reduce((s, i) => s + (i.total ?? 0), 0)
    const ultimaFactura = invoices[0]?.issuedAt ?? null
    const proveedorNombre = invoices[0]?.issuer?.name ?? proveedorRfc

    return json({
      proveedor: {
        rfc: proveedorRfc,
        nombre: proveedorNombre,
        totalComprado,
        numFacturas: invoices.length,
        porPagar,
        ultimaFactura,
        porcentajeDelTotal: totalGastoEmpresa > 0
          ? Math.round((totalComprado / totalGastoEmpresa) * 100 * 10) / 10
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
      totalGastoEmpresa,
    })
  } catch (err) {
    console.error('get-proveedor-data error:', err)
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
