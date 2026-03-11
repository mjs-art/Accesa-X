# Syntage Integration Spec — AccesaX

**Para:** Equipo de desarrollo
**Fecha:** 2026-03-10
**Contexto:** AccesaX necesita cachear CFDIs del SAT (vía Syntage) en Supabase para alimentar el módulo de Inteligencia de Negocio y el flujo de Descuento de Facturas.

---

## Arquitectura general

```
Syntage API
    │
    ▼
Route Handler (Next.js)          ← llamado por el botón "Sincronizar SAT"
app/api/sync-sat/route.ts            o por un cron job periódico
    │
    ▼
Tabla `cfdis` en Supabase        ← caché local de todos los CFDIs
    │
    ▼
Módulos que consumen la tabla:
  - Inteligencia de Negocio (BI)
  - Descuento de Facturas (factoraje)
  - Sección de Clientes
  - Sección de Proveedores
```

El flujo actual en el codebase ya tiene `syncSatDataAction()` en `app/actions/dashboard.ts` — esa función es el punto de entrada donde deben conectar Syntage.

---

## 1. Autenticación con Syntage

Cada empresa en AccesaX tiene credenciales de Syntage guardadas en la tabla `companies`:

```ts
companies.syntage_credential_id  // ID de credencial en Syntage
```

La autenticación de Syntage usa esas credenciales para hacer requests en nombre de la empresa (RFC específico).

**Variables de entorno necesarias:**
```bash
SYNTAGE_API_KEY=           # API key de AccesaX como integrador
SYNTAGE_BASE_URL=          # URL base de la API de Syntage
```

---

## 2. Endpoints a consumir

### 2.1 Lista de CFDIs emitidos (Ingresos / Clientes)

```
GET /cfdis?isIssuer=true&type=I&status=vigente&dateFrom=YYYY-MM-DD
```

**Cuándo:** Al sincronizar. Trae todas las facturas que la empresa emitió a sus clientes.
**Para qué:** Módulo de Ingresos, tabla de Clientes, Cuentas por Cobrar, Descuento de Facturas.

**Campos requeridos en la respuesta:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `uuid` | string | UUID del CFDI (36 chars, formato SAT) |
| `issuer.rfc` | string | RFC del emisor (la empresa del usuario) |
| `issuer.name` | string | Razón social del emisor |
| `receiver.rfc` | string | RFC del receptor (el cliente) |
| `receiver.name` | string | Razón social del cliente |
| `receiver.blacklistStatus` | string\|null | Estado en lista negra 69-B |
| `subtotal` | number | Subtotal antes de impuestos |
| `total` | number | Total con impuestos |
| `paidAmount` | number | Monto pagado acumulado (de complementos de pago) |
| `dueAmount` | number | Monto pendiente por cobrar |
| `fullyPaidAt` | string\|null | ISO timestamp de cuando quedó saldada. `null` si aún debe |
| `issuedDate` | string | ISO timestamp de emisión |
| `status` | string | `"vigente"` o `"cancelado"` |
| `concepts[0].claveProdServ` | string | Clave SAT del producto/servicio principal |
| `concepts[0].description` | string | Descripción del concepto principal |

---

### 2.2 Lista de CFDIs recibidos (Gastos / Proveedores)

```
GET /cfdis?isReceiver=true&type=I&status=vigente&dateFrom=YYYY-MM-DD
```

**Cuándo:** Al sincronizar, en el mismo batch que los emitidos.
**Para qué:** Módulo de Gastos, tabla de Proveedores, Cuentas por Pagar.

**Campos requeridos:** Los mismos que 2.1. En este caso `issuer` = proveedor, `receiver` = la empresa del usuario.

Campo adicional:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `issuer.blacklistStatus` | string\|null | Estado 69-B del proveedor |

---

### 2.3 Complementos de Pago (determina qué está cobrado vs pendiente)

```
GET /cfdis?isIssuer=true&type=P&dateFrom=YYYY-MM-DD
```

**Cuándo:** Al sincronizar, junto con los anteriores.
**Para qué:** Actualizar `paidAmount`, `dueAmount` y `fullyPaidAt` en los CFDIs de ingreso. Sin esto, las Cuentas por Cobrar no son precisas.

**Campos requeridos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `uuid` | string | UUID del complemento de pago |
| `issuedDate` | string | Fecha del complemento |
| `relatedDocuments` | array | CFDIs a los que aplica este pago |
| `relatedDocuments[].uuid` | string | UUID del CFDI original |
| `relatedDocuments[].paidAmount` | number | Cuánto se pagó en este complemento |
| `relatedDocuments[].partialityNumber` | number | Número de parcialidad |

