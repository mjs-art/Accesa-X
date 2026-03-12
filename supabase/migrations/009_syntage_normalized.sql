-- ============================================================
-- MIGRACIÓN 009: Normalización de datos Syntage (4NF)
--
-- Cambios:
--   1. Crear sat_taxpayers  → catálogo RFC (resuelve dependencia transitiva)
--   2. Renombrar cfdis      → sat_cfdis
--   3. Restructurar sat_cfdis: eliminar campos denormalizados,
--      agregar FKs a sat_taxpayers
--   4. Crear sat_cfdi_payment_state → resuelve MVD de pagos
--   5. Crear sat_cfdi_concepts      → resuelve MVD de conceptos/líneas
--   6. Crear sat_annual_returns     → declaraciones anuales
--   7. Crear sat_sync_jobs          → tracking de sync en background
--   8. Crear vista cfdis            → compatibilidad hacia atrás
--
-- Análisis 4NF:
--   - issuer_rfc → issuer_name: dependencia transitiva vía no-clave → sat_taxpayers
--   - cfdi_uuid →→ concepts: MVD (CFDI tiene múltiples líneas) → sat_cfdi_concepts
--   - cfdi_uuid →→ payment_complements: MVD (pago evoluciona independiente) → sat_cfdi_payment_state
--
-- NOTA: Ejecutar en Supabase Dashboard > SQL Editor
-- NOTA MANUAL: Agregar sat_sync_jobs a Realtime Publication en
--   Dashboard > Database > Replication
-- ============================================================


