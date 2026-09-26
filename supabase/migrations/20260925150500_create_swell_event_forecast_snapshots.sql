-- Daily per-beach swell-event detections, so later runs and Week Scout can
-- keep one event key across runs and judge run-to-run stability.
-- Written by /api/cron/swell-event-snapshots with the service role only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.swell_event_forecast_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  detector_version text NOT NULL,
  run_date date NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  direction_deg numeric NOT NULL,
  direction_band text NOT NULL,
  period_s numeric NOT NULL,
  peak_offshore_height_ft numeric NOT NULL,
  peak_face_height_ft numeric NOT NULL,
  exposure numeric NOT NULL,
  energy_ratio numeric NOT NULL,
  arrival_at timestamptz NOT NULL,
  peak_at timestamptz NOT NULL,
  fade_at timestamptz NULL,
  -- A second swell crossing this one at the beach (null when none).
  crossing_direction_deg numeric NULL,
  crossing_period_s numeric NULL,
  crossing_offshore_height_ft numeric NULL,
  UNIQUE (beach_id, event_key, run_date)
);

CREATE INDEX IF NOT EXISTS swell_event_forecast_snapshots_beach_detected_idx
  ON public.swell_event_forecast_snapshots (beach_id, detected_at DESC);

-- Service role only: RLS on with no policies.
ALTER TABLE public.swell_event_forecast_snapshots ENABLE ROW LEVEL SECURITY;

-- Week Scout's crossing rarity for a set of candidate beaches since p_since:
-- how many run dates have any snapshot (enough history to say anything), and
-- each crossed event by its latest snapshot with its beach-local peak date.
-- The caller counts distinct peak dates for the lead beach, excluding the
-- event on screen. Aggregated here so a request reads one small JSON value.
CREATE OR REPLACE FUNCTION public.swell_event_crossing_history(p_beach_ids uuid[], p_since timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (s.beach_id, s.event_key)
      s.beach_id, s.event_key, s.peak_at, s.crossing_direction_deg, b.timezone
    FROM public.swell_event_forecast_snapshots s
    JOIN public.beaches b ON b.id = s.beach_id
    WHERE s.beach_id = ANY (p_beach_ids)
      AND s.run_date >= (p_since AT TIME ZONE 'UTC')::date
    ORDER BY s.beach_id, s.event_key, s.detected_at DESC
  )
  SELECT jsonb_build_object(
    'history_days', (
      SELECT count(DISTINCT run_date)
      FROM public.swell_event_forecast_snapshots
      WHERE beach_id = ANY (p_beach_ids)
        AND run_date >= (p_since AT TIME ZONE 'UTC')::date
    ),
    'crossings', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'beach_id', latest.beach_id,
        'event_key', latest.event_key,
        'peak_date', (latest.peak_at AT TIME ZONE coalesce(latest.timezone, 'America/Los_Angeles'))::date
      ) ORDER BY latest.beach_id, latest.event_key)
      FROM latest
      WHERE latest.crossing_direction_deg IS NOT NULL
        AND latest.peak_at >= p_since
        AND latest.peak_at <= now()
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.swell_event_crossing_history(uuid[], timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.swell_event_crossing_history(uuid[], timestamptz) TO service_role;

COMMIT;