---

### 2.4 Validación de RFC individual

```
GET /rfc/{rfc}
```

**Cuándo:** Cuando el usuario agrega un cliente o proveedor nuevo que no aparece en su historial SAT (alta manual en el wizard de crédito por proyecto).
**Para qué:** Verificar que el RFC existe y obtener razón social sin que el usuario la escriba a mano.

**Campos requeridos en la respuesta:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `rfc` | string | RFC validado |
| `razonSocial` | string | Nombre o razón social |
| `regimenFiscal` | string | Régimen fiscal del contribuyente |
| `estatus` | string | `"activo"` o `"cancelado"` |
| `blacklistStatus` | string\|null | Estado en lista negra 69-B |
| `tipo` | string | `"persona_moral"` o `"persona_fisica"` |

**Respuesta esperada si no existe:**
```json
{ "error": "RFC_NOT_FOUND" }
```

---

## 3. Lógica de sincronización

### Función principal: `syncSatDataAction()`

Ubicación: `app/actions/dashboard.ts`

El flujo debe ser:

```
1. Obtener company del usuario (user_id → company_id, syntage_credential_id, rfc)
2. Calcular dateFrom:
     - Primera sync: hace 2 años
     - Syncs siguientes: desde el max(synced_at) de la tabla cfdis para esa company
3. Llamar en paralelo:
     - GET /cfdis?isIssuer=true&type=I&...
     - GET /cfdis?isReceiver=true&type=I&...
     - GET /cfdis?isIssuer=true&type=P&...
4. Para cada CFDI recibido → upsert en tabla `cfdis` usando (company_id, cfdi_uuid) como clave única
5. Actualizar companies.syntage_validated_at = NOW()
6. Retornar { synced: N } con el conteo de CFDIs procesados
```

### Upsert a la tabla `cfdis`

```ts
await supabase
  .from('cfdis')
  .upsert(
    cfdis.map(cfdi => ({
      company_id,
      cfdi_uuid:        cfdi.uuid,
      cfdi_type:        cfdi.type,          // 'I' | 'E' | 'P' | 'N'
      issuer_rfc:       cfdi.issuer.rfc,
      issuer_name:      cfdi.issuer.name,
      receiver_rfc:     cfdi.receiver.rfc,
      receiver_name:    cfdi.receiver.name,
      subtotal:         cfdi.subtotal,
      total:            cfdi.total,
      paid_amount:      cfdi.paidAmount ?? 0,
      due_amount:       cfdi.dueAmount,
      fully_paid_at:    cfdi.fullyPaidAt ?? null,
      issued_at:        cfdi.issuedDate,
      cfdi_status:      cfdi.status,
      blacklist_status: cfdi.receiver?.blacklistStatus ?? cfdi.issuer?.blacklistStatus ?? null,
      clav_prod_serv:   cfdi.concepts?.[0]?.claveProdServ ?? null,
      descripcion:      cfdi.concepts?.[0]?.description ?? null,
      raw_json:         cfdi,               // guardar respuesta completa
      synced_at:        new Date().toISOString(),
    })),
    { onConflict: 'company_id,cfdi_uuid' }
  )
```

---

## 4. Schema de la tabla `cfdis` en Supabase

Ya creado en la migración `006_bi_and_credit_v2.sql`. Columnas clave:

```sql
company_id        UUID     -- FK a companies
cfdi_uuid         TEXT     -- UUID del SAT (UNIQUE per company)
cfdi_type         TEXT     -- 'I' | 'E' | 'P' | 'N'
issuer_rfc        TEXT
issuer_name       TEXT
receiver_rfc      TEXT
receiver_name     TEXT
subtotal          NUMERIC(18,2)
total             NUMERIC(18,2)
paid_amount       NUMERIC(18,2)
due_amount        NUMERIC(18,2)
fully_paid_at     TIMESTAMPTZ   -- null = sin pagar
issued_at         TIMESTAMPTZ
cfdi_status       TEXT     -- 'vigente' | 'cancelado'
blacklist_status  TEXT     -- null = limpio
clav_prod_serv    TEXT
descripcion       TEXT
raw_json          JSONB    -- respuesta completa de Syntage
synced_at         TIMESTAMPTZ
```

**Índices ya creados:** `company_id`, `cfdi_type`, `issued_at`, `issuer_rfc`, `receiver_rfc`, `cfdi_status`, `due_amount > 0`

---

## 5. Queries que el BI va a usar (referencia)

Una vez que la tabla tenga datos, estas son las queries principales:

