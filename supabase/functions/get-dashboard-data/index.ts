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

    // Decode JWT without verifying (gateway already validated)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt)
    if (authError || !user) return jsonError('Unauthorized', 401)
    const userId = user.id

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc, nombre_razon_social, syntage_validated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) return jsonError('Empresa no encontrada', 404)

    const verified = !!company.syntage_validated_at

    // Read issued invoices (clientes) from synced DB data
    const { data: cfdis, error: cfdiError } = await adminClient
      .from('cfdis')
      .select('receiver_rfc, receiver_name, total, issued_at, cfdi_status')
      .eq('company_id', company.id)
      .eq('issuer_rfc', company.rfc.toUpperCase().trim())
      .eq('cfdi_status', 'vigente')
      .order('issued_at', { ascending: false })

    if (cfdiError) {
      console.error('cfdis query error:', cfdiError)
      return json({ verified, resumen: null, clientes: [] })
    }

    // Aggregate by client (receiver_rfc)
    let totalFacturado = 0
    const clientesMap = new Map<string, {
      rfc: string
      nombre: string
      totalFacturado: number
      facturas: number
      ultimaFactura: string
    }>()

    for (const inv of (cfdis ?? [])) {
      const rfc = inv.receiver_rfc?.toUpperCase() ?? 'DESCONOCIDO'
      totalFacturado += inv.total ?? 0

      const existing = clientesMap.get(rfc)
      if (existing) {
        existing.totalFacturado += inv.total ?? 0
        existing.facturas += 1
        if (!existing.ultimaFactura || inv.issued_at > existing.ultimaFactura) {
          existing.ultimaFactura = inv.issued_at
        }
      } else {
        clientesMap.set(rfc, {
          rfc,
          nombre: inv.receiver_name ?? rfc,
          totalFacturado: inv.total ?? 0,
          facturas: 1,
          ultimaFactura: inv.issued_at ?? '',
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
        facturasEmitidas: cfdis?.length ?? 0,
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
