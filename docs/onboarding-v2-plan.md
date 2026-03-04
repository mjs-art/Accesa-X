# Plan: Onboarding V2 — AccesaX

**Basado en diagnóstico completo del código existente.**
**Premisa:** Extender sin romper. Los pasos OAuth + empresa + verificacion-fiscal no se tocan (excepto donde se indica).

---

## Diagnóstico del estado actual

### Flujo actual
```
Google OAuth → /onboarding/empresa → /onboarding/verificacion-fiscal → /onboarding/contratos (PLACEHOLDER) → dashboard (sin guard)
```

### Arquitectura identificada
| Aspecto | Estado actual |
|---|---|
| Estado entre pasos | Ninguno — cada página guarda directo a Supabase en "Continuar" |
| Guard de onboarding | Ninguno — auth/callback solo verifica si existe `companies` row |
| Progreso guardado | No hay campo `onboarding_step` en ninguna tabla |
| Último paso real | `verificacion-fiscal` redirige a `/onboarding/contratos` (placeholder vacío) |
| Contador de pasos | Hardcodeado en cada página: "Paso 1 de 3", "Paso 2 de 3" |
| Servicios externos | Supabase Auth + Syntage + Claude AI. Sin SMS, sin email |

### Archivos del onboarding actual
```
app/onboarding/
├── layout.tsx                   — layout simple sin sidebar
├── empresa/page.tsx             — Paso 1: datos empresa + RFC (253 líneas)
├── verificacion-fiscal/page.tsx — Paso 2: CIEC + Syntage SAT (250 líneas)
└── contratos/page.tsx           — Paso 3: PLACEHOLDER (9 líneas, "próximamente")
```

---

## Decisiones arquitectónicas (confirmadas)

| Decisión | Opción elegida | Implicación técnica |
|---|---|---|
| Estado entre pasos | Guardar en Supabase por paso | Cada paso hace su propio INSERT/UPDATE al presionar "Continuar" |
| OTP de celular | Supabase Phone Auth | Requiere Twilio configurado en Supabase Dashboard → Authentication → Providers → Phone. Si no está configurado, usar OTP simulado (ver Sesión 2) |
| Email invitaciones | Supabase Auth invitations | `supabase.auth.admin.inviteUserByEmail()` — requiere Service Role Key → debe ir en Server Action, nunca en cliente |

---

## Nuevo flujo

```
Google OAuth
    ↓
/onboarding/empresa          (Paso 1/7) — sin cambios en lógica
    ↓
/onboarding/verificacion-fiscal  (Paso 2/7) — 1 línea cambia: redirect a legal-rep
    ↓
/onboarding/legal-rep        (Paso 3/7) — NUEVO
    ↓
/onboarding/legal-rep-docs   (Paso 4/7) — NUEVO
    ↓
/onboarding/shareholders     (Paso 5/7) — NUEVO
    ↓
/onboarding/company-docs     (Paso 6/7) — NUEVO
    ↓
/onboarding/confirmation     (Paso 7/7) — NUEVO
    ↓
/dashboard (con guard que verifica onboarding_completed)
```

---

## Sesión 1 — Migración DB + Rutas + Guards

### 1.1 Nueva migración: `supabase/migrations/004_onboarding_v2.sql`

