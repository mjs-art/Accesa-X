-- Rate limiting table for Edge Functions and Server Actions
-- Keyed by (key, action) where key is user_id or IP address.
-- Old records are cleaned up automatically by the purge function below.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT        NOT NULL,  -- user UUID or client IP
  action     TEXT        NOT NULL,  -- function/action name
  called_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rate_limits_lookup_idx
  ON public.rate_limits (key, action, called_at);

-- No RLS needed: only accessed via service-role key from Edge Functions / server actions.
ALTER TABLE public.rate_limits DISABLE ROW LEVEL SECURITY;

-- Purge records older than 24 hours to keep the table small.
CREATE OR REPLACE FUNCTION public.purge_old_rate_limits()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.rate_limits WHERE called_at < NOW() - INTERVAL '24 hours';
$$;
