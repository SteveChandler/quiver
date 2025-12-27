-- Forecast Alerts Infrastructure (Push)
-- Adds an opt-out toggle on profiles and a server-managed dedupe table for push delivery state.
-- Non-destructive, idempotent migration.

BEGIN;

-- Ensure updated_at trigger function exists (used across multiple tables)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add opt-out toggle (enabled by default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'notif_forecast_alerts'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN notif_forecast_alerts boolean NOT NULL DEFAULT true;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.notif_forecast_alerts IS
  'Opt-out toggle for forecast threshold push alerts (home beach).';

-- Delivery state / dedupe table (service-managed)
CREATE TABLE IF NOT EXISTS public.forecast_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('forecast_threshold')),
  last_sent_at timestamptz,
  last_matching_forecast_ts timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, beach_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_forecast_alert_deliveries_user_beach_type
  ON public.forecast_alert_deliveries(user_id, beach_id, alert_type);

CREATE INDEX IF NOT EXISTS idx_forecast_alert_deliveries_last_sent_at
  ON public.forecast_alert_deliveries(last_sent_at DESC);

DROP TRIGGER IF EXISTS trg_forecast_alert_deliveries_set_updated_at ON public.forecast_alert_deliveries;
CREATE TRIGGER trg_forecast_alert_deliveries_set_updated_at
BEFORE UPDATE ON public.forecast_alert_deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.forecast_alert_deliveries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'forecast_alert_deliveries'
      AND policyname = 'forecast_alert_deliveries_service_role_all'
  ) THEN
    CREATE POLICY forecast_alert_deliveries_service_role_all
      ON public.forecast_alert_deliveries
      FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

COMMIT;




