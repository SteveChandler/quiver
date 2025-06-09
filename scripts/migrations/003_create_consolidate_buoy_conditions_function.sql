-- Function to consolidate buoy conditions from nearby sources
-- Matches Ruby Buoy.consolidate(coordinates, limit:, max_distance:) functionality
-- Combines data from multiple nearby buoys to create complete weather picture

CREATE OR REPLACE FUNCTION consolidate_buoy_conditions(
  lat FLOAT,
  lng FLOAT,
  limit_count INT DEFAULT 50,
  max_distance_meters INT DEFAULT 200000
)
RETURNS TABLE (
  buoy_uuid TEXT,
  latitude FLOAT,
  longitude FLOAT,
  buoy_name TEXT,
  conditions JSONB,
  source_count INT,
  consolidation_radius_meters FLOAT
) AS $$
DECLARE
  consolidated_conditions JSONB := '{}';
  source_buoy_record RECORD;
  first_buoy_record RECORD := NULL;
  buoy_count INT := 0;
  max_distance_used FLOAT := 0;
BEGIN
  -- Get nearby buoys ordered by distance, only active ones with recent data
  FOR source_buoy_record IN
    SELECT * FROM get_nearby_buoys(lat, lng, max_distance_meters, limit_count)
    WHERE active = true 
      AND conditions IS NOT NULL
      -- Only use buoys updated within last 6 hours (matching Ruby update_conditions? logic)
      AND (conditions->>'updated_at')::int > EXTRACT(EPOCH FROM NOW() - INTERVAL '6 hours')
  LOOP
    buoy_count := buoy_count + 1;
    max_distance_used := GREATEST(max_distance_used, source_buoy_record.distance_meters);
    
    -- Store first buoy for metadata (UUID, name, location)
    IF first_buoy_record IS NULL THEN
      first_buoy_record := source_buoy_record;
    END IF;
    
    -- Consolidate missing fields (matches Ruby ||= logic)
    IF NOT consolidated_conditions ? 'air_temperature' 
       AND source_buoy_record.conditions ? 'air_temperature' 
       AND source_buoy_record.conditions->>'air_temperature' IS NOT NULL THEN
      consolidated_conditions := consolidated_conditions || 
        jsonb_build_object('air_temperature', source_buoy_record.conditions->'air_temperature');
    END IF;
    
    IF NOT consolidated_conditions ? 'water_temperature' 
       AND source_buoy_record.conditions ? 'water_temperature'
       AND source_buoy_record.conditions->>'water_temperature' IS NOT NULL THEN
      consolidated_conditions := consolidated_conditions || 
        jsonb_build_object('water_temperature', source_buoy_record.conditions->'water_temperature');
    END IF;
    
    IF NOT consolidated_conditions ? 'wave_period' 
       AND source_buoy_record.conditions ? 'wave_period'
       AND source_buoy_record.conditions->>'wave_period' IS NOT NULL THEN
      consolidated_conditions := consolidated_conditions || 
        jsonb_build_object('wave_period', source_buoy_record.conditions->'wave_period');
    END IF;
    
    IF NOT consolidated_conditions ? 'wave_height' 
       AND source_buoy_record.conditions ? 'wave_height'
       AND source_buoy_record.conditions->>'wave_height' IS NOT NULL THEN
      consolidated_conditions := consolidated_conditions || 
        jsonb_build_object('wave_height', source_buoy_record.conditions->'wave_height');
    END IF;
    
    IF NOT consolidated_conditions ? 'wind_speed' 
       AND source_buoy_record.conditions ? 'wind_speed'
       AND source_buoy_record.conditions->>'wind_speed' IS NOT NULL THEN
      consolidated_conditions := consolidated_conditions || 
        jsonb_build_object('wind_speed', source_buoy_record.conditions->'wind_speed');
    END IF;
    
    IF NOT consolidated_conditions ? 'wind_gust' 
       AND source_buoy_record.conditions ? 'wind_gust'
       AND source_buoy_record.conditions->>'wind_gust' IS NOT NULL THEN
      consolidated_conditions := consolidated_conditions || 
        jsonb_build_object('wind_gust', source_buoy_record.conditions->'wind_gust');
    END IF;
    
    IF NOT consolidated_conditions ? 'wind_direction' 
       AND source_buoy_record.conditions ? 'wind_direction'
       AND source_buoy_record.conditions->>'wind_direction' IS NOT NULL THEN
      consolidated_conditions := consolidated_conditions || 
        jsonb_build_object('wind_direction', source_buoy_record.conditions->'wind_direction') ||
        jsonb_build_object('wind_direction_name', source_buoy_record.conditions->'wind_direction_name');
    END IF;
    
    IF NOT consolidated_conditions ? 'tides' 
       AND source_buoy_record.conditions ? 'tides'
       AND source_buoy_record.conditions->>'tides' IS NOT NULL THEN
      consolidated_conditions := consolidated_conditions || 
        jsonb_build_object('tides', source_buoy_record.conditions->'tides');
    END IF;
    
    -- Add timestamps from first buoy
    IF NOT consolidated_conditions ? 'updated_at' 
       AND source_buoy_record.conditions ? 'updated_at' THEN
      consolidated_conditions := consolidated_conditions || 
        jsonb_build_object('updated_at', source_buoy_record.conditions->'updated_at');
    END IF;
    
    -- Check if we have complete data (matches Ruby complete? method)
    IF consolidated_conditions ? 'air_temperature'
       AND consolidated_conditions ? 'water_temperature'
       AND consolidated_conditions ? 'wave_period'
       AND consolidated_conditions ? 'wave_height'
       AND consolidated_conditions ? 'wind_speed'
       AND consolidated_conditions ? 'wind_gust'
       AND consolidated_conditions ? 'wind_direction'
       AND consolidated_conditions ? 'tides' THEN
      -- We have complete data, break early
      EXIT;
    END IF;
  END LOOP;
  
  -- Return the consolidated buoy if we found any data
  IF first_buoy_record IS NOT NULL THEN
    RETURN QUERY SELECT 
      first_buoy_record.buoy_uuid,
      first_buoy_record.latitude,
      first_buoy_record.longitude,
      first_buoy_record.buoy_name,
      consolidated_conditions,
      buoy_count,
      max_distance_used;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Add function documentation
COMMENT ON FUNCTION consolidate_buoy_conditions(FLOAT, FLOAT, INT, INT) IS 
'Consolidate weather conditions from multiple nearby buoys to create complete data set. Returns combined conditions with source metadata.'; 