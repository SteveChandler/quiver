-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Add next_tide_at and coops_station_id to the prod view
-- (prior CREATE OR REPLACE matched the old column list; this adds the missing columns)
DROP VIEW IF EXISTS public.ten_day_enhanced_forecasts;

CREATE VIEW public.ten_day_enhanced_forecasts
WITH (security_invoker = true) AS
SELECT
    id,
    beach_id,
    forecast_at,
    forecast_date,
    forecast_time,
    wave_height,
    wave_period,
    wave_direction,
    swell_1_height,
    swell_1_period,
    swell_1_direction,
    swell_2_height,
    swell_2_period,
    swell_2_direction,
    wind_wave_height,
    wind_wave_period,
    wind_wave_direction,
    water_temp,
    air_temperature,
    wind_speed,
    wind_direction,
    weather_condition,
    tide_status,
    tide_height,
    next_tide_time,
    next_tide_type,
    next_tide_height,
    next_tide_at,
    coops_station_id,
    confidence_score,
    data_source,
    raw_forecast,
    created_at,
    updated_at
FROM enhanced_forecasts
WHERE forecast_date >= CURRENT_DATE
  AND forecast_date <= (CURRENT_DATE + '10 days'::interval)
ORDER BY beach_id, forecast_at;
