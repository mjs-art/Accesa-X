# Lineamientos: Clean Architecture + SOLID — AccesaX

**Stack:** Next.js 14 (App Router) + Supabase + TypeScript + Zod
**Organización:** Por feature (no por tipo técnico)

---

## Regla de dependencia (el principio más importante)

Las dependencias SIEMPRE apuntan hacia adentro. Las capas internas no saben nada de las capas externas:

```
Presentación (app/ pages, components/)
      ↓ depende de
Aplicación (features/*/services/)
      ↓ depende de
Dominio (features/*/types/ + repositories interfaces)
      ↑ implementado por
Infraestructura (features/*/repositories/*.impl.ts → Supabase)
```

**Nunca al revés.** Un servicio no importa de un componente. Un repositorio no importa de un servicio.

---

## Estructura de carpetas

```
features/
├── auth/
│   ├── repositories/
│   │   ├── auth.repository.ts          ← interface IAuthRepository
│   │   └── auth.repository.impl.ts     ← SupabaseAuthRepository implements IAuthRepository
│   ├── services/
│   │   └── auth.service.ts
│   └── types/
│       └── auth.types.ts
├── onboarding/
│   ├── repositories/
│   │   ├── company.repository.ts       ← interface
│   │   ├── company.repository.impl.ts  ← implementación Supabase
│   │   └── ...
│   ├── services/
│   │   └── onboarding.service.ts
│   ├── schemas/                        ← Zod schemas de validación
│   │   ├── company.schema.ts
│   │   ├── legal-rep.schema.ts
│   │   └── shareholder.schema.ts
│   └── types/
│       └── onboarding.types.ts
├── dashboard/
│   └── ...
└── admin/
    └── ...

app/
├── actions/                            ← Server Actions (capa delgada)
│   ├── onboarding.ts
│   └── send-invitation.ts
└── onboarding/, dashboard/, admin/     ← solo UI

components/
├── ui/                                 ← shadcn/ui, sin cambios
└── onboarding/                         ← componentes compartidos de feature

lib/
└── supabase/
    ├── client.ts                       ← sin cambios
    └── server.ts                       ← sin cambios
```

---

## Las 4 capas

### 1. Dominio (`features/*/types/`)

Define qué son las entidades del negocio. **No tiene dependencias externas** (sin Supabase, sin Next.js, sin Zod).

```typescript
// features/onboarding/types/onboarding.types.ts
export type OnboardingStep =
  | 'empresa'
  | 'verificacion-fiscal'
  | 'legal-rep'
  | 'legal-rep-docs'
  | 'shareholders'
  | 'company-docs'
  | 'confirmation'
  | 'completed'

export interface Company {
  id: string
  userId: string
  nombreRazonSocial: string
  rfc: string
  industria: string
  tamanoEmpresa: string
  onboardingStep: OnboardingStep
  onboardingCompleted: boolean
  onboardingCompletedAt: string | null
  createdAt: string
}
```

**Reglas:**
- Solo tipos, interfaces y enums
- Sin imports de librerías externas
- Nombres en camelCase (se mapean desde snake_case de Supabase en los repositorios)

---

### 2. Infraestructura — Interfaces de Repositorios (`features/*/repositories/*.repository.ts`)

Define el **contrato** de acceso a datos. La interfaz vive en el dominio; la implementación es infraestructura.

```typescript
// features/onboarding/repositories/company.repository.ts
import type { Company, OnboardingStep } from '../types/onboarding.types'

export interface ICompanyRepository {
  findByUserId(userId: string): Promise<Company | null>
  create(data: CreateCompanyInput): Promise<Company>
  updateOnboardingStep(companyId: string, step: OnboardingStep): Promise<void>
  markOnboardingComplete(companyId: string): Promise<void>
}

export interface CreateCompanyInput {
  userId: string
  nombreRazonSocial: string
  rfc: string
  industria: string
  tamanoEmpresa: string
}
```

