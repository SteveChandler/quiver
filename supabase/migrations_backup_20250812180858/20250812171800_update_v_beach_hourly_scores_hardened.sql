-- Update scoring view to source from hourly_forecast, COALESCE subscores, and apply confidence factor

BEGIN;

CREATE OR REPLACE VIEW public.v_beach_hourly_scores AS
SELECT
  m.beach_id,
  m.ts::timestamptz AS ts_utc,
  -- Wind off by degrees (for diagnostics)
  ABS(MOD((m.wind_direction_deg - b.wind_offshore_deg + 540)::int, 360) - 180) AS wind_off_by_deg,

  -- Wind score: cosine falloff vs offshore, penalize high onshore speed
  COALESCE(
    GREATEST(
      0,
      (1 + COS(RADIANS(ABS(MOD((m.wind_direction_deg - b.wind_offshore_deg + 540)::int,360)-180))))/2
      * (1 - GREATEST(0, (m.wind_speed_ms * 1.94384449) - COALESCE(b.wind_cross_shore_ok_kt, 10))::float / 10.0)
    ),
    0
  ) AS wind_score,

  -- Tide score: triangle around preferred band (ft units)
  (
    COALESCE(
      GREATEST(
        0,
        1 - ABS(((m.tide_height_m * 3.28084) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max)/2.0)))
              / NULLIF((b.preferred_tide_ft_max - b.preferred_tide_ft_min)/2.0,0)
      ),
      0
    )
  )::numeric AS tide_score,

  -- Swell dir inclusion with fade and wrap-around
  COALESCE((
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
  ), 0) AS swell_dir_score,

  -- Period and height placeholders (future calibration) - keep types stable with previous definition
  0.0::numeric AS period_score,
  0.0::numeric AS height_score,

  -- Weighted total using per-beach weights and confidence factor
  ROUND(
    100 * GREATEST(
      0,
      (COALESCE(b.w_wind,   0.3) * COALESCE(
        GREATEST(
          0,
          (1 + COS(RADIANS(ABS(MOD((m.wind_direction_deg - b.wind_offshore_deg + 540)::int,360)-180))))/2
          * (1 - GREATEST(0, (m.wind_speed_ms * 1.94384449) - COALESCE(b.wind_cross_shore_ok_kt, 10))::float / 10.0)
        ), 0
      ))
      + (COALESCE(b.w_tide,  0.2) * COALESCE(
        GREATEST(
          0,
          1 - ABS(((m.tide_height_m * 3.28084) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max)/2.0)))
                / NULLIF((b.preferred_tide_ft_max - b.preferred_tide_ft_min)/2.0,0)
        ), 0
      ))
      + (COALESCE(b.w_swell, 0.25) * COALESCE((
        WITH params AS (
          SELECT ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) AS span,
                 b.swell_window_min_deg AS min_deg
        )
        SELECT GREATEST(
          0,
          1 - GREATEST(0, ABS(MOD((m.wave_direction_deg - ((min_deg + span/2.0)) + 540)::int, 360) - 180) - (span/2.0))::float / 30.0
        )
        FROM params
      ), 0))
      + (COALESCE(b.w_period, 0.15) * 0)
      + (COALESCE(b.w_height, 0.10) * 0)
    ) * COALESCE(m.confidence_0_1, 1.0)
  )::int AS score_0_100
FROM public.hourly_forecast m
JOIN public.beaches b ON b.id = m.beach_id;

COMMENT ON VIEW public.v_beach_hourly_scores IS 'Per-hour surf suitability scores using hourly_forecast compat view, per-beach weights, and confidence factor.';

COMMIT;


