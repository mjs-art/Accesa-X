-- Guarda el análisis de Claude sobre la orden de compra de una solicitud de proyecto
ALTER TABLE public.credit_applications
  ADD COLUMN IF NOT EXISTS orden_compra_analysis JSONB;
