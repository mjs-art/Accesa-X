import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode as encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const PROMPT = `Analiza este documento (orden de compra, contrato o acuerdo comercial) y responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin bloques de código. Usa exactamente esta estructura:

{
  "resumen": "descripción breve de qué se está comprando o contratando",
  "monto_total": 0,
  "moneda": "MXN",
  "cliente_nombre": "nombre de la empresa compradora o pagadora",
  "cliente_rfc": "RFC si aparece en el documento, o null",
  "fecha_documento": "YYYY-MM-DD o null",
  "fecha_entrega": "fecha límite de entrega o null",
  "descripcion_servicio": "qué producto o servicio se está adquiriendo",
  "viabilidad_score": 80,
  "viabilidad_razon": "explicación del score: qué tan sólido y cobrable parece el documento",
  "riesgos": [{"descripcion": "riesgo identificado", "nivel": "alto"}]
}`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  let applicationId: string | null = null

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !user) return jsonError('Unauthorized', 401)

    const { application_id, storage_path } = await req.json()
    if (!application_id || !storage_path) return jsonError('Faltan campos: application_id, storage_path', 400)
    applicationId = application_id

    // Verificar que la solicitud pertenece al usuario
    const { data: app, error: appErr } = await adminClient
      .from('credit_applications')
      .select('id, company_id, companies!inner(user_id)')
      .eq('id', application_id)
      .single()

    if (appErr || !app) return jsonError('Solicitud no encontrada', 404)

    // Descargar PDF desde financiamiento-docs
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('financiamiento-docs')
      .download(storage_path)

    if (downloadError || !fileData) throw new Error(`Error descargando archivo: ${downloadError?.message}`)

    const pdfBase64 = encodeBase64(await fileData.arrayBuffer())

    // Llamar a Claude
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
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })

    const anthropicBody = await anthropicRes.json()
    if (!anthropicRes.ok) throw new Error(`Claude error: ${anthropicBody?.error?.message}`)

    const rawText = anthropicBody.content?.[0]?.text ?? ''
    let analysis: Record<string, unknown>
    try {
      analysis = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
    } catch {
      throw new Error(`No se pudo parsear respuesta de Claude: ${rawText.substring(0, 200)}`)
    }

    // Guardar en credit_applications
    await adminClient
      .from('credit_applications')
      .update({ orden_compra_analysis: analysis })
      .eq('id', application_id)

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('analyze-orden-compra error:', err)
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500)
  }
})

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
