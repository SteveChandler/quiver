-- Additive operational provenance; apply before the corresponding Seaside release.
-- Existing writers may omit these nullable fields. No history backfill: old rows
-- are unknown, not fresh. Existing grants and RLS are unchanged.
-- Rollback: roll back Seaside first and leave these nullable columns in place.
-- If schema removal is required later, restore the preceding HRRR function before
-- dropping wind_model_run_at/source_evidence (that removal discards diagnostics).
BEGIN;
ALTER TABLE public.seaside_cron_runs ADD COLUMN IF NOT EXISTS source_evidence jsonb;
ALTER TABLE public.enhanced_forecasts ADD COLUMN IF NOT EXISTS wind_model_run_at timestamptz;
COMMENT ON COLUMN public.seaside_cron_runs.source_evidence IS
  'Internal producer evidence using existing SourceStatus values; source times, coverage and safe retry outcomes. NULL means unverified.';
COMMENT ON COLUMN public.enhanced_forecasts.wind_model_run_at IS
  'HRRR model issuance time supplied by the producer, never database write or forecast valid time.';
CREATE OR REPLACE FUNCTION public.bulk_update_hrrr_wind(payload jsonb)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH v AS (
    SELECT * FROM jsonb_to_recordset(payload) AS x(
      beach_id uuid, hour_start timestamptz, wind_speed text,
      wind_direction text, wind_direction_deg numeric, model_run timestamptz
    )
  ), upd AS (
    UPDATE enhanced_forecasts ef
    SET wind_speed = v.wind_speed,
        wind_direction = v.wind_direction,
        wind_direction_deg = v.wind_direction_deg,
        wind_source = 'HRRR',
        wind_model_run_at = v.model_run
    FROM v
    WHERE ef.beach_id = v.beach_id
      AND ef.forecast_at >= v.hour_start
      AND ef.forecast_at < v.hour_start + INTERVAL '1 hour'
    RETURNING 1
  )
  SELECT count(*)::int FROM upd;
$$;
-- The pre-existing service-role grant is preserved by CREATE OR REPLACE.
COMMIT;
