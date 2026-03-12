# AccesaX — Arquitectura y Guía para Colaboradores

AccesaX es una plataforma B2B de crédito empresarial para PyMEs mexicanas. Permite a empresas conectar su situación fiscal (SAT/Syntage), solicitar financiamiento por proyecto o factoraje de facturas, y darle seguimiento a sus solicitudes en tiempo real.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 App Router + React |
| Estilos | Tailwind CSS + shadcn/ui (Radix) |
| Backend/DB | Supabase (PostgreSQL + RLS + Auth) |
| Edge Functions | Supabase Edge Functions (Deno) |
| Datos fiscales | Syntage API (CFDIs del SAT) |
| Emails | Resend |
| Almacenamiento | Supabase Storage |

**Colores de marca:** Navy `#0F2D5E` · Teal `#3CBEDB` · Green `#00C896` · Muted `#6B7280`

---

## Cómo correr el proyecto localmente

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env.local con:
NEXT_PUBLIC_SUPABASE_URL=https://lvromzmsqqqtlgwnhjfg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=re_...          # opcional — emails
NEXT_PUBLIC_APP_URL=https://...  # opcional — emails

# 3. Correr en desarrollo
npm run dev   # → localhost:3000
```

**Supabase CLI** (para edge functions y migraciones):
```bash
npx supabase functions deploy <nombre-funcion>
npx supabase db push
```

---

## Mapa de rutas

### Públicas
| Ruta | Descripción |
|------|-------------|
| `/` | Login / Registro con Google OAuth |
| `/auth/callback` | Callback de OAuth |
| `/onboarding/invitado` | Aceptar invitación como representante legal |

### Onboarding (requiere auth, sin empresa completa)
| Ruta | Paso | Descripción |
|------|------|-------------|
| `/onboarding/empresa` | 1 | RFC, nombre, industria, tamaño |
| `/onboarding/verificacion-fiscal` | 2 | Conexión SAT vía CIEC (Syntage) |
| `/onboarding/legal-rep` | 3 | Datos del representante legal |
| `/onboarding/legal-rep-docs` | 4 | INE + comprobante de domicilio del rep. legal |
| `/onboarding/shareholders` | 5 | Socios con >25% de participación |
| `/onboarding/company-docs` | 6 | Acta constitutiva, poderes, estado de cuenta |
| `/onboarding/confirmation` | 7 | Resumen y aceptación de términos |

El middleware impide saltar pasos — si intentas acceder a un paso adelantado, te redirige al paso actual guardado en `companies.onboarding_step`.

### Dashboard (requiere auth + onboarding completo)
| Ruta | Descripción |
|------|-------------|
| `/dashboard` | Resumen financiero general |
| `/dashboard/credito` | Lista de solicitudes de crédito |
| `/dashboard/credito/[id]` | Detalle de una solicitud (proyecto o factoraje) |
| `/dashboard/clientes` | Clientes (CFDIs emitidos por empresa) |
| `/dashboard/clientes/[id]` | Detalle de cliente con contratos |
| `/dashboard/proveedores` | Proveedores (CFDIs recibidos por empresa) |
| `/dashboard/proveedores/[id]` | Detalle de proveedor |
| `/dashboard/inteligencia` | Resumen de inteligencia financiera |
| `/dashboard/inteligencia/ingresos` | Análisis de ingresos |
| `/dashboard/inteligencia/gastos` | Análisis de gastos |
| `/dashboard/inteligencia/cxc` | Cuentas por cobrar |
| `/dashboard/inteligencia/cxp` | Cuentas por pagar |
| `/dashboard/inteligencia/analisis` | DSO, DPO, capital de trabajo |
| `/dashboard/verificacion-fiscal` | Reconectar SAT |
| `/dashboard/perfil` | Perfil del usuario |

### Flujos de crédito
| Ruta | Descripción |
|------|-------------|
| `/credito/nuevo` | Selección de producto (proyecto vs factoraje) |
| `/credito/proyecto/nuevo` | Wizard de crédito por proyecto |
| `/credito/factoraje/nuevo` | Wizard de factoraje |
| `/solicitar-credito` | Redirect legacy → `/credito/nuevo` |

### Admin (requiere `role = 'admin'` en `profiles`)
| Ruta | Descripción |
|------|-------------|
| `/admin` | Panel con KPIs y tabla de solicitudes |
| `/admin/solicitudes/[id]` | Revisar solicitud, cambiar estatus, agregar notas |
| `/admin/empresas` | Listado de empresas y análisis financiero |

---

## Base de datos

### Tablas principales

#### `companies`
Empresa del usuario. Una por usuario (por ahora).

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → auth.users |
| `rfc` | TEXT | Validado con regex mexicano |
| `nombre_razon_social` | TEXT | |
| `industria` | TEXT | Lista cerrada |
| `tamano_empresa` | TEXT | micro/pequeña/mediana/grande |
| `onboarding_step` | TEXT | Paso actual del onboarding |
| `onboarding_completed` | BOOL | |
| `estatus_sat` | TEXT | `'Activo'` si CIEC validada |
| `credential_id` | TEXT | Entity ID de Syntage |
| `syntage_validated_at` | TIMESTAMPTZ | |

#### `credit_applications`
Solicitudes de crédito de cualquier tipo.

| Campo | Tipo | Notas |
|-------|------|-------|
| `tipo_credito` | TEXT | `'proyecto'` \| `'factoraje'` |
| `status` | TEXT | Ver estados abajo |
| `monto_solicitado` | NUMERIC | |
| `auto_aprobado` | BOOL | Auto-aprobado si monto ≤ $2M MXN |
| `condiciones_aceptadas_at` | TIMESTAMPTZ | Cuando el usuario envió |
| `analyst_notes` | TEXT | Notas del analista (visibles al cliente) |
| `plazo_meses` | INT | Solo para proyecto |
| `notificacion_deudor` | BOOL | Solo para factoraje |

**Estados posibles:**
```
borrador → submitted → en_revision → docs_pendientes
                    ↘ aprobado → fondos_liberados → en_ejecucion → liquidado
                                                                  ↘ rechazado
