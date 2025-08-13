-- Add per-beach scoring weights and update scoring view to use them

BEGIN;

-- Columns for weights on beaches (0..1). Defaults sum to 1.0 for current factors.
ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS w_wind   NUMERIC(4,3) CHECK (w_wind   >= 0 AND w_wind   <= 1) DEFAULT 0.400,
  ADD COLUMN IF NOT EXISTS w_swell  NUMERIC(4,3) CHECK (w_swell  >= 0 AND w_swell  <= 1) DEFAULT 0.400,
  ADD COLUMN IF NOT EXISTS w_tide   NUMERIC(4,3) CHECK (w_tide   >= 0 AND w_tide   <= 1) DEFAULT 0.200,
  ADD COLUMN IF NOT EXISTS w_period NUMERIC(4,3) CHECK (w_period >= 0 AND w_period <= 1) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS w_height NUMERIC(4,3) CHECK (w_height >= 0 AND w_height <= 1) DEFAULT 0.000;

-- Backfill existing rows where NULL
UPDATE public.beaches
SET
  w_wind   = COALESCE(w_wind,   0.400),
  w_swell  = COALESCE(w_swell,  0.400),
  w_tide   = COALESCE(w_tide,   0.200),
  w_period = COALESCE(w_period, 0.000),
  w_height = COALESCE(w_height, 0.000);

-- Replace scoring view to pull weights from beaches
CREATE OR REPLACE VIEW public.v_beach_hourly_scores AS
SELECT
  m.beach_id,
  m.ts AS ts_utc,
  -- Wind dir closeness to offshore (0 best, 180 worst)
  abs(mod((m.wind_direction_deg - b.wind_offshore_deg + 540)::int, 360) - 180) AS wind_off_by_deg,
  -- Map 0..180 → 1..0 with a cosine falloff; penalize high onshore speed (wind thresholds from beaches)
  greatest(
    0,
    (1 + cos(radians(abs(mod((m.wind_direction_deg - b.wind_offshore_deg + 540)::int,360)-180))))/2
    * (1 - greatest(0, (m.wind_speed_ms * 1.94384449) - b.wind_cross_shore_ok_kt)::float / 10.0)
  ) AS wind_score,
  -- Tide: triangle around preferred mid inside min/max rails (units: m→ft)
  COALESCE(
    greatest(
      0,
      1 - abs((t.tide_height_m * 3.28084) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max)/2.0))
            / NULLIF((b.preferred_tide_ft_max - b.preferred_tide_ft_min)/2.0,0)
    ),
    0
  ) AS tide_score,
  -- Swell window: inside = 1, fade to 0 by 30° beyond window; handle wrap-around via center/span
  (
    WITH params AS (
      SELECT
        ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) AS span,
        b.swell_window_min_deg AS min_deg
    )
    SELECT
      greatest(
        0,
        1 - greatest(
              0,
              abs(mod((m.wave_direction_deg - ((min_deg + span/2.0)) + 540)::int, 360) - 180) - (span/2.0)
            )::float / 30.0
      )
    FROM params
  ) AS swell_dir_score,
  0.0 AS period_score,
  0.0 AS height_score,
  -- Weighted total using per-beach weights (defaulting if NULL)
  ROUND(
    100 * GREATEST(
      0,
      (COALESCE(b.w_wind, 0.4)   * GREATEST(0,
        (1 + cos(radians(abs(mod((m.wind_direction_deg - b.wind_offshore_deg + 540)::int,360)-180))))/2
        * (1 - GREATEST(0, (m.wind_speed_ms * 1.94384449) - b.wind_cross_shore_ok_kt)::float / 10.0)
      ))
      + (COALESCE(b.w_tide, 0.2)   * COALESCE(
        greatest(
          0,
          1 - abs((t.tide_height_m * 3.28084) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max)/2.0))
                / NULLIF((b.preferred_tide_ft_max - b.preferred_tide_ft_min)/2.0,0)
        ), 0
      ))
      + (COALESCE(b.w_swell, 0.4)  * (
        WITH params AS (
          SELECT ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) AS span,
                 b.swell_window_min_deg AS min_deg
        )
        SELECT GREATEST(
          0,
          1 - GREATEST(0, ABS(MOD((m.wave_direction_deg - ((min_deg + span/2.0)) + 540)::int, 360) - 180) - (span/2.0))::float / 30.0
        )
        FROM params
      ))
      + (COALESCE(b.w_period, 0.0) * 0)
      + (COALESCE(b.w_height, 0.0) * 0)
    )
  )::int AS score_0_100
FROM public.marine_forecasts m
LEFT JOIN public.tide_forecasts t
  ON t.beach_id = m.beach_id AND t.ts = m.ts
JOIN public.beaches b
  ON b.id = m.beach_id;

COMMENT ON VIEW public.v_beach_hourly_scores IS 'Per-hour beach suitability scores (0-100) using per-beach weights: wind (vs offshore), tide band, and swell window; units normalized; wrap-around handled. ts_utc is timestamptz.';

COMMIT;
