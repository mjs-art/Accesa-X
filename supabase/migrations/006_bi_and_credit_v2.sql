-- ============================================================
-- MIGRACIÓN 006: Inteligencia de Negocio + Crédito V2
--
-- Cambios:
--   1. Extender contracts  → agrega client_rfc, project_name
--   2. Extender credit_applications → nuevos tipos, campos de
--      proyecto/factoraje, estados ampliados
--   3. Crear tabla cfdis   → caché de CFDIs de Syntage
--   4. Crear tabla project_vendors → proveedores por proyecto
--   5. Crear tabla invoice_discount_items → facturas por solicitud
--      de factoraje
--
-- Corre en: Supabase Dashboard > SQL Editor
-- ============================================================


-- ============================================================
-- 1. EXTENDER TABLA: contracts
--    Ya tiene: nombre_cliente, monto_contrato, fecha_inicio,
--    fecha_fin, storage_path, analysis_status, analysis_result
--    Agregamos: client_rfc, project_name
-- ============================================================

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS client_rfc    TEXT,
  ADD COLUMN IF NOT EXISTS project_name  TEXT;

-- Índice para buscar contratos por cliente
CREATE INDEX IF NOT EXISTS contracts_client_rfc_idx ON public.contracts (client_rfc);


-- ============================================================
-- 2. EXTENDER TABLA: credit_applications
--    Tipos viejos: 'empresarial' | 'factoraje' | 'contrato'
--    Tipos nuevos: 'proyecto'    | 'factoraje'
--
--    NOTA: Si hay datos de prueba con tipos viejos, este bloque
--    los actualiza antes de cambiar el constraint.
-- ============================================================

-- Migrar tipos viejos → nuevos (datos de prueba)
UPDATE public.credit_applications
  SET tipo_credito = 'proyecto'
  WHERE tipo_credito IN ('empresarial', 'contrato');

-- Reemplazar el CHECK constraint de tipo_credito
ALTER TABLE public.credit_applications
  DROP CONSTRAINT IF EXISTS credit_applications_tipo_credito_check;

ALTER TABLE public.credit_applications
  ADD CONSTRAINT credit_applications_tipo_credito_check
  CHECK (tipo_credito IN ('proyecto', 'factoraje'));

-- Reemplazar el CHECK constraint de status con estados ampliados
ALTER TABLE public.credit_applications
  DROP CONSTRAINT IF EXISTS credit_applications_status_check;

ALTER TABLE public.credit_applications
  ADD CONSTRAINT credit_applications_status_check
  CHECK (status IN (
    'submitted',        -- enviada, pendiente de revisión
    'en_revision',      -- analista la está revisando
    'aprobado',         -- aprobada por AccesaX
    'fondos_liberados', -- crédito por proyecto: recursos listos para dispersar
    'en_ejecucion',     -- proyecto en curso / facturas pendientes de cobro
    'liquidado',        -- crédito pagado en su totalidad
    'rechazado'         -- rechazada
  ));

-- Nuevos campos para crédito por proyecto
ALTER TABLE public.credit_applications
  ADD COLUMN IF NOT EXISTS client_rfc           TEXT,
  ADD COLUMN IF NOT EXISTS client_name          TEXT,
  ADD COLUMN IF NOT EXISTS project_name         TEXT,
  -- Factoraje: ¿se notifica al deudor?
  ADD COLUMN IF NOT EXISTS notificacion_deudor  BOOLEAN DEFAULT false,
  -- Porcentaje de anticipo aprobado (lo define el analista: 80-90)
  ADD COLUMN IF NOT EXISTS porcentaje_anticipo  NUMERIC(5,2),
  -- Notas internas del analista
  ADD COLUMN IF NOT EXISTS analyst_notes        TEXT,
  -- Fecha en que se aprobó / rechazó
  ADD COLUMN IF NOT EXISTS resolved_at          TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS credit_applications_client_rfc_idx
  ON public.credit_applications (client_rfc);

CREATE INDEX IF NOT EXISTS credit_applications_status_idx
  ON public.credit_applications (status);


-- ============================================================
-- 3. NUEVA TABLA: cfdis
--    Caché local de CFDIs extraídos por Syntage del SAT.
--    Se sincroniza cuando el usuario hace click en "Sincronizar SAT"
--    o de forma automática por un job periódico.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cfdis (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Identificadores SAT
  cfdi_uuid         TEXT          NOT NULL,           -- UUID del CFDI (36 chars)
  cfdi_type         TEXT          NOT NULL            -- I=Ingreso E=Egreso P=Pago N=Nómina
                    CHECK (cfdi_type IN ('I', 'E', 'P', 'N')),

  -- Emisor
  issuer_rfc        TEXT          NOT NULL,
  issuer_name       TEXT,

  -- Receptor
  receiver_rfc      TEXT          NOT NULL,
  receiver_name     TEXT,

  -- Montos
  subtotal          NUMERIC(18,2),
  total             NUMERIC(18,2),
  paid_amount       NUMERIC(18,2) DEFAULT 0,          -- de complementos de pago
  due_amount        NUMERIC(18,2),                    -- pendiente por cobrar/pagar
  fully_paid_at     TIMESTAMPTZ,                      -- null = no pagado aún

  -- Fechas
  issued_at         TIMESTAMPTZ   NOT NULL,
  expires_at        TIMESTAMPTZ,

  -- Estatus SAT
  cfdi_status       TEXT          NOT NULL DEFAULT 'vigente'
                    CHECK (cfdi_status IN ('vigente', 'cancelado')),

  -- Lista negra 69-B
  blacklist_status  TEXT,                             -- null = limpio

  -- Conceptos (clave producto/servicio principal del primer concepto)
  clav_prod_serv    TEXT,
  descripcion       TEXT,

  -- Respuesta completa de Syntage (para auditoría y campos futuros)
  raw_json          JSONB,

  -- Control de sincronización
  synced_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Un CFDI no puede aparecer dos veces para la misma empresa
  UNIQUE (company_id, cfdi_uuid)
);

