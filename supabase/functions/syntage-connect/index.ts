import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Env vars inyectadas automáticamente por Supabase + los secrets que configures
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SYNTAGE_API_KEY = Deno.env.get('SYNTAGE_API_KEY')!
const SYNTAGE_BASE_URL = Deno.env.get('SYNTAGE_BASE_URL')!

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 10 // 30 segundos máximo

serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verificar autenticación del usuario
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('Unauthorized', 401)
    }

    // Cliente con JWT del usuario para verificar identidad
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonError('Unauthorized', 401)
    }

    // Cliente service role para operaciones de DB sin restricción de RLS
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
    const credentialRes = await fetch(`${SYNTAGE_BASE_URL}/credentials`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SYNTAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rfc, password: ciec }),
    })

    if (!credentialRes.ok) {
      const errText = await credentialRes.text()
      return jsonError(`Error al conectar con SAT: ${errText}`, 400)
    }

    const { id: credential_id } = await credentialRes.json()

    // 5. Polling hasta que el status sea definitivo (max 30s)
    let status = 'pending'
    let razon_social: string | null = null
    let rawResponse: Record<string, unknown> | null = null

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await delay(POLL_INTERVAL_MS)

      const pollRes = await fetch(`${SYNTAGE_BASE_URL}/credentials/${credential_id}`, {
        headers: { 'Authorization': `Bearer ${SYNTAGE_API_KEY}` },
      })

      if (!pollRes.ok) {
        status = 'error'
        break
      }

      const data = await pollRes.json()
      rawResponse = data
      status = data.status ?? 'pending'

      if (status === 'valid') {
        razon_social = data.razon_social ?? data.name ?? null
        break
      }

      if (status === 'invalid' || status === 'error') {
        break
      }
    }

    // Si sigue en pending tras el máximo de intentos, marcarlo como timeout
    if (status === 'pending') {
      status = 'error'
    }

    // 6. Actualizar companies en DB
    await adminClient
      .from('companies')
      .update({
        credential_id,
        syntage_validated_at: new Date().toISOString(),
        syntage_raw_response: rawResponse,
      })
      .eq('id', company_id)

    // 7. Si válido, disparar extracciones CFDI y declaraciones
    if (status === 'valid') {
      await Promise.all([
        fetch(`${SYNTAGE_BASE_URL}/extractions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SYNTAGE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ credential_id, type: 'cfdi' }),
        }),
        fetch(`${SYNTAGE_BASE_URL}/extractions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SYNTAGE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ credential_id, type: 'declarations' }),
        }),
      ])
    }

    return new Response(
      JSON.stringify({ success: status === 'valid', status, credential_id, razon_social }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('syntage-connect error:', err)
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500)
  }
})

// Helpers
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
