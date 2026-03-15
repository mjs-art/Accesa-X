import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !user) return jsonError('Unauthorized', 401)

    // 1b. Rate limit: máximo 30 preguntas por usuario por hora
    const rl = await checkRateLimit(adminClient, user.id, 'ask-contract', 30, 3600)
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Límite de consultas alcanzado. Intenta en una hora.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    // 2. Parse body
    const { contract_id, question } = await req.json()
    if (!contract_id || !question?.trim()) return jsonError('Faltan campos: contract_id, question', 400)

    const trimmedQuestion = String(question).trim().slice(0, 1000)

    // 3. Fetch contract analysis and verify ownership
    const { data: contract, error: contractError } = await adminClient
      .from('contracts')
      .select('id, company_id, analysis_result, analysis_status')
      .eq('id', contract_id)
      .single()

    if (contractError || !contract) return jsonError('Contrato no encontrado', 404)

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id')
      .eq('id', contract.company_id)
      .eq('user_id', user.id)
      .single()

    if (companyError || !company) return jsonError('Contrato no encontrado', 404)

    if (!contract.analysis_result) return jsonError('El contrato aún no ha sido analizado', 400)

    // 4. Llamar a Claude con el contexto del análisis
    // El contexto del sistema y la pregunta del usuario se envían en mensajes separados
    // para evitar prompt injection desde el campo `question`.
    const contextJson = JSON.stringify(contract.analysis_result, null, 2)

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: 'Eres un asistente experto en análisis de contratos legales y financieros. Responde de forma clara y concisa en español, basándote únicamente en el análisis del contrato que el usuario te proporcionará. Si la pregunta no puede responderse con la información disponible, indícalo amablemente y sugiere qué información adicional sería necesaria.',
        messages: [
          {
            role: 'user',
            content: `Aquí está el análisis del contrato en formato JSON:\n\n\`\`\`json\n${contextJson}\n\`\`\``,
          },
          {
            role: 'assistant',
            content: 'Entendido, he revisado el análisis del contrato. ¿En qué puedo ayudarte?',
          },
          {
            role: 'user',
            content: trimmedQuestion,
          },
        ],
      }),
    })

    const body = await anthropicRes.json()
    if (!anthropicRes.ok) throw new Error(body?.error?.message ?? 'Claude error')

    const answer = body.content?.[0]?.text ?? ''

    return new Response(
      JSON.stringify({ success: true, answer }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return jsonError(msg, 500)
  }
})

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
