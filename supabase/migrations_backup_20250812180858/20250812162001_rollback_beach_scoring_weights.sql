-- Rollback: restore hardcoded weights in view and drop per-beach weight columns

BEGIN;

-- Restore the view with static weights 0.4/0.4/0.2
CREATE OR REPLACE VIEW public.v_beach_hourly_scores AS
SELECT
  m.beach_id,
  m.ts AS ts_utc,
  abs(mod((m.wind_direction_deg - b.wind_offshore_deg + 540)::int, 360) - 180) AS wind_off_by_deg,
  greatest(
    0,
    (1 + cos(radians(abs(mod((m.wind_direction_deg - b.wind_offshore_deg + 540)::int,360)-180))))/2
    * (1 - greatest(0, (m.wind_speed_ms * 1.94384449) - b.wind_cross_shore_ok_kt)::float / 10.0)
  ) AS wind_score,
  COALESCE(
    greatest(
      0,
      1 - abs((t.tide_height_m * 3.28084) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max)/2.0))
            / NULLIF((b.preferred_tide_ft_max - b.preferred_tide_ft_min)/2.0,0)
    ),
    0
  ) AS tide_score,
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
  ROUND(
    100 * GREATEST(
      0,
      (0.4 * GREATEST(0,
        (1 + cos(radians(abs(mod((m.wind_direction_deg - b.wind_offshore_deg + 540)::int,360)-180))))/2
        * (1 - GREATEST(0, (m.wind_speed_ms * 1.94384449) - b.wind_cross_shore_ok_kt)::float / 10.0)
      ))
      + (0.2 * COALESCE(
        greatest(
          0,
          1 - abs((t.tide_height_m * 3.28084) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max)/2.0))
                / NULLIF((b.preferred_tide_ft_max - b.preferred_tide_ft_min)/2.0,0)
        ), 0
      ))
      + (0.4 * (
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
    )
  )::int AS score_0_100
FROM public.marine_forecasts m
LEFT JOIN public.tide_forecasts t
  ON t.beach_id = m.beach_id AND t.ts = m.ts
JOIN public.beaches b
  ON b.id = m.beach_id;

-- Drop columns
ALTER TABLE public.beaches
  DROP COLUMN IF EXISTS w_wind,
  DROP COLUMN IF EXISTS w_swell,
  DROP COLUMN IF EXISTS w_tide,
  DROP COLUMN IF EXISTS w_period,
  DROP COLUMN IF EXISTS w_height;

COMMIT;
