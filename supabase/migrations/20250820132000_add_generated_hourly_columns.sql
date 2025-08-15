-- Ensure hourly forecast compatibility columns exist using generated columns,
-- without breaking existing schema or constraints. Adds fast indexes on (beach_id, ts_utc).

BEGIN;

-- Marine: generated columns mapped to requested names
ALTER TABLE public.marine_forecasts
  ADD COLUMN IF NOT EXISTS ts_utc timestamptz GENERATED ALWAYS AS (ts) STORED,
  ADD COLUMN IF NOT EXISTS hs_m real GENERATED ALWAYS AS (CASE WHEN wave_height_m IS NULL THEN NULL ELSE wave_height_m::real END) STORED,
  ADD COLUMN IF NOT EXISTS tp_s real GENERATED ALWAYS AS (CASE WHEN wave_period_s IS NULL THEN NULL ELSE wave_period_s::real END) STORED,
  ADD COLUMN IF NOT EXISTS swell_dir_deg int GENERATED ALWAYS AS (CASE WHEN wave_direction_deg IS NULL THEN NULL ELSE (wave_direction_deg::int) END) STORED,
  ADD COLUMN IF NOT EXISTS wind_spd_kts real GENERATED ALWAYS AS (CASE WHEN wind_speed_ms IS NULL THEN NULL ELSE (wind_speed_ms * 1.94384449)::real END) STORED,
  ADD COLUMN IF NOT EXISTS wind_dir_deg int GENERATED ALWAYS AS (CASE WHEN wind_direction_deg IS NULL THEN NULL ELSE (wind_direction_deg::int) END) STORED;

-- Non-unique index (multiple sources may exist at same ts)
CREATE INDEX IF NOT EXISTS idx_marine_forecasts_beach_ts_utc ON public.marine_forecasts (beach_id, ts_utc);

-- Tide: generated columns mapped to requested names
ALTER TABLE public.tide_forecasts
  ADD COLUMN IF NOT EXISTS ts_utc timestamptz GENERATED ALWAYS AS (ts) STORED,
  ADD COLUMN IF NOT EXISTS tide_ft real GENERATED ALWAYS AS (CASE WHEN tide_height_m IS NULL THEN NULL ELSE (tide_height_m * 3.28084)::real END) STORED;

CREATE INDEX IF NOT EXISTS idx_tide_forecasts_beach_ts_utc ON public.tide_forecasts (beach_id, ts_utc);

COMMIT;