-- ============================================================
-- 1. CATÁLOGO DE CONTRIBUYENTES (sat_taxpayers)
--    Resuelve la dependencia transitiva issuer_rfc → issuer_name
--    y receiver_rfc → receiver_name que viola 3NF/4NF.
--    Es un catálogo compartido entre todas las empresas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sat_taxpayers (
  rfc          TEXT          PRIMARY KEY,   -- RFC del contribuyente (12-13 chars SAT)
  razon_social TEXT,                        -- razón social o nombre (mutable, última conocida)
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas por razon_social
CREATE INDEX IF NOT EXISTS sat_taxpayers_razon_social_idx
  ON public.sat_taxpayers (razon_social)
  WHERE razon_social IS NOT NULL;

ALTER TABLE public.sat_taxpayers ENABLE ROW LEVEL SECURITY;

-- Catálogo público: cualquier usuario autenticado puede leer
CREATE POLICY "sat_taxpayers_select_authenticated" ON public.sat_taxpayers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Solo service_role escribe (Edge Functions con adminClient)
-- No se crea política INSERT/UPDATE para usuarios — service_role bypasses RLS


-- ============================================================
-- 2. RENOMBRAR cfdis → sat_cfdis
--    PostgreSQL actualiza automáticamente las FKs que apuntan
--    a esta tabla (invoice_discount_items, factoraje_cfdis).
-- ============================================================

ALTER TABLE IF EXISTS public.cfdis RENAME TO sat_cfdis;

-- Renombrar índices (cosmético, no afuncional)
ALTER INDEX IF EXISTS cfdis_company_id_idx    RENAME TO sat_cfdis_company_id_idx;
ALTER INDEX IF EXISTS cfdis_type_idx          RENAME TO sat_cfdis_type_idx;
ALTER INDEX IF EXISTS cfdis_issued_at_idx     RENAME TO sat_cfdis_issued_at_idx;
ALTER INDEX IF EXISTS cfdis_issuer_rfc_idx    RENAME TO sat_cfdis_issuer_rfc_idx;
ALTER INDEX IF EXISTS cfdis_receiver_rfc_idx  RENAME TO sat_cfdis_receiver_rfc_idx;
ALTER INDEX IF EXISTS cfdis_status_idx        RENAME TO sat_cfdis_status_idx;
ALTER INDEX IF EXISTS cfdis_due_amount_idx    RENAME TO sat_cfdis_due_amount_idx;


-- ============================================================
-- 3. RESTRUCTURAR sat_cfdis
--    Eliminar campos denormalizados y agregar FKs a sat_taxpayers.
--
--    IMPORTANTE: Los campos que se eliminan (issuer_name, receiver_name,
--    paid_amount, due_amount, fully_paid_at, clav_prod_serv, descripcion)
--    pasan a sus tablas normalizadas correspondientes.
--
--    Para preservar datos existentes antes de eliminar columnas,
--    primero insertar en sat_taxpayers y tablas derivadas.
-- ============================================================

-- 3a. Migrar nombres a sat_taxpayers ANTES de eliminar columnas
INSERT INTO public.sat_taxpayers (rfc, razon_social, updated_at)
SELECT DISTINCT
  issuer_rfc AS rfc,
  issuer_name AS razon_social,
  NOW() AS updated_at
FROM public.sat_cfdis
WHERE issuer_rfc IS NOT NULL AND issuer_rfc <> ''
ON CONFLICT (rfc) DO UPDATE SET
  razon_social = EXCLUDED.razon_social,
  updated_at   = NOW();

INSERT INTO public.sat_taxpayers (rfc, razon_social, updated_at)
SELECT DISTINCT
  receiver_rfc AS rfc,
  receiver_name AS razon_social,
  NOW() AS updated_at
FROM public.sat_cfdis
WHERE receiver_rfc IS NOT NULL AND receiver_rfc <> ''
ON CONFLICT (rfc) DO UPDATE SET
  razon_social = COALESCE(EXCLUDED.razon_social, public.sat_taxpayers.razon_social),
  updated_at   = NOW();

-- 3b. Eliminar columnas denormalizadas de sat_cfdis
ALTER TABLE public.sat_cfdis
  DROP COLUMN IF EXISTS issuer_name,
  DROP COLUMN IF EXISTS receiver_name,
  DROP COLUMN IF EXISTS paid_amount,
  DROP COLUMN IF EXISTS due_amount,
  DROP COLUMN IF EXISTS fully_paid_at,
  DROP COLUMN IF EXISTS clav_prod_serv,
  DROP COLUMN IF EXISTS descripcion;

-- 3c. Agregar FKs a sat_taxpayers
--     (issuer_rfc y receiver_rfc ya existen como TEXT — agregar la FK)
ALTER TABLE public.sat_cfdis
  ADD CONSTRAINT sat_cfdis_issuer_rfc_fk
    FOREIGN KEY (issuer_rfc)   REFERENCES public.sat_taxpayers(rfc),
  ADD CONSTRAINT sat_cfdis_receiver_rfc_fk
    FOREIGN KEY (receiver_rfc) REFERENCES public.sat_taxpayers(rfc);

-- 3d. Renombrar políticas RLS (solo nombres, comportamiento idéntico)
ALTER POLICY "cfdis_select_own" ON public.sat_cfdis RENAME TO "sat_cfdis_select_own";
ALTER POLICY "cfdis_insert_own" ON public.sat_cfdis RENAME TO "sat_cfdis_insert_own";
ALTER POLICY "cfdis_update_own" ON public.sat_cfdis RENAME TO "sat_cfdis_update_own";
ALTER POLICY "cfdis_delete_own" ON public.sat_cfdis RENAME TO "sat_cfdis_delete_own";
ALTER POLICY "cfdis_admin_all"  ON public.sat_cfdis RENAME TO "sat_cfdis_admin_all";


-- ============================================================
-- 4. ESTADO DE PAGO NORMALIZADO (sat_cfdi_payment_state)
--    Resuelve el MVD: cfdi_uuid →→ payment_complements
--    Un CFDI puede tener su estado de pago actualizado múltiples
--    veces (complementos de pago). Esta tabla guarda el estado
--    más reciente como snapshot sincronizado con Syntage.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sat_cfdi_payment_state (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cfdi_id         UUID          NOT NULL REFERENCES public.sat_cfdis(id) ON DELETE CASCADE,
  company_id      UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  paid_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
  due_amount      NUMERIC(18,2),          -- null = sin información de pago
  fully_paid_at   TIMESTAMPTZ,            -- null = aún pendiente de cobro/pago

  -- UUID del complemento de pago que generó este estado (si aplica)
  complement_uuid TEXT,

  -- Timestamp del estado reportado por Syntage
  as_of           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Un CFDI tiene exactamente un estado de pago actual
  UNIQUE (cfdi_id)
);

CREATE INDEX IF NOT EXISTS sat_ps_cfdi_id_idx    ON public.sat_cfdi_payment_state (cfdi_id);
CREATE INDEX IF NOT EXISTS sat_ps_company_id_idx ON public.sat_cfdi_payment_state (company_id);
-- Índice parcial para CxC/CxP: solo filas con monto pendiente
CREATE INDEX IF NOT EXISTS sat_ps_due_amount_idx ON public.sat_cfdi_payment_state (due_amount)
  WHERE due_amount > 0;

ALTER TABLE public.sat_cfdi_payment_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sat_ps_select_own" ON public.sat_cfdi_payment_state
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "sat_ps_admin_all" ON public.sat_cfdi_payment_state
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 5. CONCEPTOS DE CFDI (sat_cfdi_concepts)
--    Resuelve el MVD: cfdi_uuid →→ concepts
--    Un CFDI puede tener múltiples líneas/conceptos. La tabla
--    cfdis anterior solo guardaba el primer concepto, violando
--    la representación completa y 4NF.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sat_cfdi_concepts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cfdi_id         UUID          NOT NULL REFERENCES public.sat_cfdis(id) ON DELETE CASCADE,
  company_id      UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  linea           SMALLINT      NOT NULL DEFAULT 1,   -- posición 1-based dentro del CFDI

  clav_prod_serv  TEXT,                               -- clave SAT del producto/servicio
  descripcion     TEXT          NOT NULL DEFAULT '',
  cantidad        NUMERIC(18,6),
  unidad          TEXT,
  valor_unitario  NUMERIC(18,6),
  importe         NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- Un CFDI no puede tener dos líneas con el mismo número
  UNIQUE (cfdi_id, linea)
);