```sql
-- ============================================================
-- PASO 1: Extender tabla companies con tracking de onboarding
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'empresa'
    CHECK (onboarding_step IN (
      'empresa', 'verificacion-fiscal', 'legal-rep',
      'legal-rep-docs', 'shareholders', 'company-docs',
      'confirmation', 'completed'
    )),
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ============================================================
-- PASO 2: Representante legal
-- ============================================================
CREATE TABLE IF NOT EXISTS public.legal_representatives (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  es_el_usuario       BOOLEAN NOT NULL DEFAULT true,
  -- Datos personales (null si se delegó a otra persona)
  nombres             TEXT,
  apellido_paterno    TEXT,
  apellido_materno    TEXT,
  curp                TEXT,
  rfc_personal        TEXT,
  email               TEXT,
  telefono            TEXT,
  telefono_verificado BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_representatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lr_select_own" ON public.legal_representatives
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "lr_insert_own" ON public.legal_representatives
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "lr_update_own" ON public.legal_representatives
  FOR UPDATE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- ============================================================
-- PASO 3: Documentos del representante legal
-- ============================================================
CREATE TABLE IF NOT EXISTS public.legal_rep_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_rep_id    UUID NOT NULL REFERENCES public.legal_representatives(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL CHECK (document_type IN ('id_oficial', 'comprobante_domicilio')),
  file_url        TEXT,
  storage_path    TEXT,
  status          TEXT NOT NULL DEFAULT 'uploaded'
                  CHECK (status IN ('uploaded', 'validating', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_rep_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lrd_select_own" ON public.legal_rep_documents
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "lrd_insert_own" ON public.legal_rep_documents
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- ============================================================
-- PASO 4: Accionistas (shareholders)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shareholders (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  es_persona_moral          BOOLEAN NOT NULL DEFAULT false,
  posee_mas_25_porciento    BOOLEAN NOT NULL,
  porcentaje_participacion  NUMERIC(5,2),
  -- Datos completos (solo cuando posee_mas_25_porciento = true)
  nombres                   TEXT,
  apellido_paterno          TEXT,
  apellido_materno          TEXT,
  curp                      TEXT,
  fecha_nacimiento          DATE,
  ocupacion                 TEXT,
  telefono                  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shareholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sh_select_own" ON public.shareholders
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "sh_insert_own" ON public.shareholders
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "sh_update_own" ON public.shareholders
  FOR UPDATE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "sh_delete_own" ON public.shareholders
  FOR DELETE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- ============================================================
-- PASO 5: Documentos de accionistas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shareholder_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id  UUID NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL CHECK (document_type IN ('id_oficial', 'comprobante_domicilio')),
  file_url        TEXT,
  storage_path    TEXT,
  status          TEXT NOT NULL DEFAULT 'uploaded'
                  CHECK (status IN ('uploaded', 'validating', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shareholder_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shd_select_own" ON public.shareholder_documents
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "shd_insert_own" ON public.shareholder_documents
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- ============================================================
-- PASO 6: Documentos de la empresa
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL CHECK (document_type IN (
                    'acta_constitutiva',
                    'actas_asamblea',
                    'documento_poderes',
                    'estado_cuenta_bancario',
                    'documento_adicional'
                  )),
  file_url        TEXT,
  storage_path    TEXT,
  status          TEXT NOT NULL DEFAULT 'uploaded'
                  CHECK (status IN ('uploaded', 'validating', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cd_select_own" ON public.company_documents
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "cd_insert_own" ON public.company_documents
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "cd_delete_own" ON public.company_documents
  FOR DELETE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- ============================================================
-- PASO 7: Invitaciones para delegación (rep legal / accionistas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.onboarding_invitations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invitation_type  TEXT NOT NULL CHECK (invitation_type IN ('legal_rep', 'shareholder')),
  invitee_email    TEXT NOT NULL,
  invitee_name     TEXT,
  -- token generado server-side (crypto.randomUUID())
  token            TEXT UNIQUE NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '72 hours'),
  accepted_at      TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_select_own" ON public.onboarding_invitations
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "inv_insert_own" ON public.onboarding_invitations
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
CREATE POLICY "inv_update_own" ON public.onboarding_invitations
  FOR UPDATE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- ============================================================
-- PASO 8: Storage buckets (ejecutar en Supabase Dashboard o CLI)
-- Nota: Los INSERT a storage.buckets deben ejecutarse con
-- service_role key, no funcionan en migraciones normales.
-- Alternativa: crear los buckets desde el Dashboard de Supabase.
-- ============================================================
-- Bucket: legal-rep-docs  (10 MB max, privado)
-- Bucket: shareholder-docs (10 MB max, privado)
-- Bucket: company-docs    (20 MB max, privado)
-- Formatos permitidos: PDF, JPG, PNG, HEIC

-- Políticas de storage (ejecutar después de crear los buckets):
/*
CREATE POLICY "lr_docs_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'legal-rep-docs' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "lr_docs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'legal-rep-docs' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE user_id = auth.uid()
    )
  );
-- (Replicar el mismo patrón para 'shareholder-docs' y 'company-docs')
*/
```

### 1.2 Archivos a modificar

**`app/onboarding/verificacion-fiscal/page.tsx` — 1 línea**
```diff
- onClick={() => router.push('/onboarding/contratos')}
+ onClick={() => router.push('/onboarding/legal-rep')}
```
(Línea ~196 del archivo actual)

