-- F4 (swell outlook spec): record each snapshot's lead and, once the peak has
-- passed, whether the event persisted through its detector's listing boundary.
-- Written by /api/cron/swell-event-snapshots with the service role only.
-- Caveat: a beach skipped as stale on that last run has no row and reads as
-- 'vanished'.
BEGIN;

ALTER TABLE public.swell_event_forecast_snapshots
  ADD COLUMN IF NOT EXISTS lead_days numeric NULL,
  ADD COLUMN IF NOT EXISTS outcome text NULL CHECK (outcome IN ('held', 'vanished')),
  ADD COLUMN IF NOT EXISTS outcome_resolved_at timestamptz NULL;

COMMENT ON COLUMN public.swell_event_forecast_snapshots.lead_days IS
  'Days from this run (detected_at) to the predicted peak.';
COMMENT ON COLUMN public.swell_event_forecast_snapshots.outcome IS
  'held: present at the last eligible run (pulse: at least 24h before peak; notable: before peak). vanished: absent.';

DROP FUNCTION IF EXISTS public.resolve_swell_event_outcomes(timestamptz);

CREATE OR REPLACE FUNCTION public.resolve_swell_event_outcomes(p_now timestamptz, p_pulse_detector_version text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  resolved integer;
BEGIN
  WITH latest AS (
    SELECT DISTINCT ON (beach_id, event_key, detector_version)
      beach_id, event_key, detector_version, peak_at, detected_at
    FROM public.swell_event_forecast_snapshots
    WHERE outcome IS NULL
    ORDER BY beach_id, event_key, detector_version, detected_at DESC
  ),
  due AS (
    SELECT *,
      CASE WHEN detector_version = p_pulse_detector_version THEN peak_at - interval '24 hours' ELSE peak_at END AS outcome_boundary_at,
      CASE WHEN detector_version = p_pulse_detector_version THEN 2 ELSE 0 END AS boundary_order
    FROM latest
    WHERE peak_at < p_now - interval '12 hours'
  ),
  boundaries AS (
    SELECT DISTINCT detected_at AS boundary_at, 1 AS boundary_order
    FROM public.swell_event_forecast_snapshots
    UNION ALL
    SELECT DISTINCT outcome_boundary_at AS boundary_at, boundary_order FROM due
  ),
  ordered_boundaries AS (
    SELECT boundary_at, boundary_order,
      -- Notable peaks exclude equal runs; pulse boundaries include them.
      max(CASE WHEN boundary_order = 1 THEN boundary_at END) OVER (
        ORDER BY boundary_at, boundary_order
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS last_run
    FROM boundaries
  ),
  last_runs AS (
    SELECT boundary_at, boundary_order, last_run FROM ordered_boundaries WHERE boundary_order <> 1
  )
  UPDATE public.swell_event_forecast_snapshots s
  SET outcome = CASE WHEN r.last_run IS NULL OR d.detected_at >= r.last_run THEN 'held' ELSE 'vanished' END,
      outcome_resolved_at = p_now
  FROM due d JOIN last_runs r ON r.boundary_at = d.outcome_boundary_at AND r.boundary_order = d.boundary_order
  WHERE s.beach_id = d.beach_id
    AND s.event_key = d.event_key
    AND s.detector_version = d.detector_version
    AND s.outcome IS NULL;
  GET DIAGNOSTICS resolved = ROW_COUNT;
  RETURN resolved;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_swell_event_outcomes(timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_swell_event_outcomes(timestamptz, text) TO service_role;

COMMIT;
