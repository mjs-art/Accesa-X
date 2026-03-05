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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonError('Unauthorized', 401)

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Obtener empresa
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc, credential_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) return jsonError('Empresa no encontrada', 404)

    const syntageResults: string[] = []

    // 2. Buscar y eliminar credenciales en Syntage por RFC
    const credListRes = await fetch(
      `${SYNTAGE_BASE_URL}/credentials?rfc=${encodeURIComponent(company.rfc)}&itemsPerPage=50`,
      { headers: { 'X-API-Key': SYNTAGE_API_KEY } }
    )

    if (credListRes.ok) {
      const credData = await credListRes.json()
      const credentials = credData['hydra:member'] ?? []

      for (const cred of credentials) {
        const deleteRes = await fetch(`${SYNTAGE_BASE_URL}/credentials/${cred.id}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': SYNTAGE_API_KEY },
        })
        syntageResults.push(`credential ${cred.id}: ${deleteRes.status}`)
      }
    } else {
      syntageResults.push(`credentials list: ${credListRes.status}`)
    }

    // 3. Buscar y eliminar entidades en Syntage por RFC
    const entityListRes = await fetch(
      `${SYNTAGE_BASE_URL}/entities?taxpayer.id=${encodeURIComponent(company.rfc)}&itemsPerPage=50`,
      { headers: { 'X-API-Key': SYNTAGE_API_KEY } }
    )

    if (entityListRes.ok) {
      const entityData = await entityListRes.json()
      const entities = entityData['hydra:member'] ?? []

      for (const entity of entities) {
        const deleteRes = await fetch(`${SYNTAGE_BASE_URL}/entities/${entity.id}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': SYNTAGE_API_KEY },
        })
        syntageResults.push(`entity ${entity.id}: ${deleteRes.status}`)
      }
    } else {
      syntageResults.push(`entities list: ${entityListRes.status}`)
    }

    // 4. Limpiar datos de Syntage en Supabase — empresa queda como no verificada
    await adminClient
      .from('companies')
      .update({
        credential_id: null,
        syntage_validated_at: null,
        syntage_raw_response: null,
      })
      .eq('id', company.id)

    return new Response(
      JSON.stringify({ success: true, syntage: syntageResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('debug-reset-syntage error:', msg)
    return jsonError(msg, 500)
  }
})

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