**`app/onboarding/empresa/page.tsx` — 1 línea**
```diff
- <span className="text-sm font-medium text-[#0F2D5E]">Paso 1 de 3</span>
+ <span className="text-sm font-medium text-[#0F2D5E]">Paso 1 de 7</span>
```

**`app/onboarding/verificacion-fiscal/page.tsx` — 1 línea adicional**
```diff
- <span className="text-sm font-medium text-[#0F2D5E]">Paso 2 de 3</span>
+ <span className="text-sm font-medium text-[#0F2D5E]">Paso 2 de 7</span>
```

**`app/auth/callback/route.ts` — lógica de redirect mejorada**

Reemplazar la lógica actual que solo verifica si existe `company` con:
```typescript
// Si tiene empresa, verificar en qué paso del onboarding está
const { data: company } = await supabase
  .from('companies')
  .select('id, onboarding_completed, onboarding_step')
  .eq('user_id', data.user.id)
  .limit(1)
  .single()

if (!company) {
  return NextResponse.redirect(`${origin}/onboarding/empresa`)
}

if (company.onboarding_completed) {
  return NextResponse.redirect(`${origin}/dashboard`)
}

// Mapear step al path correcto
const STEP_PATHS: Record<string, string> = {
  'empresa':             '/onboarding/empresa',
  'verificacion-fiscal': '/onboarding/verificacion-fiscal',
  'legal-rep':           '/onboarding/legal-rep',
  'legal-rep-docs':      '/onboarding/legal-rep-docs',
  'shareholders':        '/onboarding/shareholders',
  'company-docs':        '/onboarding/company-docs',
  'confirmation':        '/onboarding/confirmation',
}
const stepPath = STEP_PATHS[company.onboarding_step ?? 'empresa'] ?? '/onboarding/empresa'
return NextResponse.redirect(`${origin}${stepPath}`)
```

**`middleware.ts` — agregar guard de onboarding para dashboard**

Después del check de `/admin`, agregar:
```typescript
// Usuarios autenticados en dashboard: verificar onboarding completo
if (user && pathname.startsWith('/dashboard')) {
  const { data: company } = await supabase
    .from('companies')
    .select('onboarding_completed, onboarding_step')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!company) {
    return NextResponse.redirect(new URL('/onboarding/empresa', request.url))
  }

  if (!company.onboarding_completed) {
    const STEP_PATHS: Record<string, string> = {
      'empresa':             '/onboarding/empresa',
      'verificacion-fiscal': '/onboarding/verificacion-fiscal',
      'legal-rep':           '/onboarding/legal-rep',
      'legal-rep-docs':      '/onboarding/legal-rep-docs',
      'shareholders':        '/onboarding/shareholders',
      'company-docs':        '/onboarding/company-docs',
      'confirmation':        '/onboarding/confirmation',
    }
    const path = STEP_PATHS[company.onboarding_step ?? 'empresa'] ?? '/onboarding/empresa'
    return NextResponse.redirect(new URL(path, request.url))
  }
}
```

### 1.3 Archivos a eliminar
- `app/onboarding/contratos/page.tsx` — reemplazado por los 5 nuevos pasos

### 1.4 Archivos placeholder a crear (solo esqueleto, se implementan en sesiones 2-5)
```
app/onboarding/legal-rep/page.tsx
app/onboarding/legal-rep-docs/page.tsx
app/onboarding/shareholders/page.tsx
app/onboarding/company-docs/page.tsx
app/onboarding/confirmation/page.tsx
app/actions/send-invitation.ts       ← Server Action para invitaciones
```

---

## Sesión 2 — Representante Legal (`/onboarding/legal-rep` y `/onboarding/legal-rep-docs`)

### Lógica del paso legal-rep

```typescript
// Al inicio del paso: actualizar onboarding_step
await supabase
  .from('companies')
  .update({ onboarding_step: 'legal-rep' })
  .eq('id', company.id)

// Al presionar "Continuar": insertar en legal_representatives
await supabase.from('legal_representatives').insert({
  company_id: company.id,
  es_el_usuario: esElUsuario,
  nombres: form.nombres,
  apellido_paterno: form.apellidoPaterno,
  apellido_materno: form.apellidoMaterno,
  curp: form.curp,
  rfc_personal: form.rfcPersonal,
  email: form.email,
  telefono: form.telefono,
  telefono_verificado: telefonoVerificado,
})

// Actualizar step a siguiente
await supabase
  .from('companies')
  .update({ onboarding_step: 'legal-rep-docs' })
  .eq('id', company.id)

router.push('/onboarding/legal-rep-docs')
```

### OTP de celular — Implementación con Supabase Phone Auth

> **Requisito previo:** Activar Phone Auth en Supabase Dashboard →
> Authentication → Providers → Phone. Elegir proveedor (Twilio recomendado).
> Variables de entorno adicionales en Edge Functions: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN.

**Flujo en el componente:**
```typescript
// 1. Usuario ingresa número → presiona "Enviar código"
const { error } = await supabase.auth.signInWithOtp({
  phone: '+52' + telefono,
})

// 2. Usuario ingresa los 6 dígitos → presionar "Verificar"
const { error } = await supabase.auth.verifyOtp({
  phone: '+52' + telefono,
  token: codigoIngresado,
  type: 'sms',
})
// Si no hay error → setTelefonoVerificado(true)
```

> **Nota importante:** `signInWithOtp` con phone crea una sesión paralela.
> Esto puede interferir con la sesión Google OAuth existente del usuario.
> **Alternativa robusta para V1 sin Twilio:** Implementar OTP personalizado:
> 1. Server Action genera código de 6 dígitos y lo guarda en tabla `phone_verifications`
>    con `expires_at = now() + 10 minutes`
> 2. Mostrar el código en pantalla (modo desarrollo) o enviar via Twilio cuando esté configurado
> 3. Usuario ingresa código → Server Action valida → marca `telefono_verificado = true` en `legal_representatives`

### Flujo de delegación (si NO es el usuario el rep legal)

```typescript
// Server Action: app/actions/send-invitation.ts
'use server'
import { createClient } from '@supabase/supabase-js'

export async function sendInvitation(
  companyId: string,
  email: string,
  type: 'legal_rep' | 'shareholder'
) {
  // Usar service role key (solo server-side)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Generar token único
  const token = crypto.randomUUID()

  // Guardar invitación en DB
  await supabase.from('onboarding_invitations').insert({
    company_id: companyId,
    invitation_type: type,
    invitee_email: email,
    token,
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  })

  // Enviar invitación vía Supabase Auth
  await supabase.auth.admin.inviteUserByEmail(email, {
    data: { invitation_token: token, company_id: companyId },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/invitado?token=${token}`,
  })

  return { success: true }
}
```

> **Variable de entorno nueva:** `SUPABASE_SERVICE_ROLE_KEY` (ya existe en Edge Functions,
> pero necesita agregarse al entorno de Next.js como variable secreta — NUNCA con prefijo
> NEXT_PUBLIC_. Solo usarla en Server Actions y Route Handlers.)

### Validaciones de campos

| Campo | Regex / Regla |
|---|---|
| CURP | `/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/` (18 caracteres) |
| RFC personal | `/^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/i` (persona física, 13 chars) |
| Teléfono | 10 dígitos, solo números, se almacena con `+52` prefix |

### Lógica del paso legal-rep-docs

```typescript
// Patrón de upload (igual para todos los uploaders del proyecto)
async function uploadDocument(file: File, type: 'id_oficial' | 'comprobante_domicilio') {
  const filename = `${Date.now()}-${file.name}`
  const storagePath = `${company.id}/${filename}`

  // 1. Upload a Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('legal-rep-docs')
    .upload(storagePath, file)

  if (uploadError) throw uploadError

  // 2. Obtener URL pública (o signed URL si el bucket es privado)
  const { data } = supabase.storage
    .from('legal-rep-docs')
    .getPublicUrl(storagePath)

  // 3. Guardar referencia en DB
  await supabase.from('legal_rep_documents').insert({
    legal_rep_id: legalRepId,
    company_id: company.id,
    document_type: type,
    file_url: data.publicUrl,
    storage_path: storagePath,
    status: 'uploaded',
  })
}
```

**Estados del uploader** (máquina de estados local por documento):
```
'idle' → 'uploading' → 'validating' → 'ready' | 'error'
```

> El estado 'validating' es visual únicamente (spinner 2 segundos).
> La validación real se hace async por el equipo de AccesaX.

**Al continuar:** no bloquear si un doc está en 'validating'. Guardar y avanzar.

```typescript
// Al presionar "Continuar" en legal-rep-docs:
await supabase
  .from('companies')
  .update({ onboarding_step: 'shareholders' })
  .eq('id', company.id)
