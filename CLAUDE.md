# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build (ESLint ignored via next.config.mjs)
npm run lint     # Run ESLint
npm run start    # Start production server
```

There are no tests in this project yet.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Architecture

**AccesaX** is a Mexican B2B credit platform built with Next.js 14 (App Router), Supabase, and Tailwind CSS + shadcn/ui.

### Route Structure

| Route | Description |
|-------|-------------|
| `/` | Auth page (login/register, Google OAuth) |
| `/auth/callback` | OAuth callback handler |
| `/onboarding/empresa` | Step 1: Company registration (RFC, industry, size) |
| `/onboarding/verificacion-fiscal` | Step 2: SAT/Syntage fiscal validation |
| `/onboarding/contratos` | Step 3: Contract upload |
| `/dashboard` | Main dashboard (financial summary, client list) |
| `/dashboard/clientes/[id]` | Client detail with contracts |
| `/solicitar-credito` | Credit application form |
| `/admin` | Admin panel (requires `role = 'admin'`) |
| `/admin/solicitudes/[id]` | Admin: credit application detail |
| `/admin/empresas` | Admin: company listing |

### Auth & Middleware

`middleware.ts` runs on every request (except static assets). It:
1. Refreshes the Supabase session token on every request (mandatory with `@supabase/ssr`)
2. Redirects unauthenticated users to `/` for protected paths: `/dashboard`, `/onboarding`, `/solicitar-credito`, `/admin`
3. Redirects non-admin users away from `/admin` to `/dashboard`

**Critical rule**: Do not add any logic between `createServerClient()` and `supabase.auth.getUser()` in the middleware — `getUser()` must be called immediately to refresh tokens.

### Supabase Client Usage

- **Client Components**: `import { createClient } from '@/lib/supabase/client'` — uses `createBrowserClient`
- **Server Components / Route Handlers**: `import { createClient } from '@/lib/supabase/server'` — uses `createServerClient` with cookies from `next/headers`

Always cast Supabase join query results through `unknown` first when TypeScript complains about the data shape (known pattern in this codebase).

### Database Schema

Tables (all with RLS enabled):
- **`profiles`** — one row per user (`id`, `role: 'user'|'admin'`). Auto-created via trigger on `auth.users` insert.
- **`companies`** — company data per user (RFC, industry, Syntage validation fields)
- **`contracts`** — uploaded PDFs per company, with AI analysis status (`pending/processing/completed/error`)
- **`credit_applications`** — credit requests (`tipo_credito: 'empresarial'|'factoraje'|'contrato'`, status field)
- **`internal_notes`** — admin-only notes on credit applications

Admin access is controlled by `public.is_admin()` SQL function. To make a user admin:
```sql
UPDATE public.profiles SET role = 'admin' WHERE id = 'USER_UUID';
```

Storage bucket `contracts` stores PDFs at path `{user_id}/{filename}`, enforced by RLS policies.

### Migrations

SQL migrations live in `supabase/migrations/`. Run them manually in Supabase Dashboard > SQL Editor. The full initial schema is in `supabase/schema.sql`.

### UI Components

All UI primitives come from shadcn/ui (Radix UI under the hood), located in `components/ui/`. Use `cn()` from `@/lib/utils` for conditional class merging.

Brand colors:
- Navy: `#0F2D5E`
- Green (accent/CTA): `#00C896`
- Text muted: `#64748B`

### Key Notes

- Dashboard financial data is currently **mock data** (marked with `TODO` comments) — Syntage API integration is pending.
- ESLint is intentionally ignored during builds (`eslint.ignoreDuringBuilds: true` in `next.config.mjs`).
- Webpack is configured to stub `net`, `tls`, `fs` to prevent Supabase realtime websocket modules from breaking the browser bundle.
- After login, users without a company are redirected to `/onboarding/empresa`; those with one go to `/dashboard`.
