-- ============================================================
-- MIGRACIÓN 011: Admin Backoffice Completo
--
-- Cambios:
--   1. RLS para admins en tablas de onboarding
--      (para ver expediente completo de empresas)
--   2. RLS para admins en storage buckets de onboarding
--   3. Nuevas columnas para tracking de dispersión
-- ============================================================

-- ============================================================
-- 1. RLS para admins en tablas de onboarding
-- ============================================================

CREATE POLICY "lr_admin_all" ON public.legal_representatives
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "lrd_admin_all" ON public.legal_rep_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "sh_admin_all" ON public.shareholders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "cd_admin_all" ON public.company_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 2. RLS para admins en storage de documentos de onboarding
-- ============================================================

CREATE POLICY "admin_legal_rep_docs_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'legal-rep-docs'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_company_docs_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'company-docs'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_shareholder_docs_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'shareholder-docs'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 3. Nuevas columnas para tracking de dispersión de fondos
-- ============================================================

ALTER TABLE public.credit_applications
  ADD COLUMN IF NOT EXISTS referencia_desembolso TEXT,
  ADD COLUMN IF NOT EXISTS monto_dispersado       NUMERIC(18,2);
