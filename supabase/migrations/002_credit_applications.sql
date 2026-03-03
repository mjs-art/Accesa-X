-- ============================================================
-- AccesaX — Tabla credit_applications
-- Corre en: Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credit_applications (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo_credito     TEXT          NOT NULL CHECK (tipo_credito IN ('empresarial', 'factoraje', 'contrato')),
  monto_solicitado NUMERIC(18,2) NOT NULL,
  plazo_meses      INTEGER       NOT NULL,
  destino          TEXT          NOT NULL,
  contract_id      UUID          REFERENCES public.contracts(id),
  status           TEXT          NOT NULL DEFAULT 'submitted',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_applications_company_id_idx ON public.credit_applications (company_id);

ALTER TABLE public.credit_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_applications_insert_own"
  ON public.credit_applications FOR INSERT
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "credit_applications_select_own"
  ON public.credit_applications FOR SELECT
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