---

### 3. Infraestructura — Implementaciones (`features/*/repositories/*.repository.impl.ts`)

Implementa la interfaz usando Supabase. **Solo esta capa conoce Supabase**.

```typescript
// features/onboarding/repositories/company.repository.impl.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ICompanyRepository, CreateCompanyInput } from './company.repository'
import type { Company, OnboardingStep } from '../types/onboarding.types'

export class SupabaseCompanyRepository implements ICompanyRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByUserId(userId: string): Promise<Company | null> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('id, user_id, nombre_razon_social, rfc, industria, tamano_empresa, onboarding_step, onboarding_completed, onboarding_completed_at, created_at')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (error || !data) return null

    return this.toDomain(data)
  }

  async create(input: CreateCompanyInput): Promise<Company> {
    const { data, error } = await this.supabase
      .from('companies')
      .insert({
        user_id: input.userId,
        nombre_razon_social: input.nombreRazonSocial.trim(),
        rfc: input.rfc.toUpperCase().trim(),
        industria: input.industria,
        tamano_empresa: input.tamanoEmpresa,
      })
      .select()
      .single()

    if (error) throw new Error(error.code === '23505' ? 'RFC_DUPLICATE' : error.message)
    return this.toDomain(data)
  }

  async updateOnboardingStep(companyId: string, step: OnboardingStep): Promise<void> {
    const { error } = await this.supabase
      .from('companies')
      .update({ onboarding_step: step })
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  }

  async markOnboardingComplete(companyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('companies')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 'completed',
      })
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  }

  // Mapear snake_case de DB a camelCase del dominio
  private toDomain(row: Record<string, unknown>): Company {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      nombreRazonSocial: row.nombre_razon_social as string,
      rfc: row.rfc as string,
      industria: row.industria as string,
      tamanoEmpresa: row.tamano_empresa as string,
      onboardingStep: (row.onboarding_step as OnboardingStep) ?? 'empresa',
      onboardingCompleted: row.onboarding_completed as boolean ?? false,
      onboardingCompletedAt: row.onboarding_completed_at as string | null,
      createdAt: row.created_at as string,
    }
  }
}
```

**Reglas:**
- El mapeo `snake_case → camelCase` ocurre aquí, nunca en los componentes
- Los errores se convierten en `Error` con mensajes semánticos (ej: `'RFC_DUPLICATE'`), nunca códigos de Supabase
- No hay lógica de negocio aquí — solo acceso a datos

---

### 4. Aplicación — Servicios (`features/*/services/`)

Orquesta los repositorios para cumplir casos de uso. **No conoce Supabase ni Next.js**.

```typescript
// features/onboarding/services/onboarding.service.ts
import type { ICompanyRepository } from '../repositories/company.repository'
import type { Company, OnboardingStep } from '../types/onboarding.types'
import type { CompanyFormData } from '../schemas/company.schema'

export class OnboardingService {
  constructor(private readonly companyRepo: ICompanyRepository) {}

  async saveEmpresa(userId: string, data: CompanyFormData): Promise<Company> {
    // Lógica de negocio: verificar que no tenga ya empresa
    const existing = await this.companyRepo.findByUserId(userId)
    if (existing) {
      throw new Error('COMPANY_ALREADY_EXISTS')
    }
    return this.companyRepo.create({ userId, ...data })
  }

  async getCurrentStep(userId: string): Promise<OnboardingStep> {
    const company = await this.companyRepo.findByUserId(userId)
    return company?.onboardingStep ?? 'empresa'
  }
}
```

**Reglas:**
- Recibe repositorios vía constructor (Dependency Injection → principio D de SOLID)
- Lanza errores con mensajes semánticos, no de infraestructura
- Un método = un caso de uso

---

### 5. Presentación — Server Actions (`app/actions/`)

Capa delgada que conecta el formulario con el servicio. **Valida con Zod, llama al servicio, retorna resultado**.

