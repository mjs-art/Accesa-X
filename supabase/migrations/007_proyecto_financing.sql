-- ============================================================
-- MIGRACIÓN 007: Financiamiento por Proyectos
--
-- Cambios:
--   1. Extender credit_applications → campos de pagador final,
--      descripción, montos, aprobación, fechas, analista
--   2. Añadir estados: borrador, docs_pendientes
--   3. Extender project_vendors → flags de verificación manual
--   4. Nueva tabla financiamiento_documentos → docs por solicitud
--   5. Crear bucket de storage financiamiento-docs
--
-- Corre en: Supabase Dashboard > SQL Editor
-- ============================================================


-- ============================================================
-- 1. EXTENDER: credit_applications
-- ============================================================

ALTER TABLE public.credit_applications
  -- Proyecto
  ADD COLUMN IF NOT EXISTS descripcion_proyecto     TEXT,
  ADD COLUMN IF NOT EXISTS monto_total              NUMERIC(18,2),   -- valor total del contrato/OC
  -- Pagador final (contacto)
  ADD COLUMN IF NOT EXISTS pagador_contacto_nombre  TEXT,
  ADD COLUMN IF NOT EXISTS pagador_contacto_correo  TEXT,            -- validado como correo corporativo
  -- Aprobación
  ADD COLUMN IF NOT EXISTS auto_aprobado            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS analista_id              UUID    REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS condiciones_aceptadas_at TIMESTAMPTZ,
  -- Fechas del crédito
  ADD COLUMN IF NOT EXISTS fecha_desembolso         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_liquidacion_est    TIMESTAMPTZ,     -- estimada al aprobar
  ADD COLUMN IF NOT EXISTS fecha_liquidacion_real   TIMESTAMPTZ;     -- real cuando el pagador liquida


-- ============================================================
-- 2. ACTUALIZAR STATUS CHECK
--    Añadimos: borrador (draft), docs_pendientes (regresa a cliente)
--    Mantenemos los existentes de 006
-- ============================================================

ALTER TABLE public.credit_applications
  DROP CONSTRAINT IF EXISTS credit_applications_status_check;

ALTER TABLE public.credit_applications
  ADD CONSTRAINT credit_applications_status_check
  CHECK (status IN (
    'borrador',         -- guardado como borrador, no enviado
    'submitted',        -- enviada, pendiente de revisión (legacy)
    'en_revision',      -- analista la está revisando
    'docs_pendientes',  -- analista solicita más documentos al cliente
    'aprobado',         -- aprobada por AccesaX
    'fondos_liberados', -- recursos listos para dispersar
    'en_ejecucion',     -- proyecto en curso
    'liquidado',        -- crédito pagado en su totalidad
    'rechazado'         -- rechazada
  ));

-- Cambiar default de status a 'borrador' para nuevas solicitudes
ALTER TABLE public.credit_applications
  ALTER COLUMN status SET DEFAULT 'borrador';


-- ============================================================
-- 3. EXTENDER: project_vendors
--    Añadir flags de verificación manual del analista
-- ============================================================

ALTER TABLE public.project_vendors
  ADD COLUMN IF NOT EXISTS clabe_verificada   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rfc_verificado     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verificado_por     UUID    REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verificado_at      TIMESTAMPTZ;


-- ============================================================
-- 4. NUEVA TABLA: financiamiento_documentos
--    Documentos subidos por solicitud de financiamiento.
--    Un documento = un archivo en Storage.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.financiamiento_documentos (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_application_id UUID          NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  company_id            UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  tipo                  TEXT          NOT NULL
                        CHECK (tipo IN (
                          'orden_compra',       -- requerido
                          'correo_pagador',     -- requerido
                          'contrato',           -- opcional
                          'factura_aceptada',   -- opcional
                          'otro'
                        )),

  storage_path          TEXT          NOT NULL,  -- path relativo en bucket financiamiento-docs
  nombre_archivo        TEXT,                    -- nombre original del archivo
  mime_type             TEXT,
  tamanio_bytes         BIGINT,

  uploaded_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fd_app_id_idx
  ON public.financiamiento_documentos (credit_application_id);

CREATE INDEX IF NOT EXISTS fd_company_id_idx
  ON public.financiamiento_documentos (company_id);

ALTER TABLE public.financiamiento_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fd_select_own" ON public.financiamiento_documentos
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "fd_insert_own" ON public.financiamiento_documentos
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "fd_delete_own" ON public.financiamiento_documentos
  FOR DELETE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "fd_admin_all" ON public.financiamiento_documentos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins también necesitan UPDATE en credit_applications para resolver solicitudes
CREATE POLICY IF NOT EXISTS "credit_applications_admin_all"
  ON public.credit_applications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 5. STORAGE BUCKET: financiamiento-docs
--    Privado — acceso solo vía signed URLs
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'financiamiento-docs',
  'financiamiento-docs',
  false,
  20971520,  -- 20 MB por archivo
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS en storage: solo el dueño puede subir/ver sus docs
CREATE POLICY "fd_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'financiamiento-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "fd_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'financiamiento-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "fd_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'financiamiento-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins pueden ver todos los documentos
CREATE POLICY "fd_storage_admin" ON storage.objects
  FOR ALL USING (
    bucket_id = 'financiamiento-docs'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================

-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'credit_applications'
--   ORDER BY ordinal_position;

-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'financiamiento_documentos';

-- SELECT * FROM storage.buckets WHERE id = 'financiamiento-docs';
