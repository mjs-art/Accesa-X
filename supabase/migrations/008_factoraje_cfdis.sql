-- ============================================================
-- MIGRACIÓN 008: Tabla factoraje_cfdis
--
-- Vincula una solicitud de factoraje con los CFDIs seleccionados
-- para descontar. Un CFDI puede estar en solo una solicitud activa.
--
-- Corre en: Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.factoraje_cfdis (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_application_id UUID          NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  cfdi_id               UUID          NOT NULL REFERENCES public.cfdis(id),

  monto_nominal         NUMERIC(18,2) NOT NULL,   -- due_amount al momento de solicitar
  aforo_pct             NUMERIC(5,2)  NOT NULL DEFAULT 85,
  monto_a_dispersar     NUMERIC(18,2) NOT NULL,   -- monto_nominal * aforo_pct / 100

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fc_app_id_idx  ON public.factoraje_cfdis (credit_application_id);
CREATE INDEX IF NOT EXISTS fc_cfdi_id_idx ON public.factoraje_cfdis (cfdi_id);

ALTER TABLE public.factoraje_cfdis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fc_select_own" ON public.factoraje_cfdis
  FOR SELECT USING (
    credit_application_id IN (
      SELECT ca.id FROM public.credit_applications ca
      JOIN public.companies co ON co.id = ca.company_id
      WHERE co.user_id = auth.uid()
    )
  );

CREATE POLICY "fc_insert_own" ON public.factoraje_cfdis
  FOR INSERT WITH CHECK (
    credit_application_id IN (
      SELECT ca.id FROM public.credit_applications ca
      JOIN public.companies co ON co.id = ca.company_id
      WHERE co.user_id = auth.uid()
    )
  );

CREATE POLICY "fc_delete_own" ON public.factoraje_cfdis
  FOR DELETE USING (
    credit_application_id IN (
      SELECT ca.id FROM public.credit_applications ca
      JOIN public.companies co ON co.id = ca.company_id
      WHERE co.user_id = auth.uid()
    )
  );

CREATE POLICY "fc_admin_all" ON public.factoraje_cfdis
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
