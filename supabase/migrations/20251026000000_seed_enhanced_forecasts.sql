-- Migration: Seed Enhanced Forecasts for Local Development
-- Purpose: Populate enhanced_forecasts table with realistic data for testing
-- Date: 2025-10-26

BEGIN;

-- Clear existing forecast data
DELETE FROM enhanced_forecasts;

-- Generate 10 days of forecast data for all beaches with coordinates
WITH beach_list AS (
  SELECT id, lat, lon, name
  FROM beaches
  WHERE lat IS NOT NULL AND lon IS NOT NULL
),
date_series AS (
  SELECT generate_series(
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '10 days',
    INTERVAL '1 day'
  )::DATE as forecast_date
),
time_series AS (
  SELECT unnest(ARRAY['00:00:00'::time, '06:00:00'::time, '12:00:00'::time, '18:00:00'::time]) as forecast_time
),
forecast_combinations AS (
  SELECT
    b.id as beach_id,
    b.name as beach_name,
    d.forecast_date,
    t.forecast_time,
    -- Vary wave heights realistically (2-8 feet range)
    ROUND((2 + random() * 6)::numeric, 1) as wave_height_ft,
    -- Wave period (8-16 seconds)
    ROUND((8 + random() * 8)::numeric) as wave_period_sec,
    -- Wave direction (variable but coastal)
    ROUND((200 + random() * 80)::numeric) as wave_direction_deg,
    -- Tide heights (-1 to 7 feet, tidal pattern)
    ROUND((3 + 4 * sin((EXTRACT(HOUR FROM t.forecast_time::time) + random() * 6) * pi() / 12))::numeric, 2) as tide_height_ft,
    -- Tide status (cycling through rising/falling)
    CASE WHEN random() > 0.5 THEN 'rising' ELSE 'falling' END as tide_status,
    -- Wind speed (2-15 mph)
    ROUND((2 + random() * 13)::numeric, 1) as wind_speed_mph,
    -- Wind direction (variable)
    ROUND((random() * 360)::numeric) as wind_direction_deg,
    -- Air temperature (60-75F)
    ROUND((60 + random() * 15)::numeric) as air_temp_f,
    -- Water temperature (62-68F)
    ROUND((62 + random() * 6)::numeric) as water_temp_f
  FROM beach_list b
  CROSS JOIN date_series d
  CROSS JOIN time_series t
)
INSERT INTO enhanced_forecasts (
  beach_id,
  forecast_date,
  forecast_time,
  wave_height,
  wave_period,
  wave_direction,
  tide_height,
  tide_status,
  next_tide_time,
  next_tide_type,
  next_tide_height,
  wind_speed,
  wind_direction,
  air_temperature,
  water_temp,
  swell_1_height,
  swell_1_period,
  swell_1_direction,
  confidence_score,
  data_source,
  created_at,
  updated_at
)
SELECT
  beach_id,
  forecast_date,
  forecast_time,
  wave_height_ft || ' ft',
  wave_period_sec || 's',
  wave_direction_deg || '°',
  tide_height_ft || ' ft',
  tide_status,
  -- Next tide time (3-6 hours from forecast time)
  (forecast_time + INTERVAL '4 hours')::text,
  CASE WHEN tide_status = 'rising' THEN 'high' ELSE 'low' END,
  CASE WHEN tide_status = 'rising' THEN '6.5 ft' ELSE '0.5 ft' END,
  wind_speed_mph || ' mph',
  wind_direction_deg || '°',
  air_temp_f || '°F',
  water_temp_f || '°F',
  wave_height_ft || ' ft',
  wave_period_sec || 's',
  wave_direction_deg || '°',
  85, -- Good confidence score
  'SEED_DATA', -- Data source
  NOW(),
  NOW()
FROM forecast_combinations;

-- Log the number of forecasts created
DO $$
DECLARE
  forecast_count INTEGER;
  beach_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO forecast_count FROM enhanced_forecasts;
  SELECT COUNT(DISTINCT beach_id) INTO beach_count FROM enhanced_forecasts;
  RAISE NOTICE 'Seeded % forecasts for % beaches', forecast_count, beach_count;
END $$;

COMMIT;
