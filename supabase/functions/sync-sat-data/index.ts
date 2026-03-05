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

const syntageHeaders = {
  'X-API-Key': SYNTAGE_API_KEY,
  'Content-Type': 'application/json',
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

    // 2. Obtener empresa
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc, credential_id, syntage_validated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) return jsonError('Empresa no encontrada', 404)

    if (!company.credential_id || !company.syntage_validated_at) {
      return jsonError('La empresa no tiene una credencial SAT activa. Verifica primero.', 400)
    }

    // 3. Resolver el entity UUID desde Syntage usando el RFC
    // credential_id ≠ entity_id — son recursos distintos en Syntage
    const entityListRes = await fetch(
      `${SYNTAGE_BASE_URL}/entities?taxpayer.id=${encodeURIComponent(company.rfc)}`,
      { headers: { 'X-API-Key': SYNTAGE_API_KEY } }
    )

    if (!entityListRes.ok) {
      const body = await entityListRes.text()
      console.error('Syntage entities error:', entityListRes.status, body)
      return jsonError(`No se pudo obtener la entidad de Syntage: ${entityListRes.status}`, 500)
    }

    const entityData = await entityListRes.json()
    const entities = entityData['hydra:member'] ?? []

    if (entities.length === 0) {
      return jsonError('No se encontró una entidad activa en Syntage para este RFC.', 404)
    }

    const entity_id: string = entities[0].id
    const entity_iri = `/entities/${entity_id}`

    // 4. Disparar extracciones con el entity UUID correcto
    const [invoiceRes, declarationsRes] = await Promise.all([
      fetch(`${SYNTAGE_BASE_URL}/extractions`, {
        method: 'POST',
        headers: syntageHeaders,
        body: JSON.stringify({ entity: entity_iri, extractor: 'invoice' }),
      }),
      fetch(`${SYNTAGE_BASE_URL}/extractions`, {
        method: 'POST',
        headers: syntageHeaders,
        body: JSON.stringify({ entity: entity_iri, extractor: 'annual_tax_return' }),
      }),
    ])

    if (!invoiceRes.ok && !declarationsRes.ok) {
      const invoiceBody = await invoiceRes.text()
      console.error('Syntage extraction error:', invoiceRes.status, invoiceBody)
      return jsonError(`Error al disparar extracción: ${invoiceRes.status} ${invoiceBody}`, 500)
    }

    // 5. Actualizar timestamp y guardar entity_id correcto
    await adminClient
      .from('companies')
      .update({
        syntage_validated_at: new Date().toISOString(),
        credential_id: entity_id, // corregir: guardar entity_id, no credential_id
      })
      .eq('id', company.id)

    return new Response(
      JSON.stringify({ success: true, entity_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('sync-sat-data catch:', msg)
    return jsonError(msg, 500)
  }
})

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