-- Índices para queries de BI
CREATE INDEX IF NOT EXISTS cfdis_company_id_idx    ON public.cfdis (company_id);
CREATE INDEX IF NOT EXISTS cfdis_type_idx          ON public.cfdis (cfdi_type);
CREATE INDEX IF NOT EXISTS cfdis_issued_at_idx     ON public.cfdis (issued_at);
CREATE INDEX IF NOT EXISTS cfdis_issuer_rfc_idx    ON public.cfdis (issuer_rfc);
CREATE INDEX IF NOT EXISTS cfdis_receiver_rfc_idx  ON public.cfdis (receiver_rfc);
CREATE INDEX IF NOT EXISTS cfdis_status_idx        ON public.cfdis (cfdi_status);
CREATE INDEX IF NOT EXISTS cfdis_due_amount_idx    ON public.cfdis (due_amount)
  WHERE due_amount > 0;                              -- índice parcial para CxC/CxP

ALTER TABLE public.cfdis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfdis_select_own" ON public.cfdis
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "cfdis_insert_own" ON public.cfdis
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "cfdis_update_own" ON public.cfdis
  FOR UPDATE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "cfdis_delete_own" ON public.cfdis
  FOR DELETE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Admins pueden ver todos los CFDIs
CREATE POLICY "cfdis_admin_all" ON public.cfdis
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 4. NUEVA TABLA: project_vendors
--    Proveedores que participan en un crédito por proyecto.
--    El desembolso va directo a su CLABE.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_vendors (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_application_id UUID        NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Datos del proveedor
  vendor_rfc          TEXT          NOT NULL,
  vendor_name         TEXT          NOT NULL,
  clabe               TEXT          NOT NULL,         -- 18 dígitos, validado en app
  email               TEXT,

  -- Monto asignado a este proveedor del total del proyecto
  monto_asignado      NUMERIC(18,2) NOT NULL,

  -- Estatus del desembolso
  dispersion_status   TEXT          NOT NULL DEFAULT 'pendiente'
                      CHECK (dispersion_status IN (
                        'pendiente',    -- esperando aprobación del crédito
                        'programado',   -- crédito aprobado, pago en cola
                        'dispersado',   -- transferencia realizada
                        'fallido'       -- error en la transferencia
                      )),
  dispersado_at       TIMESTAMPTZ,

  -- ¿Proveedor viene del historial SAT o fue capturado manualmente?
  es_proveedor_nuevo  BOOLEAN       NOT NULL DEFAULT false,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_vendors_app_id_idx
  ON public.project_vendors (credit_application_id);
CREATE INDEX IF NOT EXISTS project_vendors_company_id_idx
  ON public.project_vendors (company_id);

ALTER TABLE public.project_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pv_select_own" ON public.project_vendors
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "pv_insert_own" ON public.project_vendors
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "pv_update_own" ON public.project_vendors
  FOR UPDATE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "pv_admin_all" ON public.project_vendors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 5. NUEVA TABLA: invoice_discount_items
--    Facturas (CFDIs) incluidas en una solicitud de factoraje.
--    Cada fila = una factura descontada.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_discount_items (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_application_id UUID          NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  company_id            UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Referencia al CFDI cacheado
  cfdi_id               UUID          REFERENCES public.cfdis(id),
  cfdi_uuid             TEXT          NOT NULL,       -- redundante para auditoría

  -- Datos del deudor (cliente que debe pagar)
  debtor_rfc            TEXT          NOT NULL,
  debtor_name           TEXT,

  -- Montos
  monto_factura         NUMERIC(18,2) NOT NULL,       -- valor total de la factura
  monto_anticipado      NUMERIC(18,2),                -- calculado al aprobar: X% del monto

  -- Fecha de la factura
  fecha_emision         TIMESTAMPTZ   NOT NULL,

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idi_app_id_idx
  ON public.invoice_discount_items (credit_application_id);
CREATE INDEX IF NOT EXISTS idi_company_id_idx
  ON public.invoice_discount_items (company_id);
CREATE INDEX IF NOT EXISTS idi_cfdi_uuid_idx
  ON public.invoice_discount_items (cfdi_uuid);

ALTER TABLE public.invoice_discount_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idi_select_own" ON public.invoice_discount_items
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "idi_insert_own" ON public.invoice_discount_items
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "idi_admin_all" ON public.invoice_discount_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- VERIFICACIÓN FINAL
-- Corre estas queries para confirmar que todo quedó bien:
-- ============================================================

-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'contracts' ORDER BY ordinal_position;

-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'credit_applications' ORDER BY ordinal_position;

-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;

-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
