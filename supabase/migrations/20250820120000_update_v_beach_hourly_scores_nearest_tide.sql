-- Update v_beach_hourly_scores to use nearest tide within ±90 minutes instead of exact timestamp match
-- and keep existing scoring logic. This improves tide_score population when marine forecasts are at :30.

CREATE OR REPLACE VIEW public.v_beach_hourly_scores AS
SELECT
  m.beach_id,
  (m.ts AT TIME ZONE 'UTC') AS ts_utc,
  -- Wind dir closeness to offshore (0 best, 180 worst)
  ABS(MOD((m.wind_direction_deg - b.wind_offshore_deg + 540)::int, 360) - 180) AS wind_off_by_deg,
  -- Map 0..180 → 1..0 with a cosine falloff; penalize high onshore speed (wind thresholds from beaches)
  GREATEST(
    0,
    (1 + COS(RADIANS(ABS(MOD((m.wind_direction_deg - b.wind_offshore_deg + 540)::int,360)-180))))/2
    * (1 - GREATEST(0, (m.wind_speed_ms * 1.94384449) - b.wind_cross_shore_ok_kt)::float / 10.0)
  ) AS wind_score,
  -- Tide: triangle around preferred mid inside min/max rails (units: m→ft) using nearest tide within ±90 minutes
  COALESCE(
    GREATEST(
      0,
      1 - ABS(((t_near.tide_height_m * 3.28084)) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max)/2.0))
            / NULLIF((b.preferred_tide_ft_max - b.preferred_tide_ft_min)/2.0,0)
    ),
    0
  )::numeric AS tide_score,
  -- Swell window: inside = 1, fade to 0 by 30° beyond window; handle wrap-around via center/span
  (
    WITH params AS (
      SELECT ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) AS span,
             b.swell_window_min_deg AS min_deg
    )
    SELECT GREATEST(
      0,
      1 - GREATEST(
            0,
            ABS(MOD((m.wave_direction_deg - ((min_deg + span/2.0)) + 540)::int, 360) - 180) - (span/2.0)
          )::float / 30.0
    )
    FROM params
  ) AS swell_dir_score,
  -- Period & height not yet parameterized in DB calibration; treat as 0 for now
  0.0 AS period_score,
  0.0 AS height_score,
  -- Weighted total (defaults: wind 0.4, swell 0.4, tide 0.2)
  ROUND(
    100 * GREATEST(
      0,
      (0.4 * GREATEST(0,
        (1 + COS(RADIANS(ABS(MOD((m.wind_direction_deg - b.wind_offshore_deg + 540)::int,360)-180))))/2
        * (1 - GREATEST(0, (m.wind_speed_ms * 1.94384449) - b.wind_cross_shore_ok_kt)::float / 10.0)
      ))
      + (0.2 * COALESCE(
        GREATEST(
          0,
          1 - ABS(((t_near.tide_height_m * 3.28084)) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max)/2.0))
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
    * 1
  )::int AS score_0_100
FROM public.marine_forecasts m
JOIN public.beaches b ON b.id = m.beach_id
LEFT JOIN LATERAL (
  SELECT t.ts, t.tide_height_m
  FROM public.tide_forecasts t
  WHERE t.beach_id = m.beach_id
    AND t.ts BETWEEN m.ts - INTERVAL '90 minutes' AND m.ts + INTERVAL '90 minutes'
  ORDER BY ABS(EXTRACT(EPOCH FROM (t.ts - m.ts)))
  LIMIT 1
) t_near ON TRUE;

COMMENT ON VIEW public.v_beach_hourly_scores IS 'Per-hour beach suitability scores (0-100) based on wind (vs offshore), tide band (nearest hourly within ±90m), and swell window; units normalized.';