```sql
-- Ingresos totales últimos 12 meses
SELECT SUM(total) FROM cfdis
WHERE company_id = $1
  AND cfdi_type = 'I'
  AND cfdi_status = 'vigente'
  AND issued_at >= NOW() - INTERVAL '12 months'
  AND issuer_rfc = (SELECT rfc FROM companies WHERE id = $1);

-- Cuentas por cobrar (factoraje)
SELECT receiver_rfc, receiver_name, SUM(due_amount) as total_pendiente,
       COUNT(*) as num_facturas, MIN(issued_at) as factura_mas_antigua
FROM cfdis
WHERE company_id = $1
  AND cfdi_type = 'I'
  AND cfdi_status = 'vigente'
  AND due_amount > 0
  AND fully_paid_at IS NULL
  AND issuer_rfc = (SELECT rfc FROM companies WHERE id = $1)
GROUP BY receiver_rfc, receiver_name
ORDER BY total_pendiente DESC;

-- Top proveedores
SELECT issuer_rfc, issuer_name, SUM(total) as total_pagado, COUNT(*) as num_facturas
FROM cfdis
WHERE company_id = $1
  AND cfdi_type = 'I'
  AND cfdi_status = 'vigente'
  AND receiver_rfc = (SELECT rfc FROM companies WHERE id = $1)
GROUP BY issuer_rfc, issuer_name
ORDER BY total_pagado DESC
LIMIT 10;
```

---

## 6. Manejo de errores esperados

| Error | Causa probable | Qué hacer |
|-------|---------------|-----------|
| `401 Unauthorized` | `syntage_credential_id` inválido o expirado | Redirigir al usuario a reverificar en `/dashboard/verificacion-fiscal` |
| `404 Not Found` en RFC | RFC no existe en SAT | Mostrar error en el form: "RFC no encontrado en el SAT" |
| `RFC en lista negra` | `blacklistStatus !== null` | Mostrar advertencia visible al usuario antes de continuar |
| Timeout en sync | Muchos CFDIs (>1000) | Implementar paginación en la llamada; sync en background si es posible |
| CFDI duplicado | Re-sync del mismo período | El `upsert` con `onConflict` lo maneja automáticamente |

---

## 7. Prioridad de implementación

```
P0 — Bloquea todo lo demás:
  ✅ Endpoint CFDIs emitidos (isIssuer=true, type=I)
  ✅ Endpoint CFDIs recibidos (isReceiver=true, type=I)

P1 — Necesario para CxC y factoraje:
  ✅ Endpoint complementos de pago (type=P)

P2 — Necesario para alta de clientes/proveedores nuevos:
  ✅ Endpoint validación de RFC (/rfc/{rfc})

P3 — Nice to have:
  ⬜ Webhook para sync en tiempo real (en lugar de pull manual)
```

---

## 8. Archivos relevantes en el codebase

| Archivo | Descripción |
|---------|-------------|
| `app/actions/dashboard.ts` | `syncSatDataAction()` — punto de entrada de la sync |
| `app/api/sync-sat/route.ts` | Route handler HTTP (si se prefiere sobre server action) |
| `supabase/migrations/006_bi_and_credit_v2.sql` | Schema de la tabla `cfdis` y todas las nuevas tablas |
| `features/dashboard/types/dashboard.types.ts` | Tipos TypeScript del dashboard (agregar tipos para CFDI aquí) |

---

## 9. Tipo TypeScript sugerido para la respuesta de Syntage

```ts
// features/cfdis/types/cfdi.types.ts

export type SyntageCFDI = {
  uuid: string
  type: 'I' | 'E' | 'P' | 'N'
  status: 'vigente' | 'cancelado'
  issuedDate: string             // ISO 8601
  subtotal: number
  total: number
  paidAmount?: number
  dueAmount?: number
  fullyPaidAt?: string | null
  issuer: {
    rfc: string
    name: string
    blacklistStatus?: string | null
  }
  receiver: {
    rfc: string
    name: string
    blacklistStatus?: string | null
  }
  concepts?: {
    claveProdServ: string
    description: string
    quantity: number
    unitPrice: number
    amount: number
  }[]
  relatedDocuments?: {           // solo en type=P
    uuid: string
    paidAmount: number
    partialityNumber: number
  }[]
}

export type SyntageRFCLookup = {
  rfc: string
  razonSocial: string
  regimenFiscal: string
  estatus: 'activo' | 'cancelado'
  blacklistStatus: string | null
  tipo: 'persona_moral' | 'persona_fisica'
}
```

---

*Cualquier duda sobre el schema o los queries, contactar al equipo de AccesaX.*
