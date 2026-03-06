-- ============================================================
-- MIGRACIÓN 005: Storage bucket para documentos de onboarding
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- Crear bucket 'onboarding-docs' (privado, 20 MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'onboarding-docs',
  'onboarding-docs',
  false,
  20971520,  -- 20 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/webp',
    'image/jpg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Políticas de storage
-- Estructura del path: onboarding/{company_id}/{subfolder}/{file}
-- ============================================================

-- Subida de archivos (INSERT)
CREATE POLICY "onboarding_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'onboarding-docs'
    AND (string_to_array(name, '/'))[1] = 'onboarding'
    AND (string_to_array(name, '/'))[2] IN (
      SELECT id::text FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Lectura de archivos (SELECT)
CREATE POLICY "onboarding_docs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'onboarding-docs'
    AND (string_to_array(name, '/'))[1] = 'onboarding'
    AND (string_to_array(name, '/'))[2] IN (
      SELECT id::text FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Reemplazar archivos (UPDATE - necesario para upsert: true)
CREATE POLICY "onboarding_docs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'onboarding-docs'
    AND (string_to_array(name, '/'))[1] = 'onboarding'
    AND (string_to_array(name, '/'))[2] IN (
      SELECT id::text FROM public.companies WHERE user_id = auth.uid()
    )
  );
