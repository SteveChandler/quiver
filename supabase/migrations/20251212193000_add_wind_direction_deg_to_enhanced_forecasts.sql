-- Add wind_direction_deg to enhanced_forecasts
--
-- Why:
-- - Application writes `enhanced_forecasts.wind_direction_deg` (numeric degrees) for scoring/analytics.
-- - Production currently logs PGRST204 schema-cache mismatch and strips the field, silently dropping data.
--
-- Safety:
-- - Non-destructive: adds a nullable column.
-- - Includes a safe best-effort backfill from existing `wind_direction` (cardinal text) without relying on any existing helper function.

BEGIN;

ALTER TABLE public.enhanced_forecasts
  ADD COLUMN IF NOT EXISTS wind_direction_deg numeric;

COMMENT ON COLUMN public.enhanced_forecasts.wind_direction_deg IS
  'Wind direction in degrees (0-360). Preferred for scoring/analytics; derived from wind_direction when available.';

-- Best-effort backfill for existing rows.
UPDATE public.enhanced_forecasts
SET wind_direction_deg = CASE
  WHEN wind_direction IS NULL THEN NULL
  -- If it's already numeric, normalize to [0, 360)
  WHEN trim(wind_direction) ~ '^-?\\d+(\\.\\d+)?$' THEN
    MOD((trim(wind_direction))::numeric + 360, 360)
  -- Otherwise map common cardinal/ordinal directions
  ELSE CASE upper(trim(wind_direction))
    WHEN 'N' THEN 0
    WHEN 'NNE' THEN 22.5
    WHEN 'NE' THEN 45
    WHEN 'ENE' THEN 67.5
    WHEN 'E' THEN 90
    WHEN 'ESE' THEN 112.5
    WHEN 'SE' THEN 135
    WHEN 'SSE' THEN 157.5
    WHEN 'S' THEN 180
    WHEN 'SSW' THEN 202.5
    WHEN 'SW' THEN 225
    WHEN 'WSW' THEN 247.5
    WHEN 'W' THEN 270
    WHEN 'WNW' THEN 292.5
    WHEN 'NW' THEN 315
    WHEN 'NNW' THEN 337.5
    ELSE NULL
  END
END
WHERE wind_direction_deg IS NULL
  AND wind_direction IS NOT NULL;

COMMIT;
