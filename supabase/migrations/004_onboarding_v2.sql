-- ============================================================
-- MIGRACIÓN 004: Onboarding V2
-- Extiende tabla companies + crea 6 tablas nuevas para el
-- flujo de 7 pasos: legal rep, documentos, accionistas, etc.
-- ============================================================

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
-- PASO 8: Storage buckets
-- NOTA: Los buckets deben crearse manualmente en Supabase Dashboard
-- o con service_role key. Esta migración NO los crea.
--
-- Buckets requeridos:
--   legal-rep-docs  (10 MB max, privado)
--   shareholder-docs (10 MB max, privado)
--   company-docs    (20 MB max, privado)
-- Formatos permitidos: PDF, JPG, PNG, HEIC
--
-- Políticas de storage (ejecutar después de crear los buckets
-- desde Supabase Dashboard → Storage → Policies):
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
-- Replicar el mismo patrón para 'shareholder-docs' y 'company-docs'
*/
-- ============================================================