router.push('/onboarding/shareholders')
```

---

## Sesión 3 — Accionistas (`/onboarding/shareholders`)

### Componente ShareholderCard

El paso renderiza una lista de `ShareholderCard` components con estado local.
Al presionar "Continuar" se hace un INSERT masivo de todos los accionistas.

```typescript
// Estado del paso
const [shareholders, setShareholders] = useState<ShareholderForm[]>([
  { id: crypto.randomUUID(), esMayoritario: false, ... }
])

// Al "Continuar":
// 1. Validar que haya al menos 1 accionista
// 2. Para cada accionista: INSERT en shareholders
// 3. Para cada doc de accionista mayoritario: upload + INSERT en shareholder_documents
// 4. UPDATE companies.onboarding_step = 'company-docs'
// 5. router.push('/onboarding/company-docs')
```

### Lógica de accionistas con menos del 25%

Solo requieren: nombre completo + % de participación.
No se piden documentos. Formulario mínimo (3 campos).

### Mecanismo de invitación a accionista

Idéntico al del rep legal: usar `sendInvitation(companyId, email, 'shareholder')`.

### Storage de documentos de accionistas

```
Bucket: shareholder-docs
Path: {company_id}/{shareholder_id}/{timestamp}-{filename}
```

> El `shareholder_id` se obtiene del INSERT previo al accionista.
> Usar `supabase.from('shareholders').insert({...}).select().single()` para obtener el id.

---

## Sesión 4 — Documentos de la empresa (`/onboarding/company-docs`)

### Estructura acordeón

Usar el componente `Accordion` de Radix UI (ya disponible en el proyecto).

```tsx
<Accordion type="multiple" defaultValue={['constitucion', 'financiera']}>
  <AccordionItem value="constitucion">
    <AccordionTrigger>Constitución legal</AccordionTrigger>
    <AccordionContent>
      <Uploader type="acta_constitutiva" required />
      <Uploader type="actas_asamblea" optional />
      <Uploader type="documento_poderes" optional />
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="financiera">
    <AccordionTrigger>Situación financiera</AccordionTrigger>
    <AccordionContent>
      {/* Banner verde: CSF obtenida automáticamente */}
      <MultiUploader type="estado_cuenta_bancario" min={2} max={3} required />
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="adicionales">
    <AccordionTrigger>Documentos adicionales</AccordionTrigger>
    <AccordionContent>
      <Uploader type="documento_adicional" optional />
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

> **Nota:** Verificar si `@radix-ui/react-accordion` está instalado.
> Si no: `npm install @radix-ui/react-accordion`

### Validación al continuar

```typescript
const estadosCuenta = uploadedDocs.filter(d => d.type === 'estado_cuenta_bancario')
if (estadosCuenta.length < 2) {
  setError('Debes subir mínimo 2 estados de cuenta bancarios')
  return
}
```

### Storage

```
Bucket: company-docs
Path: {company_id}/{document_type}/{timestamp}-{filename}
```

### Al continuar

```typescript
await supabase
  .from('companies')
  .update({ onboarding_step: 'confirmation' })
  .eq('id', company.id)
router.push('/onboarding/confirmation')
```

---

## Sesión 5 — Confirmación (`/onboarding/confirmation`)

### Al montar el componente

```typescript
// Marcar onboarding como completo
await supabase
  .from('companies')
  .update({
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
    onboarding_step: 'completed',
  })
  .eq('id', company.id)

// Crear credit_application (tabla ya existe)
await supabase.from('credit_applications').insert({
  company_id: company.id,
  tipo_credito: 'empresarial',
  status: 'under_review',
})
```

> **Nota:** Verificar si `status` acepta 'under_review'. El CHECK constraint actual es
> `DEFAULT 'submitted'` sin restricción de valores. Agregar a la migración si se requiere.

### Pasos pendientes de terceros

```typescript
// Cargar invitaciones pendientes
const { data: pendingInvitations } = await supabase
  .from('onboarding_invitations')
  .select('*')
  .eq('company_id', company.id)
  .eq('status', 'pending')
```

### Reenvío de invitación

Llama de nuevo a `sendInvitation()` con el mismo email.
El token anterior expira al generar uno nuevo (actualizar el registro existente).

---

## Componente compartido: Uploader

Crear en `components/onboarding/uploader.tsx` — usado en las sesiones 2, 3 y 4.

