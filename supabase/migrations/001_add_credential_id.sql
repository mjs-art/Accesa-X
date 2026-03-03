-- Migración 001: agregar credential_id a companies
-- Corre en Supabase Dashboard → SQL Editor

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS credential_id TEXT;

-- Índice para búsquedas por credential_id (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS companies_credential_id_idx
  ON public.companies (credential_id)
  WHERE credential_id IS NOT NULL;
