-- Migration: Seed Enhanced Forecasts for Local Development
-- Purpose: Populate enhanced_forecasts table with realistic data for testing
-- Date: 2025-10-26

BEGIN;

-- Clear existing forecast data
DELETE FROM enhanced_forecasts;

DO $$
DECLARE
  lat_column TEXT;
  lon_column TEXT;
  seed_sql   TEXT;
BEGIN
  SELECT CASE 
           WHEN EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'beaches' AND column_name = 'latitude'
           ) THEN 'latitude'
           WHEN EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'beaches' AND column_name = 'lat'
           ) THEN 'lat'
           ELSE NULL
         END
    INTO lat_column;

  SELECT CASE 
           WHEN EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'beaches' AND column_name = 'longitude'
           ) THEN 'longitude'
           WHEN EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'beaches' AND column_name = 'lon'
           ) THEN 'lon'
           WHEN EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'beaches' AND column_name = 'lng'
           ) THEN 'lng'
           ELSE NULL
         END
    INTO lon_column;

  IF lat_column IS NULL OR lon_column IS NULL THEN
    RAISE NOTICE 'Beaches table missing coordinate columns; skipping enhanced forecast seed';
    RETURN;
  END IF;

  seed_sql := format($f$
    WITH beach_list AS (
      SELECT 
        id,
        %1$s AS latitude,
        %2$s AS longitude,
        name
      FROM beaches
      WHERE %1$s IS NOT NULL 
        AND %2$s IS NOT NULL
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
        ROUND((2 + random() * 6)::numeric, 1) as wave_height_ft,
        ROUND((8 + random() * 8)::numeric) as wave_period_sec,
        ROUND((200 + random() * 80)::numeric) as wave_direction_deg,
        ROUND((3 + 4 * sin((EXTRACT(HOUR FROM t.forecast_time::time) + random() * 6) * pi() / 12))::numeric, 2) as tide_height_ft,
        CASE WHEN random() > 0.5 THEN 'rising' ELSE 'falling' END as tide_status,
        ROUND((2 + random() * 13)::numeric, 1) as wind_speed_mph,
        ROUND((random() * 360)::numeric) as wind_direction_deg,
        ROUND((60 + random() * 15)::numeric) as air_temp_f,
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
      85,
      'SEED_DATA',
      NOW(),
      NOW()
    FROM forecast_combinations;
  $f$, quote_ident(lat_column), quote_ident(lon_column));

  EXECUTE seed_sql;
END $$;

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
