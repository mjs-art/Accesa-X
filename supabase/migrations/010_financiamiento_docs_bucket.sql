-- Crear bucket para documentos de financiamiento (crédito por proyecto)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'financiamiento-docs',
  'financiamiento-docs',
  false,
  20971520,  -- 20 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: usuarios autenticados pueden subir a su propia carpeta ({user_id}/...)
CREATE POLICY "financiamiento_docs_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'financiamiento-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: usuarios autenticados pueden leer sus propios archivos
CREATE POLICY "financiamiento_docs_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'financiamiento-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: usuarios autenticados pueden reemplazar sus propios archivos (upsert)
CREATE POLICY "financiamiento_docs_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'financiamiento-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: admins pueden leer todos los archivos del bucket
CREATE POLICY "financiamiento_docs_admin_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'financiamiento-docs'
  AND public.is_admin()
);

-- RLS: edge functions (service role) pueden leer todos los archivos
-- Nota: service_role bypassa RLS por defecto, no requiere política explícita
