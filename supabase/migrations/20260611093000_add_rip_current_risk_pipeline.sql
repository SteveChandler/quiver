BEGIN;

ALTER TABLE public.beaches
  ADD COLUMN nws_forecast_zone TEXT,
  ADD COLUMN nws_office TEXT;

COMMENT ON COLUMN public.beaches.nws_forecast_zone IS
  'NWS public forecast zone UGC code for surf-zone rip-current risk, e.g. CAZ043.';

COMMENT ON COLUMN public.beaches.nws_office IS
  'NWS Weather Forecast Office id for Surf Zone Forecast products, e.g. SGX.';

CREATE TABLE public.rip_current_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  valid_date DATE NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high')),
  source TEXT NOT NULL CHECK (source IN ('srf', 'alert')),
  raw_zone TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (beach_id, valid_date)
);

CREATE INDEX idx_rip_current_risks_beach_date
  ON public.rip_current_risks (beach_id, valid_date);

CREATE INDEX idx_rip_current_risks_valid_date
  ON public.rip_current_risks (valid_date);

ALTER TABLE public.rip_current_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rip_current_risks_public_read"
  ON public.rip_current_risks
  FOR SELECT
  USING (true);

CREATE POLICY "rip_current_risks_service_write"
  ON public.rip_current_risks
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE OR REPLACE FUNCTION public.update_rip_current_risks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER rip_current_risks_updated_at
  BEFORE UPDATE ON public.rip_current_risks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rip_current_risks_updated_at();

ALTER TABLE public.sessions
  ADD COLUMN rip_current_risk TEXT;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_rip_current_risk_check
    CHECK (
      rip_current_risk IS NULL
      OR rip_current_risk IN ('low', 'moderate', 'high')
    );

CREATE OR REPLACE FUNCTION public.apply_session_rip_current_risk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_local_date DATE;
BEGIN
  NEW.rip_current_risk := NULL;

  IF NEW.beach_id IS NULL OR NEW.arrival_time IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (NEW.arrival_time AT TIME ZONE b.timezone)::date
  INTO session_local_date
  FROM public.beaches b
  WHERE b.id = NEW.beach_id
    AND b.timezone IS NOT NULL;

  IF session_local_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.risk_level
  INTO NEW.rip_current_risk
  FROM public.rip_current_risks r
  WHERE r.beach_id = NEW.beach_id
    AND r.valid_date = session_local_date
  LIMIT 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_apply_session_rip_current_risk ON public.sessions;

CREATE TRIGGER trigger_apply_session_rip_current_risk
  BEFORE INSERT OR UPDATE OF beach_id, arrival_time
  ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_session_rip_current_risk();

COMMIT;
