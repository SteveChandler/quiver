-- F4 (swell outlook spec): record each snapshot's lead and, once the peak has
-- passed, whether the event was still present on the last run before it.
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
  'held: the event was on the last run before its peak. vanished: it was not.';

CREATE OR REPLACE FUNCTION public.resolve_swell_event_outcomes(p_now timestamptz)
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
    SELECT * FROM latest
    WHERE peak_at < p_now - interval '12 hours'
  ),
  boundaries AS (
    SELECT DISTINCT detected_at AS boundary_at, true AS is_run
    FROM public.swell_event_forecast_snapshots
    UNION ALL
    SELECT DISTINCT peak_at AS boundary_at, false AS is_run FROM due
  ),
  ordered_boundaries AS (
    SELECT boundary_at, is_run,
      -- A peak sorts before an equal run timestamp: only earlier runs count.
      max(CASE WHEN is_run THEN boundary_at END) OVER (
        ORDER BY boundary_at, is_run
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS last_run
    FROM boundaries
  ),
  last_runs AS (
    SELECT boundary_at AS peak_at, last_run FROM ordered_boundaries WHERE NOT is_run
  )
  UPDATE public.swell_event_forecast_snapshots s
  SET outcome = CASE WHEN r.last_run IS NULL OR d.detected_at >= r.last_run THEN 'held' ELSE 'vanished' END,
      outcome_resolved_at = p_now
  FROM due d JOIN last_runs r ON r.peak_at = d.peak_at
  WHERE s.beach_id = d.beach_id
    AND s.event_key = d.event_key
    AND s.detector_version = d.detector_version
    AND s.outcome IS NULL;
  GET DIAGNOSTICS resolved = ROW_COUNT;
  RETURN resolved;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_swell_event_outcomes(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_swell_event_outcomes(timestamptz) TO service_role;

COMMIT;
