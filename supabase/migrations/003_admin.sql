-- ============================================================
-- AccesaX — Portal Admin
-- Corre COMPLETO en Supabase Dashboard > SQL Editor
-- ============================================================


-- 1. TABLA: profiles (rol por usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());


-- 2. FUNCIÓN: is_admin() — usada en todas las políticas admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- 3. TRIGGER: auto-crear perfil al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Crear perfil para usuarios ya existentes
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- 4. POLÍTICAS ADMIN — credit_applications
-- ============================================================
CREATE POLICY "credit_applications_select_admin"
  ON public.credit_applications FOR SELECT
  USING (public.is_admin());

CREATE POLICY "credit_applications_update_admin"
  ON public.credit_applications FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- 5. POLÍTICAS ADMIN — companies
-- ============================================================
CREATE POLICY "companies_select_admin"
  ON public.companies FOR SELECT
  USING (public.is_admin());


-- 6. POLÍTICAS ADMIN — contracts
-- ============================================================
CREATE POLICY "contracts_select_admin"
  ON public.contracts FOR SELECT
  USING (public.is_admin());


-- 7. POLÍTICA ADMIN — storage (descargar cualquier contrato)
-- ============================================================
CREATE POLICY "storage_contracts_select_admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND public.is_admin()
  );


-- 8. TABLA: internal_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.internal_notes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_application_id UUID        NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  admin_id              UUID        NOT NULL REFERENCES auth.users(id),
  author_email          TEXT        NOT NULL,
  note                  TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS internal_notes_app_id_idx
  ON public.internal_notes (credit_application_id);

ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_notes_select_admin"
  ON public.internal_notes FOR SELECT
  USING (public.is_admin());

CREATE POLICY "internal_notes_insert_admin"
  ON public.internal_notes FOR INSERT
  WITH CHECK (public.is_admin() AND admin_id = auth.uid());


-- ============================================================
-- PARA HACERTE ADMIN:
-- 1. Ve a Supabase > Authentication > Users, copia tu User ID
-- 2. Corre: UPDATE public.profiles SET role = 'admin' WHERE id = 'TU_USER_ID';
-- ============================================================