```

#### `cfdis`
Cache de facturas del SAT, sincronizadas desde Syntage.

| Campo | Notas |
|-------|-------|
| `cfdi_uuid` | UUID del CFDI en el SAT |
| `cfdi_type` | `I`=Ingreso `E`=Egreso `P`=Pago |
| `issuer_rfc` / `receiver_rfc` | Emisor / Receptor |
| `total` / `due_amount` | Monto total / pendiente de cobro |
| `cfdi_status` | `vigente` \| `cancelado` |
| `synced_at` | Última vez sincronizado |

Upsert key: `(company_id, cfdi_uuid)` — idempotente.

#### `factoraje_cfdis`
Facturas seleccionadas en una solicitud de factoraje.

| Campo | Notas |
|-------|-------|
| `credit_application_id` | FK → credit_applications |
| `cfdi_id` | FK → cfdis |
| `monto_nominal` | `due_amount` de la factura al momento |
| `aforo_pct` | 80 / 85 / 90 |
| `monto_a_dispersar` | `monto_nominal * aforo_pct / 100` |

#### Otras tablas importantes
- `profiles` — `role: 'user' | 'admin'`. Se crea automáticamente por trigger en `auth.users`.
- `project_vendors` — Proveedores a pagar en crédito por proyecto (con CLABE verificada).
- `financiamiento_documentos` — Documentos adjuntos a solicitudes (orden de compra, factura, etc.).
- `legal_representatives` / `shareholders` / `company_documents` — Datos KYC del onboarding.
- `internal_notes` — Notas internas del analista (solo admin).
- `invitations` — Invitaciones enviadas a representantes legales.

### Storage buckets
| Bucket | Path | Contenido |
|--------|------|-----------|
| `contracts` | `{user_id}/{filename}` | Contratos subidos (análisis IA) |
| `company-docs` | `{company_id}/{tipo}/{filename}` | Docs de onboarding (KYC) |
| `financiamiento-docs` | `{user_id}/{app_id}/{tipo}.ext` | Docs de solicitudes de crédito |

---

## Server Actions

Viven en `app/actions/`. Son funciones `'use server'` llamadas directamente desde componentes cliente.

| Archivo | Qué hace |
|---------|---------|
| `factoraje.ts` | CRUD completo de solicitudes de factoraje + listar CFDIs disponibles |
| `proyecto.ts` | CRUD de crédito por proyecto + subir documentos + verificar proveedor |
| `admin.ts` | Ver todas las solicitudes, cambiar estatus, agregar notas, descargar docs |
| `dashboard.ts` | Resumen del dashboard, conectar SAT (`connectSyntageAction`), cerrar sesión |
| `inteligencia.ts` | Ingresos, gastos, CxC, CxP, análisis DSO/DPO — todo desde tabla `cfdis` |
| `clientes.ts` | Listar y detallar clientes (CFDIs emitidos) |
| `proveedores.ts` | Listar y detallar proveedores (CFDIs recibidos) |
| `onboarding.ts` | Guardar cada paso del onboarding |
| `email.ts` | Enviar emails de notificación vía Resend (fire-and-forget) |
| `sync-cfdis.ts` | Invocar edge function `sync-cfdis` (llamado en background al cargar dashboard) |

---

## Edge Functions

Viven en `supabase/functions/`. Corren en Deno en los servidores de Supabase.

| Función | Cuándo se llama | Qué hace |
|---------|----------------|---------|
| `syntage-connect` | Onboarding paso 2 (CIEC) | Crea credencial en Syntage, poll hasta valid/invalid, guarda `estatus_sat` y `credential_id`, dispara extracciones |
| `sync-cfdis` | Al entrar a Clientes / Proveedores / Inteligencia (background) | Descarga todos los CFDIs de Syntage (paginado 300/página) y hace upsert en tabla `cfdis` |
| `sync-sat-data` | Manual o programado | Dispara extracción de facturas y declaraciones anuales en Syntage |
| `get-dashboard-data` | `/dashboard` | Agrega resumen financiero del dashboard |
| `get-proveedores-data` | `/dashboard/proveedores` | Lista proveedores con montos totales |
| `get-proveedor-data` | `/dashboard/proveedores/[id]` | Detalle de un proveedor |
| `get-client-data` | `/dashboard/clientes/[id]` | Detalle de un cliente |
| `get-bi-data` | `/dashboard/inteligencia` | Tendencias 12 meses, concentración, antigüedad |
| `analyze-contract` | Al subir un contrato | Analiza PDF con IA, guarda resultado en `contracts` |
| `ask-contract` | Página de detalle de contrato | Q&A sobre contenido del contrato vía IA |
| `debug-reset-syntage` | Solo en desarrollo | Resetea estado de Syntage en una empresa |

### Variables de entorno requeridas en las edge functions
```
SUPABASE_URL                (automático en Supabase)
SUPABASE_ANON_KEY           (automático en Supabase)
SUPABASE_SERVICE_ROLE_KEY   (automático en Supabase)
SYNTAGE_API_KEY             → npx supabase secrets set SYNTAGE_API_KEY=...
SYNTAGE_BASE_URL            → npx supabase secrets set SYNTAGE_BASE_URL=https://api.syntage.com
```

---

## Integración con Syntage

Syntage es el proveedor que conecta con el SAT para obtener CFDIs en tiempo real.

### Flujo completo

```
1. Usuario ingresa CIEC en onboarding
      ↓
