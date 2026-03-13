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
const SYNTAGE_BASE_URL = Deno.env.get('SYNTAGE_BASE_URL')! // https://api.syntage.com o https://api.sandbox.syntage.com

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 10 // 30 segundos máximo

// Syntage usa X-API-Key, no Bearer token
const syntageHeaders = {
  'X-API-Key': SYNTAGE_API_KEY,
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verificar autenticación del usuario
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('Unauthorized', 401)
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonError('Unauthorized', 401)
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 2. Parsear y validar body
    const { rfc, ciec, company_id } = await req.json()
    if (!rfc || !ciec || !company_id) {
      return jsonError('Faltan campos requeridos: rfc, ciec, company_id', 400)
    }

    // 3. Verificar que la empresa pertenece al usuario
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, rfc')
      .eq('id', company_id)
      .eq('user_id', user.id)
      .single()

    if (companyError || !company) {
      return jsonError('Empresa no encontrada', 404)
    }

    // 4. Crear credencial en Syntage
    // POST /credentials — requiere type: "ciec" (o "efirma")
    const credentialRes = await fetch(`${SYNTAGE_BASE_URL}/credentials`, {
      method: 'POST',
      headers: syntageHeaders,
      body: JSON.stringify({ type: 'ciec', rfc, password: ciec }),
    })

    if (!credentialRes.ok) {
      const errText = await credentialRes.text()
      return jsonError(`Error al conectar con SAT: ${errText}`, 400)
    }

    const credentialData = await credentialRes.json()
    const credential_id: string = credentialData.id

    // 5. Resolver entity UUID por RFC (credential_id ≠ entity_id en Syntage)
    let entity_id = credential_id // fallback
    const entityRes = await fetch(
      `${SYNTAGE_BASE_URL}/entities?taxpayer.id=${encodeURIComponent(company.rfc)}`,
      { headers: { 'X-API-Key': SYNTAGE_API_KEY } }
    )
    if (entityRes.ok) {
      const entityData = await entityRes.json()
      const entities = entityData['hydra:member'] ?? []
      if (entities.length > 0) entity_id = entities[0].id
    }
    const entity_iri = `/entities/${entity_id}`

    // 6. Polling hasta que el status sea definitivo (max 30s)
    let status = 'pending'
    let rawResponse: Record<string, unknown> | null = null

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await delay(POLL_INTERVAL_MS)

      const pollRes = await fetch(`${SYNTAGE_BASE_URL}/credentials/${credential_id}`, {
        headers: { 'X-API-Key': SYNTAGE_API_KEY },
      })

      if (!pollRes.ok) {
        status = 'error'
        break
      }

      const data = await pollRes.json()
      rawResponse = data
      status = data.status ?? 'pending'

      if (status === 'valid' || status === 'invalid' || status === 'error' || status === 'deactivated') {
        break
      }
    }

    if (status === 'pending') {
      status = 'error'
    }

    // 7. Actualizar companies en DB — guardar credential_id real (no entity_id)
    await adminClient
      .from('companies')
      .update({
        credential_id: credential_id,
        syntage_validated_at: status === 'valid' ? new Date().toISOString() : null,
        syntage_raw_response: rawResponse,
        estatus_sat: status === 'valid' ? 'Activo' : null,
      })
      .eq('id', company_id)

    // 8. Si válido, iniciar sincronización completa en background
    //    sync-sat-full usa EdgeRuntime.waitUntil() — continúa aunque
    //    el usuario cierre el tab. El jobId se retorna al cliente para
    //    que pueda mostrar el progreso via Realtime.
    let jobId: string | null = null

    if (status === 'valid') {
      try {
        const syncRes = await adminClient.functions.invoke('sync-sat-full', {
          body: { company_id },
        })
        if (syncRes.data?.jobId) {
          jobId = syncRes.data.jobId
        }
      } catch (syncErr) {
        // No fallar la validación si la invocación del sync falla
        console.error('Error al invocar sync-sat-full:', syncErr)
      }
    }

    return new Response(
      JSON.stringify({ success: status === 'valid', status, credential_id, jobId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('syntage-connect error:', err)
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500)
  }
})

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
