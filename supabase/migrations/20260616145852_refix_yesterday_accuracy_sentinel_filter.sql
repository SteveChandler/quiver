BEGIN;

-- ================================================================
-- Migration: Re-fix get_yesterday_accuracy sentinel value filter
--
-- Regression: 20260222173615_fix_yesterday_accuracy_sentinel_filter.sql
-- correctly changed the row filter to `AND p.observed_m > 0` to exclude the
-- `observed_m = -1` "no observation available" sentinel (stamped on
-- predictions that age out unmatched). One month later,
-- 20260328065200_tighten_accuracy_display_threshold.sql did a CREATE OR
-- REPLACE to tweak the should_display threshold and SILENTLY reverted the
-- filter back to `AND p.observed_m IS NOT NULL`, re-admitting the sentinels.
--
-- Effect on the "Yesterday's Accuracy" card (beach detail): sentinels (-1)
-- are averaged into avg_observed_m (the displayed "Actual" height) and counted
-- in observation_count, and drag the should_display gate (AVG(observed_m) >= 0.3)
-- — so on days with mixed real+sentinel rows the card shows a wrong actual
-- height and is shown/hidden incorrectly (~55 beach-days/week as of Jun 2026).
--
-- Fix: restore `AND p.observed_m > 0`. This migration reproduces the CURRENT
-- function body verbatim (tightened OR-threshold from 20260328065200 +
-- search_path from 20260521120000_supabase_advisor_cleanup.sql) and changes
-- ONLY the row filter — it does not revert the threshold or search_path.
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_yesterday_accuracy(p_beach_id uuid)
RETURNS TABLE (
  beach_id UUID,
  forecast_date DATE,
  avg_predicted_m NUMERIC,
  avg_observed_m NUMERIC,
  mae_m NUMERIC,
  relative_error_pct NUMERIC,
  observation_count INTEGER,
  should_display BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tz TEXT;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  -- Get beach timezone (default to LA)
  SELECT COALESCE(b.timezone, 'America/Los_Angeles') INTO v_tz
  FROM beaches b WHERE b.id = p_beach_id;

  IF v_tz IS NULL THEN
    v_tz := 'America/Los_Angeles';
  END IF;

  -- Pre-compute yesterday's UTC boundaries for index-friendly filtering
  -- on (beach_id, predicted_at) instead of DATE(predicted_at AT TIME ZONE ...)
  v_start := (CURRENT_DATE AT TIME ZONE v_tz - INTERVAL '1 day') AT TIME ZONE v_tz;
  v_end := (CURRENT_DATE AT TIME ZONE v_tz) AT TIME ZONE v_tz;

  RETURN QUERY
  SELECT
    p.beach_id,
    (v_start AT TIME ZONE v_tz)::date AS forecast_date,
    ROUND(AVG(p.corrected_forecast_m)::numeric, 2) AS avg_predicted_m,
    ROUND(AVG(p.observed_m)::numeric, 2) AS avg_observed_m,
    ROUND(AVG(ABS(p.corrected_error_m))::numeric, 2) AS mae_m,
    -- Cap at 999% to prevent absurd values for very small observed waves
    LEAST(
      ROUND(
        AVG(
          CASE WHEN ABS(p.observed_m) > 0
          THEN ABS(p.corrected_error_m) / ABS(p.observed_m) * 100
          ELSE NULL END
        )::numeric, 1
      ),
      999
    ) AS relative_error_pct,
    COUNT(*)::integer AS observation_count,
    -- Hide when EITHER: error > 0.45m (~1.5ft) OR relative > 40%, OR observed < 0.3m (~1ft)
    NOT (
      AVG(ABS(p.corrected_error_m)) > 0.45
      OR COALESCE(AVG(
        CASE WHEN ABS(p.observed_m) > 0
        THEN ABS(p.corrected_error_m) / ABS(p.observed_m)
        ELSE NULL END
      ), 0) > 0.40
    ) AND AVG(p.observed_m) >= 0.3 AS should_display
  FROM ml_predictions_log p
  WHERE p.beach_id = p_beach_id
    AND p.predicted_at >= v_start
    AND p.predicted_at < v_end
    -- Exclude NULLs AND the observed_m = -1 "no observation available" sentinel.
    -- (Was reverted to `IS NOT NULL` by 20260328065200 — see migration header.)
    AND p.observed_m > 0
  GROUP BY p.beach_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_yesterday_accuracy(UUID) TO authenticated, anon, service_role;

COMMIT;
