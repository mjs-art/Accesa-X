import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode as encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const ANALYSIS_PROMPT = `Analiza este contrato y responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin bloques de código. Usa exactamente esta estructura:

{
  "resumen": "descripción breve del contrato",
  "monto_total": 0,
  "moneda": "MXN",
  "fecha_inicio": "YYYY-MM-DD",
  "fecha_fin": "YYYY-MM-DD",
  "fechas_pago": ["YYYY-MM-DD"],
  "entregables": ["entregable 1"],
  "riesgos": [{"descripcion": "riesgo", "nivel": "alto"}],
  "cliente_nombre": "nombre del cliente",
  "viabilidad_score": 80,
  "viabilidad_razon": "razón del score"
}`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  let contractId: string | null = null

  try {
    // 1. Verificar auth usando el admin client con el JWT del usuario
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('STEP 1 FAIL: No Authorization header')
      return jsonError('Unauthorized: no token', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)

    if (userError || !user) {
      console.error('STEP 1 FAIL: Invalid token', userError?.message)
      return jsonError(`Unauthorized: ${userError?.message}`, 401)
    }
    console.log('STEP 1 OK: user', user.id)

    // 1b. Rate limit: máximo 10 análisis por usuario por hora
    const rl = await checkRateLimit(adminClient, user.id, 'analyze-contract', 10, 3600)
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Límite de análisis alcanzado. Intenta en una hora.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    // 2. Parsear body
    const body = await req.json()
    const { contract_id, storage_path } = body
    if (!contract_id || !storage_path) {
      console.error('STEP 2 FAIL: Missing fields', body)
      return jsonError('Faltan campos: contract_id, storage_path', 400)
    }
    contractId = contract_id
    console.log('STEP 2 OK: contract_id', contract_id, 'path', storage_path)

    // 3. Verificar que el contrato pertenece al usuario
    const { data: contract, error: contractError } = await adminClient
      .from('contracts')
      .select('id, company_id')
      .eq('id', contract_id)
      .single()

    if (contractError || !contract) {
      console.error('STEP 3 FAIL: Contract not found', contractError?.message)
      return jsonError('Contrato no encontrado', 404)
    }

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id')
      .eq('id', contract.company_id)
      .eq('user_id', user.id)
      .single()

    if (companyError || !company) {
      console.error('STEP 3 FAIL: Ownership check failed for user', user.id)
      return jsonError('Contrato no encontrado', 404)
    }
    console.log('STEP 3 OK: contract found and ownership verified')

    // 4. Marcar como processing
    await adminClient
      .from('contracts')
      .update({ analysis_status: 'processing' })
      .eq('id', contract_id)
    console.log('STEP 4 OK: marked as processing')

    // 5. Descargar PDF desde Storage
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('contracts')
      .download(storage_path)

    if (downloadError || !fileData) {
      console.error('STEP 5 FAIL: Download error', downloadError?.message)
      throw new Error(`Error descargando PDF: ${downloadError?.message}`)
    }
    console.log('STEP 5 OK: PDF downloaded, size', fileData.size)

    // 6. Convertir a base64 con método eficiente de Deno
    const arrayBuffer = await fileData.arrayBuffer()

    // Validar magic bytes: los PDF válidos empiezan con %PDF (0x25 0x50 0x44 0x46)
    const header = new Uint8Array(arrayBuffer, 0, 4)
    if (header[0] !== 0x25 || header[1] !== 0x50 || header[2] !== 0x44 || header[3] !== 0x46) {
      throw new Error('El archivo no es un PDF válido')
    }
    console.log('STEP 6 OK: magic bytes validados')

    const pdfBase64 = encodeBase64(arrayBuffer)
    console.log('STEP 6 OK: base64 length', pdfBase64.length)

    // 7. Llamar a Claude con el PDF
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            { type: 'text', text: ANALYSIS_PROMPT },
          ],
        }],
      }),
    })

    const anthropicBody = await anthropicRes.json()
    if (!anthropicRes.ok) {
      // Log full details server-side only — never send Claude API internals to the client.
      console.error('STEP 7 FAIL: Claude error', JSON.stringify(anthropicBody))
      throw new InternalError('Error al analizar el contrato con IA. Intenta de nuevo.')
    }
    console.log('STEP 7 OK: Claude responded')

    // 8. Parsear respuesta JSON de Claude
    const rawText = anthropicBody.content?.[0]?.text ?? ''
    console.log('STEP 8 raw text:', rawText.substring(0, 200))

    let analysisResult: Record<string, unknown>
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysisResult = JSON.parse(cleaned)
    } catch {
      // Log Claude's raw output internally; don't leak partial contract text to client.
      console.error('STEP 8 FAIL: JSON parse error. Raw:', rawText.substring(0, 300))
      throw new InternalError('No se pudo interpretar el análisis del contrato. Intenta de nuevo.')
    }
    console.log('STEP 8 OK: JSON parsed')

    // 9. Guardar en DB
    await adminClient
      .from('contracts')
      .update({
        analysis_result: analysisResult,
        analysis_status: 'completed',
        analyzed_at: new Date().toISOString(),
        nombre_cliente: (analysisResult.cliente_nombre as string) ?? null,
        monto_contrato: (analysisResult.monto_total as number) ?? null,
        fecha_inicio: (analysisResult.fecha_inicio as string) ?? null,
        fecha_fin: (analysisResult.fecha_fin as string) ?? null,
      })
      .eq('id', contract_id)
    console.log('STEP 9 OK: saved to DB')

    // 10. Disparar extracciones (best-effort)
    return new Response(
      JSON.stringify({ success: true, analysis: analysisResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    // Only log details for unexpected errors (InternalError already logged above).
    if (!(err instanceof InternalError)) {
      console.error('FATAL ERROR:', msg)
    }

    if (contractId) {
      await adminClient
        .from('contracts')
        .update({ analysis_status: 'error', analyzed_at: new Date().toISOString() })
        .eq('id', contractId)
        .catch(() => {})
    }

    // InternalError carries a safe user-facing message; other errors get a generic one.
    const clientMsg = err instanceof InternalError ? msg : 'Error interno al analizar el contrato'
    return jsonError(clientMsg, 500)
  }
})

/** Error with a pre-sanitized message safe to send to the client. */
class InternalError extends Error {}

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