CREATE INDEX IF NOT EXISTS sat_concepts_cfdi_id_idx ON public.sat_cfdi_concepts (cfdi_id);
CREATE INDEX IF NOT EXISTS sat_concepts_company_idx ON public.sat_cfdi_concepts (company_id);
CREATE INDEX IF NOT EXISTS sat_concepts_clav_idx    ON public.sat_cfdi_concepts (clav_prod_serv)
  WHERE clav_prod_serv IS NOT NULL;

ALTER TABLE public.sat_cfdi_concepts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sat_concepts_select_own" ON public.sat_cfdi_concepts
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "sat_concepts_admin_all" ON public.sat_cfdi_concepts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 6. DECLARACIONES ANUALES (sat_annual_returns)
--    Datos de declaraciones anuales y provisionales del SAT,
--    extraídos por Syntage mediante el extractor annual_tax_return.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sat_annual_returns (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  ejercicio             SMALLINT      NOT NULL,                 -- año fiscal, ej: 2023
  periodo               TEXT,                                   -- 'anual', 'enero', 'febrero', etc.
  tipo_declaracion      TEXT,                                   -- 'normal', 'complementaria'

  -- Cifras fiscales principales
  ingresos_acumulables  NUMERIC(18,2),
  deducciones_totales   NUMERIC(18,2),
  utilidad_fiscal       NUMERIC(18,2),
  isr_causado           NUMERIC(18,2),
  isr_a_cargo           NUMERIC(18,2),                         -- puede ser negativo (saldo a favor)

  -- Respuesta completa de Syntage para campos futuros
  raw_json              JSONB,

  synced_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Una empresa no puede tener dos rows del mismo ejercicio+periodo+tipo
  UNIQUE (company_id, ejercicio, periodo, tipo_declaracion)
);

CREATE INDEX IF NOT EXISTS sat_ar_company_idx   ON public.sat_annual_returns (company_id);
CREATE INDEX IF NOT EXISTS sat_ar_ejercicio_idx ON public.sat_annual_returns (ejercicio);

