-- ============================================================
-- AccesaX — Schema inicial
-- Corre este archivo completo en el SQL Editor de Supabase
-- (Database > SQL Editor > New query)
-- ============================================================


-- ============================================================
-- 1. TABLA: companies
-- ============================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_razon_social   TEXT          NOT NULL,
  rfc                   TEXT          NOT NULL,
  industria             TEXT,
  tamano_empresa        TEXT,
  -- Datos retornados por Syntage
  estatus_sat           TEXT,
  regimen_fiscal        TEXT,
  syntage_validated_at  TIMESTAMPTZ,
  syntage_raw_response  JSONB,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS companies_user_id_idx ON public.companies (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS companies_user_rfc_idx ON public.companies (user_id, rfc);


-- ============================================================
-- 2. TABLA: contracts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contracts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nombre_cliente    TEXT          NOT NULL,
  monto_contrato    NUMERIC(18,2),
  fecha_inicio      DATE,
  fecha_fin         DATE,
  storage_path      TEXT,                          -- ruta en Supabase Storage
  analysis_status   TEXT          NOT NULL DEFAULT 'pending'
                                  CHECK (analysis_status IN ('pending','processing','completed','error')),
  analysis_result   JSONB,
  analyzed_at       TIMESTAMPTZ,
  uploaded_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS contracts_company_id_idx ON public.contracts (company_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx     ON public.contracts (analysis_status);


-- ============================================================
-- 3. ROW LEVEL SECURITY — companies
-- ============================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- SELECT: solo los propios registros
CREATE POLICY "companies_select_own"
  ON public.companies
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: solo puede insertar con su propio user_id
CREATE POLICY "companies_insert_own"
  ON public.companies
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: solo sus propios registros
CREATE POLICY "companies_update_own"
  ON public.companies
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: solo sus propios registros
CREATE POLICY "companies_delete_own"
  ON public.companies
  FOR DELETE
  USING (user_id = auth.uid());


-- ============================================================
-- 4. ROW LEVEL SECURITY — contracts
-- ============================================================

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- SELECT: solo contratos de empresas que le pertenecen al usuario
CREATE POLICY "contracts_select_own"
  ON public.contracts
  FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- INSERT: solo puede insertar en sus propias empresas
CREATE POLICY "contracts_insert_own"
  ON public.contracts
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- UPDATE: solo sus contratos
CREATE POLICY "contracts_update_own"
  ON public.contracts
  FOR UPDATE
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- DELETE: solo sus contratos
CREATE POLICY "contracts_delete_own"
  ON public.contracts
  FOR DELETE
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );


-- ============================================================
-- 5. STORAGE — bucket "contracts"
-- ============================================================

-- Crear el bucket (privado: public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  52428800,           -- 50 MB máximo por archivo
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;


-- Política de UPLOAD: cada usuario solo puede subir a su propia carpeta
-- Convención de ruta: contracts/{user_id}/{filename}
CREATE POLICY "storage_contracts_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Política de SELECT (descarga/lectura)
CREATE POLICY "storage_contracts_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Política de DELETE
CREATE POLICY "storage_contracts_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );


-- ============================================================
-- FIN — Verifica con las queries de abajo
-- ============================================================

-- Verificar tablas creadas:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Verificar RLS habilitado:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Verificar políticas:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';

-- Verificar bucket:
-- SELECT id, name, public FROM storage.buckets WHERE id = 'contracts';