2. syntage-connect (edge function)
   - POST /credentials { type: 'ciec', rfc, password }
   - Poll GET /credentials/{id} hasta status = valid|invalid
   - GET /entities?taxpayer.id={rfc} → obtiene entity_id
   - Guarda en companies: credential_id, estatus_sat='Activo', syntage_validated_at
   - POST /extractions { entity, extractor: 'invoice' }
   - POST /extractions { entity, extractor: 'annual_tax_return' }
      ↓
3. Usuario entra al dashboard (clientes/proveedores/inteligencia)
      ↓
4. sync-cfdis (edge function, fire-and-forget)
   - GET /taxpayers/{rfc}/invoices?isIssuer=true&type=I  (emitidos)
   - GET /taxpayers/{rfc}/invoices?isReceiver=true&type=I (recibidos)
   - Paginación automática (300 items/página)
   - UPSERT en tabla cfdis (conflict: company_id, cfdi_uuid)
      ↓
5. Todas las páginas leen de la tabla cfdis local
   - Inteligencia → cxc, cxp, ingresos, gastos, DSO, DPO
   - Factoraje → CFDIs disponibles para descontar
   - Clientes/Proveedores → agrupado por RFC
```

### Estado actual (Mar 2026)
- Código completo y desplegado
- Falta configurar `SYNTAGE_API_KEY` y `SYNTAGE_BASE_URL` como secrets en Supabase

---

## Módulos de crédito

### Crédito por Proyecto (`tipo_credito = 'proyecto'`)

Financiamiento contra una orden de compra o contrato con un cliente (pagador final).

**Wizard (2 pasos):**
1. Datos del proyecto: descripción, monto total, porcentaje de anticipo (80/85/90%), plazo, datos del pagador final
2. Subir documentos: orden de compra + correo de confirmación del pagador

**Lógica de aprobación:**
- ≤ $2M MXN → auto-aprobado
- > $2M MXN → entra a revisión del analista

**Verificación de proveedores:**
- El usuario registra a quién le va a pagar y por cuánto (CLABE + RFC)
- El analista verifica la CLABE y el RFC antes de liberar fondos

### Factoraje (`tipo_credito = 'factoraje'`)

Adelanto de liquidez sobre facturas (CFDIs) ya emitidas y pendientes de cobro.

**Wizard (2 pasos):**
1. Seleccionar facturas: tabla de CFDIs disponibles (emitidos, vigentes, con saldo pendiente), búsqueda por deudor/RFC/UUID, total en tiempo real
2. Configurar: aforo (80/85/90%), opción de notificar al deudor, aceptar términos

**Lógica:**
- `monto_a_dispersar = due_amount × aforo_pct / 100`
- ≤ $2M MXN → auto-aprobado
- CFDIs disponibles: `issuer_rfc = company.rfc`, `cfdi_type = 'I'`, `cfdi_status = 'vigente'`, `due_amount > 0`

---

## Panel de Admin

Acceso: `UPDATE public.profiles SET role = 'admin' WHERE id = 'USER_UUID';`

**Funcionalidades:**
- KPIs en tiempo real: por revisar, cartera activa, docs pendientes, total solicitudes
- Filtros: búsqueda por empresa/RFC, por estatus, por tipo de crédito
- Cambio de estatus con notas al cliente (envía email automático)
- Descarga de documentos adjuntos
- Verificación de proveedores (CLABE + RFC)
- Análisis financiero de la empresa (DSO, DPO, concentración)
- Vista de CFDIs seleccionados en solicitudes de factoraje

**Estatus que disparan email al cliente:**
- `aprobado` → email de aprobación con monto
- `rechazado` → email con motivo
- `docs_pendientes` → email con instrucciones y notas del analista
- `fondos_liberados` → email de confirmación

---

## Arquitectura de código

El código sigue un patrón de capas en el directorio `features/`:

```
features/
├── admin/
├── auth/
├── dashboard/
└── onboarding/
    ├── repositories/     ← Acceso a DB (interfaces + implementaciones Supabase)
    ├── services/         ← Lógica de negocio
    ├── schemas/          ← Validación (Zod)
    └── types/            ← Tipos TypeScript
