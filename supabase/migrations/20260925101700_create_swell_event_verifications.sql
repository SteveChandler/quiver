-- Forecast-vs-buoy verification for named swell events
-- (spec: docs/superpowers/specs/2026-09-25-week-scout-swell-planning.md, step 2).
-- The swell-alert runner records the forecast at send; /api/cron/swell-event-verify
-- fills the observed fields and status after the event. Service role only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.swell_event_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('alert', 'snapshot')),
  detector_version text NOT NULL,
  forecast_issued_at timestamptz NOT NULL,
  forecast_arrival_at timestamptz NULL,
  forecast_peak_at timestamptz NOT NULL,
  forecast_fade_at timestamptz NULL,
  forecast_peak_offshore_height_ft numeric NULL,
  forecast_peak_face_height_ft numeric NULL,
  forecast_peak_period_s numeric NULL,
  forecast_direction_deg numeric NULL,
  station_id text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'hit', 'miss_no_show', 'miss_timing', 'miss_size', 'no_observations')
  ),
  observed_baseline_height_ft numeric NULL,
  observed_peak_height_ft numeric NULL,
  observed_peak_at timestamptz NULL,
  observed_peak_period_s numeric NULL,
  observed_peak_direction_deg numeric NULL,
  observation_count int NULL,
  peak_error_hours numeric NULL,
  height_ratio numeric NULL,
  verified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_key, beach_id, source)
);

COMMENT ON TABLE public.swell_event_verifications IS
  'One forecast per (event_key, beach_id, source), checked against buoy total Hs after the event. Buoys have no partitions, so wind sea counts toward the observed height.';
COMMENT ON COLUMN public.swell_event_verifications.forecast_issued_at IS
  'When the forecast was made; the send time for alerts.';
COMMENT ON COLUMN public.swell_event_verifications.forecast_peak_offshore_height_ft IS
  'Offshore swell component height at peak, not surf height.';
COMMENT ON COLUMN public.swell_event_verifications.forecast_peak_face_height_ft IS
  'Projected surf face height at peak.';
COMMENT ON COLUMN public.swell_event_verifications.station_id IS
  'Observation station resolved at verification time via get_beach_observation_station.';
COMMENT ON COLUMN public.swell_event_verifications.peak_error_hours IS
  'observed_peak_at - forecast_peak_at in hours (signed).';
COMMENT ON COLUMN public.swell_event_verifications.height_ratio IS
  'observed_peak_height_ft / forecast_peak_offshore_height_ft.';

CREATE INDEX IF NOT EXISTS swell_event_verifications_status_peak_idx
  ON public.swell_event_verifications (status, forecast_peak_at);

ALTER TABLE public.swell_event_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swell_event_verifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.swell_event_verifications TO service_role;

COMMIT;
