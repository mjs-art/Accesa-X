import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runSync } from './_sync.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SYNTAGE_API_KEY         = Deno.env.get('SYNTAGE_API_KEY')!
const SYNTAGE_BASE_URL        = Deno.env.get('SYNTAGE_BASE_URL')!

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

    // 2. Parsear body
    const body = await req.json().catch(() => ({}))
    const company_id: string | undefined = body?.company_id
    const force: boolean = body?.force === true

    // 3. Obtener empresa (por company_id explícito o por user_id)
    let companyQuery = adminClient
      .from('companies')
      .select('id, rfc, credential_id, syntage_validated_at')
      .eq('user_id', user.id)

    if (company_id) {
      companyQuery = companyQuery.eq('id', company_id)
    }

    const { data: company, error: companyError } = await companyQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (companyError || !company) return jsonError('Empresa no encontrada', 404)

    if (!company.credential_id) {
      return jsonError('La empresa no tiene credencial SAT. Verifica primero.', 400)
    }

    // 4. Verificar que no haya ya un job activo para esta empresa
    const { data: activeJob } = await adminClient
      .from('sat_sync_jobs')
      .select('id, status')
      .eq('company_id', company.id)
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (activeJob) {
      // Retornar el job existente en lugar de crear uno duplicado
      return json({ success: true, jobId: activeJob.id, existing: true })
    }

    // 4b. Si ya existe un job completado y no se fuerza re-sync, retornar sin consumir Syntage
    if (!force) {
      const { data: completedJob } = await adminClient
        .from('sat_sync_jobs')
        .select('id')
        .eq('company_id', company.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (completedJob) {
        return json({ success: true, jobId: completedJob.id, alreadySynced: true })
      }
    }

    // 5. Crear registro del job en sat_sync_jobs
    const { data: job, error: jobError } = await adminClient
      .from('sat_sync_jobs')
      .insert({
        company_id:  company.id,
        status:      'queued',
        phase:       'queued',
        progress_pct: 0,
      })
      .select('id')
      .single()

    if (jobError || !job) {
      console.error('Error creando sat_sync_jobs:', jobError)
      return jsonError('No se pudo iniciar la sincronización', 500)
    }

    // 6. Disparar sincronización en background
    //    EdgeRuntime.waitUntil mantiene la función viva después de que
    //    se envía la respuesta HTTP — el proceso continúa aunque el
    //    cliente cierre el tab.
    // @ts-ignore — EdgeRuntime es un global de Deno Deploy
    EdgeRuntime.waitUntil(
      runSync(
        adminClient,
        job.id,
        {
          id:          company.id,
          rfc:         company.rfc,
          credentialId: company.credential_id,
        },
        SYNTAGE_API_KEY,
        SYNTAGE_BASE_URL,
      ).catch((err) => {
        console.error('sync-sat-full background error:', err)
      })
    )

    // 7. Retornar jobId inmediatamente al cliente
    return json({ success: true, jobId: job.id })

  } catch (err) {
    console.error('sync-sat-full error:', err)
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500)
  }
})

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