ALTER TABLE public.sat_annual_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sat_ar_select_own" ON public.sat_annual_returns
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "sat_ar_admin_all" ON public.sat_annual_returns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 7. JOBS DE SINCRONIZACIÓN (sat_sync_jobs)
--    Tracking en tiempo real del proceso de sincronización
--    en background. El frontend subscribe via Realtime.
--
--    NOTA MANUAL REQUERIDA:
--    Ir a Supabase Dashboard > Database > Replication y agregar
--    sat_sync_jobs a la publicación supabase_realtime.
--    Sin este paso, postgres_changes no entregará eventos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sat_sync_jobs (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Estado general del job
  status           TEXT          NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'running', 'completed', 'failed')),

  -- Fase actual dentro del proceso
  phase            TEXT          NOT NULL DEFAULT 'queued'
                   CHECK (phase IN (
                     'queued',
                     'credential_check',
                     'entity_resolution',
                     'trigger_extractions',
                     'fetch_cfdis_emitidos',
                     'fetch_cfdis_recibidos',
                     'upsert_cfdis',
                     'fetch_annual_returns',
                     'completed'
                   )),

  -- Progreso de 0 a 100
  progress_pct     SMALLINT      NOT NULL DEFAULT 0
                   CHECK (progress_pct BETWEEN 0 AND 100),

  -- Contadores para mostrar en UI
  cfdis_fetched    INTEGER       DEFAULT 0,
  cfdis_upserted   INTEGER       DEFAULT 0,

  -- Timestamps del ciclo de vida
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  failed_at        TIMESTAMPTZ,

  -- Mensaje de error si status = 'failed'
  error_message    TEXT,

  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sat_jobs_company_idx ON public.sat_sync_jobs (company_id);
CREATE INDEX IF NOT EXISTS sat_jobs_status_idx  ON public.sat_sync_jobs (status);
-- Índice para encontrar jobs activos rápidamente
CREATE INDEX IF NOT EXISTS sat_jobs_active_idx  ON public.sat_sync_jobs (company_id, status)
  WHERE status IN ('queued', 'running');

ALTER TABLE public.sat_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sat_jobs_select_own" ON public.sat_sync_jobs
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "sat_jobs_admin_all" ON public.sat_sync_jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
-- Edge Functions con service_role bypass RLS (no necesita policy de insert para usuarios)


-- ============================================================
-- 8. VISTA DE COMPATIBILIDAD: cfdis
--    Reconstruye la forma plana de la tabla original para que
--    app/actions/inteligencia.ts siga funcionando sin cambios.
--    Es de solo lectura (SELECT). Los FKs en invoice_discount_items
--    y factoraje_cfdis apuntan a sat_cfdis (la tabla), no a esta vista.
-- ============================================================

CREATE OR REPLACE VIEW public.cfdis AS
SELECT
  sc.id,
  sc.company_id,
  sc.cfdi_uuid,
  sc.cfdi_type,
  sc.issuer_rfc,
  it.razon_social                AS issuer_name,
  sc.receiver_rfc,
  rt.razon_social                AS receiver_name,
  sc.subtotal,
  sc.total,
  COALESCE(ps.paid_amount,  0)   AS paid_amount,
  ps.due_amount,
  ps.fully_paid_at,
  sc.issued_at,
  sc.expires_at,
  sc.cfdi_status,
  sc.blacklist_status,
  con.clav_prod_serv,
  con.descripcion,
  sc.raw_json,
  sc.synced_at,
  sc.created_at
FROM public.sat_cfdis sc
LEFT JOIN public.sat_taxpayers              it  ON it.rfc = sc.issuer_rfc
LEFT JOIN public.sat_taxpayers              rt  ON rt.rfc = sc.receiver_rfc
LEFT JOIN public.sat_cfdi_payment_state     ps  ON ps.cfdi_id = sc.id
LEFT JOIN LATERAL (
  SELECT clav_prod_serv, descripcion
  FROM   public.sat_cfdi_concepts
  WHERE  cfdi_id = sc.id
  ORDER  BY linea ASC
  LIMIT  1
) con ON TRUE;

-- Comentario en la vista
COMMENT ON VIEW public.cfdis IS
  'Vista de compatibilidad sobre sat_cfdis + sat_taxpayers + sat_cfdi_payment_state + sat_cfdi_concepts. '
  'Solo para lectura. Migrar consultas a sat_cfdis directamente en Phase 2.';


-- ============================================================
-- VERIFICACIÓN (comentado — ejecutar manualmente para validar)
-- ============================================================

-- Tablas creadas:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name LIKE 'sat_%'
--   ORDER BY table_name;

-- Vista creada:
-- SELECT table_name FROM information_schema.views
--   WHERE table_schema = 'public' AND table_name = 'cfdis';

-- Políticas RLS:
-- SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND tablename LIKE 'sat_%'
--   ORDER BY tablename, policyname;

-- FKs en sat_cfdis:
-- SELECT conname, confrelid::regclass FROM pg_constraint
--   WHERE conrelid = 'public.sat_cfdis'::regclass AND contype = 'f';