```

**Regla general:**
- `features/*/repositories/` → queries a Supabase
- `features/*/services/` → lógica de negocio
- `app/actions/` → server actions que usan los services
- `app/**/page.tsx` → UI que llama server actions

Los módulos más nuevos (factoraje, proyecto) fueron escritos directamente en `app/actions/` sin pasar por `features/` para ir más rápido — se puede refactorizar después si el equipo crece.

---

## Middleware

`middleware.ts` corre en cada request (excepto assets estáticos):

1. **Refresca el token de Supabase** (obligatorio con `@supabase/ssr`)
2. **Protege rutas**: `/dashboard`, `/onboarding`, `/credito`, `/admin` requieren auth
3. **Guard de admin**: `/admin` requiere `role = 'admin'`
4. **Guard de onboarding**: impide saltar pasos

> **Regla crítica**: No poner ninguna lógica entre `createServerClient()` y `supabase.auth.getUser()` — el `getUser()` debe llamarse inmediatamente para que el refresh funcione.

---

## Pendientes conocidos

| Área | Tarea | Prioridad |
|------|-------|-----------|
| Syntage | Configurar `SYNTAGE_API_KEY` y `SYNTAGE_BASE_URL` como secrets | Alta |
| Emails | Configurar `RESEND_API_KEY` en producción | Media |
| Firma electrónica | Reemplazar checkbox por FIEL SAT o DocuSign | Futura |
| Tests | No hay tests aún — agregar al menos tests de server actions críticas | Futura |