```typescript
interface UploaderProps {
  label: string
  description?: string
  documentType: string
  bucket: 'legal-rep-docs' | 'shareholder-docs' | 'company-docs'
  storagePath: string  // e.g. "{company_id}/{shareholder_id}"
  onUploadComplete: (doc: { fileUrl: string; storagePath: string }) => void
  required?: boolean
}
```

**Estados internos:** `'idle' | 'uploading' | 'validating' | 'ready' | 'error'`

**Nota de diseño:** Mantener el mismo color scheme del proyecto:
- Idle: borde `border-slate-200`, fondo `bg-white`
- Uploading: borde `border-blue-200`, fondo `bg-blue-50`
- Validating: spinner azul (`text-blue-500`)
- Ready: borde `border-emerald-200`, fondo `bg-emerald-50`, check `text-[#00C896]`
- Error: borde `border-red-200`, fondo `bg-red-50`

---

## Resumen de cambios por archivo

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `app/onboarding/empresa/page.tsx` | "Paso 1 de 3" → "Paso 1 de 7" |
| `app/onboarding/verificacion-fiscal/page.tsx` | "Paso 2 de 3" → "Paso 2 de 7" + redirect a `/onboarding/legal-rep` |
| `app/auth/callback/route.ts` | Lógica de redirect con `onboarding_step` |
| `middleware.ts` | Guard de onboarding completo para `/dashboard` |

### Archivos eliminados
| Archivo | Razón |
|---|---|
| `app/onboarding/contratos/page.tsx` | Reemplazado por los 5 nuevos pasos |

### Archivos nuevos
| Archivo | Descripción |
|---|---|
| `supabase/migrations/004_onboarding_v2.sql` | 7 tablas nuevas + campos en companies |
| `app/onboarding/legal-rep/page.tsx` | Paso 3/7 |
| `app/onboarding/legal-rep-docs/page.tsx` | Paso 4/7 |
| `app/onboarding/shareholders/page.tsx` | Paso 5/7 |
| `app/onboarding/company-docs/page.tsx` | Paso 6/7 |
| `app/onboarding/confirmation/page.tsx` | Paso 7/7 |
| `app/actions/send-invitation.ts` | Server Action — invitaciones con Supabase Admin |
| `components/onboarding/uploader.tsx` | Componente compartido de upload |

### Variables de entorno nuevas
| Variable | Uso | Dónde va |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server Actions (invitaciones) | `.env.local` (secreto, nunca `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_APP_URL` | URL base para links de invitación | `.env.local` |
| Twilio en Supabase Dashboard | OTP de celular | Supabase Dashboard → Auth → Providers → Phone |

---

## Preguntas resueltas para implementación completa

| Pregunta | Respuesta |
|---|---|
| ¿Estado global entre pasos? | No hay context. Cada paso guarda directo en Supabase |
| ¿OTP de celular? | Supabase Phone Auth (signInWithOtp/verifyOtp). Requiere Twilio en Supabase Dashboard |
| ¿Email de invitaciones? | Supabase Auth Admin inviteUserByEmail via Server Action con SERVICE_ROLE_KEY |
| ¿Qué pasa con `/onboarding/contratos`? | Se elimina. Los 5 nuevos pasos lo reemplazan |
| ¿Supabase types generados? | No existen. Usar tipos manuales por ahora (patrón del proyecto) |
| ¿Accordion disponible? | Verificar si `@radix-ui/react-accordion` está instalado |
| ¿Cómo obtener company_id en cada paso? | Query a `companies` por `user_id` (igual que verificacion-fiscal/page.tsx) |
| ¿Credit application al final? | INSERT con `tipo_credito: 'empresarial'` en tabla existente `credit_applications` |

---

## Orden de ejecución

```
Sesión 1 (hacer primero — desbloquea todo lo demás):
  1. Ejecutar migration 004 en Supabase
  2. Crear buckets en Supabase Dashboard
  3. Modificar verificacion-fiscal (redirect) + empresa (contador)
  4. Modificar auth/callback y middleware (guard)
  5. Eliminar contratos/page.tsx
  6. Crear placeholders vacíos para los 5 pasos nuevos

Sesión 2: Implementar legal-rep + legal-rep-docs
Sesión 3: Implementar shareholders
Sesión 4: Implementar company-docs
Sesión 5: Implementar confirmation
```

---

*Generado con diagnóstico completo del código base de AccesaX. Stack: Next.js 14 + Supabase + TypeScript.*
