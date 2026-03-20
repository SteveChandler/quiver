-- Fix Supabase security & performance advisor findings
-- 1. Restore security_invoker on ten_day_enhanced_forecasts — lost when the view
--    was recreated without it in migrations 20260214130100 and 20260214180000
--    (both used DROP VIEW + CREATE VIEW without carrying forward the property).
-- 2. Drop 3 duplicate indexes flagged by performance advisor
BEGIN;

-- Part A: Restore security_invoker = true on ten_day_enhanced_forecasts
-- Must DROP + CREATE (not CREATE OR REPLACE) to ensure column list is correct
-- regardless of which prior migrations have been applied.
-- Includes next_tide_at and coops_station_id from migration 20260214180000.
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

-- Part B: Drop duplicate indexes
-- idx_ioos_obs_station_observed is a duplicate of idx_ioos_obs_station_time
DROP INDEX IF EXISTS idx_ioos_obs_station_observed;

-- idx_templates_lookup is a duplicate of idx_npc_templates_lookup
DROP INDEX IF EXISTS idx_templates_lookup;

-- idx_templates_freshness is a duplicate of idx_npc_templates_freshness
DROP INDEX IF EXISTS idx_templates_freshness;

COMMIT;