```typescript
// app/actions/onboarding.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { companySchema } from '@/features/onboarding/schemas/company.schema'
import { OnboardingService } from '@/features/onboarding/services/onboarding.service'
import { SupabaseCompanyRepository } from '@/features/onboarding/repositories/company.repository.impl'

export async function saveEmpresaAction(formData: unknown) {
  // 1. Validar con Zod
  const parsed = companySchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // 2. Obtener usuario autenticado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // 3. Llamar al servicio
  try {
    const repo = new SupabaseCompanyRepository(supabase)
    const service = new OnboardingService(repo)
    const company = await service.saveEmpresa(user.id, parsed.data)
    return { success: true, company }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    if (msg === 'RFC_DUPLICATE') {
      return { error: 'Ya existe una empresa registrada con ese RFC.' }
    }
    return { error: 'Error al guardar. Intenta de nuevo.' }
  }
}
```

**Reglas:**
- Siempre `'use server'`
- Validar con Zod **antes** de llamar al servicio
- Solo retornar `{ success, data }` o `{ error }`, nunca lanzar excepciones al cliente
- No lógica de negocio aquí

---

### 6. Presentación — Componentes y Páginas (`app/`, `components/`)

Solo UI. Llaman a Server Actions o servicios. **Sin queries a Supabase directas**.

```typescript
// app/onboarding/empresa/page.tsx
'use client'
import { saveEmpresaAction } from '@/app/actions/onboarding'

export default function EmpresaPage() {
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await saveEmpresaAction(form)
    if (result.error) {
      setError(typeof result.error === 'string' ? result.error : 'Error de validación')
      return
    }
    router.push('/onboarding/verificacion-fiscal')
  }
  // ... solo JSX/UI
}
```

---

## Schemas Zod (`features/*/schemas/`)

Los schemas Zod son compartidos entre cliente (validación en tiempo real) y servidor (Server Actions).

```typescript
// features/onboarding/schemas/company.schema.ts
import { z } from 'zod'

export const companySchema = z.object({
  nombreRazonSocial: z.string().min(3, 'Mínimo 3 caracteres'),
  rfc: z.string().regex(
    /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i,
    'RFC inválido — 12 chars persona moral, 13 persona física'
  ),
  industria: z.string().min(1, 'Selecciona una industria'),
  tamanoEmpresa: z.string().min(1, 'Selecciona el tamaño'),
})

export type CompanyFormData = z.infer<typeof companySchema>
```

---

## Principios SOLID en este proyecto

### S — Single Responsibility
Cada archivo tiene una sola razón para cambiar:
- `company.repository.impl.ts` cambia si cambia el esquema de la tabla `companies`
- `onboarding.service.ts` cambia si cambia la lógica de negocio del onboarding
- `empresa/page.tsx` cambia si cambia la UI del paso 1
- `company.schema.ts` cambia si cambian las reglas de validación

### O — Open/Closed
Para agregar un nuevo proveedor de datos (ej: REST API en lugar de Supabase):
1. Crear `RestCompanyRepository implements ICompanyRepository`
2. Pasar la nueva implementación al `OnboardingService`
3. **No tocar** `OnboardingService` ni la página

### L — Liskov Substitution
Cualquier implementación de `ICompanyRepository` puede reemplazar a otra sin que el servicio falle. Esto permite mocking en tests:
```typescript
const mockRepo: ICompanyRepository = {
  findByUserId: async () => null,
  create: async (data) => ({ id: 'test', ...data }),
  // ...
}
const service = new OnboardingService(mockRepo) // funciona igual
```

### I — Interface Segregation
Las interfaces son pequeñas y específicas. `ILegalRepRepository` no expone métodos de shareholders. Los componentes importan solo lo que necesitan.

