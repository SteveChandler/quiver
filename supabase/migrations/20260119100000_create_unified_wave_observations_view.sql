-- Unified Wave Observations View
-- Combines observations from IOOS with future CDIP/NDBC historical storage
-- Used by ML pipeline for forecast correction training

-- ============================================
-- View: unified_wave_observations
-- Provides a consistent interface for all wave observation sources
-- ============================================
CREATE OR REPLACE VIEW public.unified_wave_observations AS
SELECT
  'ioos' AS source,
  o.station_id,
  o.observed_at,
  o.wave_height_m,
  o.wave_period_s,
  o.wave_direction_deg,
  o.water_temp_c,
  s.latitude,
  s.longitude,
  s.nearest_beach_id,
  s.distance_to_beach_km,
  s.source_network
FROM public.ioos_observations o
JOIN public.ioos_stations s USING (station_id)
WHERE s.active = true
  AND o.wave_height_m IS NOT NULL;

-- Grant read access
GRANT SELECT ON public.unified_wave_observations TO authenticated;
GRANT SELECT ON public.unified_wave_observations TO service_role;

COMMENT ON VIEW public.unified_wave_observations IS
  'Unified view of wave observations from all sources (IOOS, future CDIP/NDBC) for ML training';

-- ============================================
-- Function: get_observations_for_beach
-- Returns recent observations near a beach for ML training
-- ============================================
CREATE OR REPLACE FUNCTION get_observations_for_beach(
  p_beach_id UUID,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  source TEXT,
  station_id TEXT,
  observed_at TIMESTAMPTZ,
  wave_height_m NUMERIC,
  wave_period_s NUMERIC,
  wave_direction_deg NUMERIC,
  water_temp_c NUMERIC,
  distance_km NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    source,
    station_id,
    observed_at,
    wave_height_m,
    wave_period_s,
    wave_direction_deg,
    water_temp_c,
    distance_to_beach_km AS distance_km
  FROM unified_wave_observations
  WHERE nearest_beach_id = p_beach_id
    AND observed_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
  ORDER BY observed_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_observations_for_beach TO authenticated;
GRANT EXECUTE ON FUNCTION get_observations_for_beach TO service_role;

-- ============================================
-- Function: get_forecast_vs_observation_pairs
-- Returns forecast predictions paired with actual observations
-- Used for ML model training and evaluation
-- Note: enhanced_forecasts stores wave data as TEXT, so we cast to NUMERIC
--
-- Performance: This function performs time-based joins between observations
-- and forecasts. Ensure the following index exists for optimal performance:
--   CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_date_time
--     ON enhanced_forecasts(beach_id, forecast_date, forecast_time);
-- ============================================
CREATE OR REPLACE FUNCTION get_forecast_vs_observation_pairs(
  p_days_back INTEGER DEFAULT 7,
  p_max_distance_km NUMERIC DEFAULT 100
)
RETURNS TABLE (
  beach_id UUID,
  observation_time TIMESTAMPTZ,
  observed_wave_height_m NUMERIC,
  observed_wave_period_s NUMERIC,
  forecast_wave_height TEXT,
  forecast_period TEXT,
  observation_source TEXT,
  station_id TEXT,
  distance_km NUMERIC,
  forecast_age_hours NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (o.observed_at, o.station_id)
    o.nearest_beach_id AS beach_id,
    o.observed_at AS observation_time,
    o.wave_height_m AS observed_wave_height_m,
    o.wave_period_s AS observed_wave_period_s,
    f.wave_height AS forecast_wave_height,
    f.wave_period AS forecast_period,
    o.source AS observation_source,
    o.station_id,
    o.distance_to_beach_km AS distance_km,
    EXTRACT(EPOCH FROM (o.observed_at - (f.forecast_date + f.forecast_time)::TIMESTAMPTZ)) / 3600 AS forecast_age_hours
  FROM unified_wave_observations o
  JOIN enhanced_forecasts f
    ON o.nearest_beach_id = f.beach_id
    AND o.observed_at BETWEEN (f.forecast_date + f.forecast_time)::TIMESTAMPTZ - INTERVAL '1 hour'
                          AND (f.forecast_date + f.forecast_time)::TIMESTAMPTZ + INTERVAL '1 hour'
  WHERE o.observed_at >= NOW() - (p_days_back || ' days')::INTERVAL
    AND o.distance_to_beach_km <= p_max_distance_km
    AND f.wave_height IS NOT NULL
  ORDER BY o.observed_at, o.station_id, ABS(EXTRACT(EPOCH FROM (o.observed_at - (f.forecast_date + f.forecast_time)::TIMESTAMPTZ)));
$$;

GRANT EXECUTE ON FUNCTION get_forecast_vs_observation_pairs TO authenticated;
GRANT EXECUTE ON FUNCTION get_forecast_vs_observation_pairs TO service_role;

COMMENT ON FUNCTION get_forecast_vs_observation_pairs IS
  'Returns forecast vs observation pairs for ML training - matches forecasts to nearby observations within 1 hour window';
