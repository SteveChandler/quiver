-- Build a dynamic compatibility view `public.hourly_forecast` over enhanced forecasts
-- - Parses text fields to numeric
-- - Normalizes timestamps using fixed TZ (America/Los_Angeles) for now
-- - Exposes columns expected by scoring view

BEGIN;

-- Create helper function to extract numeric from text like '10 mph', '5.2 ft', '14s'
CREATE OR REPLACE FUNCTION public.extract_numeric(text)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace($1, '[^0-9.]+', '', 'g'), '')::numeric
$$;

-- Create or replace the compat view
CREATE OR REPLACE VIEW public.hourly_forecast AS
WITH src AS (
  SELECT
    ef.beach_id,
    -- Compose local datetime from date + time, then interpret as America/Los_Angeles and cast to timestamptz
    (
      to_timestamp(ef.forecast_date || ' ' || ef.forecast_time, 'YYYY-MM-DD HH24:MI:SS')
      AT TIME ZONE 'America/Los_Angeles'
    ) AS ts,

    -- Wind
    COALESCE(public.cardinal_to_deg(ef.wind_direction), NULL) AS wind_direction_deg,
    CASE WHEN ef.wind_speed IS NOT NULL THEN (public.extract_numeric(ef.wind_speed)::double precision * 0.44704)
         ELSE NULL END AS wind_speed_ms,

    -- Wave/swell primary direction (fallback to swell_1_direction)
    COALESCE(public.cardinal_to_deg(ef.wave_direction), public.cardinal_to_deg(ef.swell_1_direction)) AS wave_direction_deg,
    -- Wave heights (feet → meters)
    CASE WHEN ef.wave_height IS NOT NULL THEN (public.extract_numeric(ef.wave_height)::double precision / 3.28084)
         ELSE NULL END AS wave_height_m,

    -- Tide (feet → meters) if present
    CASE WHEN ef.tide_height IS NOT NULL THEN (public.extract_numeric(ef.tide_height)::double precision / 3.28084)
         ELSE NULL END AS tide_height_m,

    -- Periods (seconds)
    CASE WHEN ef.wave_period IS NOT NULL THEN public.extract_numeric(ef.wave_period)::double precision ELSE NULL END AS peak_period_s,
    CASE WHEN ef.swell_1_period IS NOT NULL THEN public.extract_numeric(ef.swell_1_period)::double precision ELSE NULL END AS swell1_period_s,

    -- Confidence factor in 0..1 from overall_quality_score on the quality view
    LEAST(1.0, GREATEST(0.0, COALESCE(eq.overall_quality_score, 100) / 100.0)) AS confidence_0_1
  FROM public.enhanced_forecasts_with_quality eq
  JOIN public.enhanced_forecasts ef ON ef.id = eq.id
)
SELECT * FROM src;

COMMENT ON VIEW public.hourly_forecast IS 'Compatibility view mapping enhanced_forecasts to normalized numeric fields and timestamptz, for scoring. Uses America/Los_Angeles as local TZ currently.';

-- Permissions
GRANT SELECT ON public.hourly_forecast TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extract_numeric(text) TO anon, authenticated;

COMMIT;