### D — Dependency Inversion
Los servicios dependen de **interfaces** (abstracciones), no de implementaciones concretas:
```typescript
// CORRECTO
class OnboardingService {
  constructor(private repo: ICompanyRepository) {} // interfaz
}

// INCORRECTO (acopla al servicio a Supabase)
class OnboardingService {
  constructor(private repo: SupabaseCompanyRepository) {} // implementación concreta
}
```

---

## Anti-patrones prohibidos

| Anti-patrón | Por qué está mal | Solución |
|---|---|---|
| `supabase.from('companies').select()` en un componente | Mezcla presentación e infraestructura | Usar Server Action que llame al repositorio |
| Tipos inline en componentes (`interface Company { ... }`) | Duplicación, divergencia | Importar de `features/*/types/` |
| Manejo de errores con códigos de Supabase en UI (`insertError.code === '23505'`) | Acopla UI a infraestructura | El repositorio convierte el error a semántico (`RFC_DUPLICATE`) |
| Instanciar `SupabaseCompanyRepository` en un componente cliente | Expone lógica de server al cliente | Solo instanciar en Server Actions o Server Components |
| Validación con regex inline en componentes | Reglas duplicadas, no reutilizables | Usar Zod schema compartido |
| `(data as unknown as MyType[])` | Ignora el sistema de tipos | Mapear correctamente en `toDomain()` del repositorio |

---

## Convenciones de naming

| Elemento | Convención | Ejemplo |
|---|---|---|
| Interfaz de repositorio | `I{Entidad}Repository` | `ICompanyRepository` |
| Implementación Supabase | `Supabase{Entidad}Repository` | `SupabaseCompanyRepository` |
| Servicio | `{Feature}Service` | `OnboardingService` |
| Zod schema | `{entidad}Schema` | `companySchema` |
| Zod inferred type | `{Entidad}FormData` | `CompanyFormData` |
| Server Action | `{accion}{Entidad}Action` | `saveEmpresaAction` |
| Tipos de dominio | PascalCase | `Company`, `OnboardingStep` |
| Campos de dominio | camelCase | `nombreRazonSocial`, `onboardingStep` |
| Campos de DB | snake_case | Solo en repositorios (mapear en `toDomain`) |

---

## Cómo agregar una nueva feature

1. Crear carpeta `features/{nombre}/`
2. Crear `types/{nombre}.types.ts` con las entidades de dominio
3. Crear `schemas/{entidad}.schema.ts` con Zod schema
4. Crear `repositories/{entidad}.repository.ts` con la interfaz
5. Crear `repositories/{entidad}.repository.impl.ts` con la implementación Supabase
6. Crear `services/{nombre}.service.ts` con los casos de uso
7. Crear Server Action en `app/actions/{nombre}.ts` (valida Zod + llama al servicio)
8. Crear la página en `app/{nombre}/page.tsx` (solo UI + llama al action)

---

## Reglas de imports

```typescript
// features/*/types/    → sin imports externos
// features/*/schemas/  → solo import de 'zod'
// features/*/repositories/*.ts (interfaces) → solo import de '../types/'
// features/*/repositories/*.impl.ts → import de '@supabase/supabase-js' + '../types/' + './interface'
// features/*/services/ → import de '../repositories/' (interfaces) + '../types/' + '../schemas/'
// app/actions/         → import de '@/lib/supabase/server' + '@/features/*/services/' + '@/features/*/schemas/' + '@/features/*/repositories/*.impl'
// app/pages/           → import de '@/app/actions/' + '@/components/' + 'react'
// components/          → import de '@/components/ui/' + 'react' + 'lucide-react'
```

---

## Sobre las Supabase Edge Functions

Las Edge Functions (`supabase/functions/`) NO se migran a este patrón. Son funciones Deno independientes para lógica que requiere secretos del servidor (Syntage, SAT, IA). Los servicios/repositorios pueden invocarlas via `supabase.functions.invoke()`.

---

*Stack: Next.js 14 App Router + Supabase + TypeScript + Zod | Organización: feature-first*
