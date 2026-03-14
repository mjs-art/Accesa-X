-- ============================================================
-- MIGRACIÓN 012: Equipo y Permisos por Empresa
--
-- Cambios:
--   1. Crear tabla company_members (miembros invitados por empresa)
--   2. RLS: solo el owner puede invitar/eliminar/editar roles
--   3. Miembros activos pueden ver la lista del equipo
--
-- Corre en: Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_members (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email text        NOT NULL,
  role          text        NOT NULL DEFAULT 'viewer'
                            CHECK (role IN ('admin', 'viewer')),
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'active')),
  invited_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),

  UNIQUE(company_id, invited_email)
);

-- Índices
CREATE INDEX IF NOT EXISTS company_members_company_idx ON public.company_members (company_id);
CREATE INDEX IF NOT EXISTS company_members_user_idx    ON public.company_members (user_id);
CREATE INDEX IF NOT EXISTS company_members_email_idx   ON public.company_members (invited_email);

-- RLS
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- SELECT: owner de la empresa o miembro activo puede ver la lista
CREATE POLICY "cm_select" ON public.company_members
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
      UNION
      SELECT company_id FROM public.company_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: solo el owner puede invitar
CREATE POLICY "cm_insert" ON public.company_members
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- UPDATE: solo el owner puede cambiar roles o activar (cuando acepta invitación)
CREATE POLICY "cm_update" ON public.company_members
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()   -- el propio usuario puede actualizarse al aceptar
  );

-- DELETE: owner puede eliminar cualquier miembro; miembro puede salir él mismo
CREATE POLICY "cm_delete" ON public.company_members
  FOR DELETE USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );
