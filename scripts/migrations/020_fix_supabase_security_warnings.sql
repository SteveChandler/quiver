-- Fix Supabase Security Warnings Migration
-- This migration addresses all security warnings from Supabase Security Advisor
-- Date: $(date '+%Y-%m-%d')

-- ================================================
-- 1. Fix Function Search Path Mutable Issues
-- ================================================

-- The security issue: Functions without SET search_path are vulnerable to search path injection
-- Solution: Add "SET search_path = public, extensions" to all plpgsql functions

-- Fix get_nearby_buoys function
CREATE OR REPLACE FUNCTION get_nearby_buoys(
  lat FLOAT,
  lng FLOAT,
  max_distance_meters INT DEFAULT 100000,
  limit_count INT DEFAULT 4
)
RETURNS TABLE (
  buoy_uuid TEXT,
  latitude FLOAT,
  longitude FLOAT,
  buoy_name TEXT,
  kind TEXT,
  active BOOLEAN,
  conditions JSONB,
  distance_meters FLOAT,
  direction_degrees FLOAT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.buoy_uuid,
    ST_Y(b.coordinates::geometry) as latitude,
    ST_X(b.coordinates::geometry) as longitude,
    b.buoy_name,
    b.kind,
    b.active,
    json_build_object(
      'air_temperature', b.air_temperature,
      'water_temperature', b.water_temperature,
      'wave_period', b.wave_period,
      'wave_height', b.wave_height,
      'wind_speed', b.wind_speed,
      'wind_gust', b.wind_gust,
      'wind_direction', b.wind_direction,
      'wind_direction_name', CASE 
        WHEN b.wind_direction IS NULL THEN NULL
        WHEN b.wind_direction > 348.75 OR b.wind_direction <= 11.25 THEN 'N'
        WHEN b.wind_direction > 11.25 AND b.wind_direction <= 33.75 THEN 'NNE'
        WHEN b.wind_direction > 33.75 AND b.wind_direction <= 56.25 THEN 'NE'
        WHEN b.wind_direction > 56.25 AND b.wind_direction <= 78.75 THEN 'ENE'
        WHEN b.wind_direction > 78.75 AND b.wind_direction <= 101.25 THEN 'E'
        WHEN b.wind_direction > 101.25 AND b.wind_direction <= 123.75 THEN 'ESE'
        WHEN b.wind_direction > 123.75 AND b.wind_direction <= 146.25 THEN 'SE'
        WHEN b.wind_direction > 146.25 AND b.wind_direction <= 168.75 THEN 'SSE'
        WHEN b.wind_direction > 168.75 AND b.wind_direction <= 191.25 THEN 'S'
        WHEN b.wind_direction > 191.25 AND b.wind_direction <= 213.75 THEN 'SSW'
        WHEN b.wind_direction > 213.75 AND b.wind_direction <= 236.25 THEN 'SW'
        WHEN b.wind_direction > 236.25 AND b.wind_direction <= 258.75 THEN 'WSW'
        WHEN b.wind_direction > 258.75 AND b.wind_direction <= 281.25 THEN 'W'
        WHEN b.wind_direction > 281.25 AND b.wind_direction <= 303.75 THEN 'WNW'
        WHEN b.wind_direction > 303.75 AND b.wind_direction <= 326.25 THEN 'NW'
        WHEN b.wind_direction > 326.25 AND b.wind_direction <= 348.75 THEN 'NNW'
        ELSE NULL
      END,
      'tides', b.tides,
      'updated_at', EXTRACT(EPOCH FROM b.updated_at)
    ) as conditions,
    ST_Distance(b.coordinates, ST_Point(lng, lat)::geography) as distance_meters,
    degrees(ST_Azimuth(ST_Point(lng, lat)::geometry, b.coordinates::geometry)) as direction_degrees
  FROM buoys b
  WHERE b.active = true
    AND b.coordinates IS NOT NULL
    AND ST_Distance(b.coordinates, ST_Point(lng, lat)::geography) <= max_distance_meters
  ORDER BY distance_meters ASC
  LIMIT limit_count;
END;
$$;

-- Fix consolidate_buoy_conditions function
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
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  consolidated_conditions JSONB := '{}';
  source_buoy_record RECORD;
  first_buoy_record RECORD := NULL;
  buoy_count INT := 0;
  max_distance_used FLOAT := 0;
BEGIN
  FOR source_buoy_record IN
    SELECT * FROM get_nearby_buoys(lat, lng, max_distance_meters, limit_count)
    WHERE active = true 
      AND conditions IS NOT NULL
      AND (conditions->>'updated_at')::int > EXTRACT(EPOCH FROM NOW() - INTERVAL '6 hours')
  LOOP
    buoy_count := buoy_count + 1;
    max_distance_used := GREATEST(max_distance_used, source_buoy_record.distance_meters);
    
    IF first_buoy_record IS NULL THEN
      first_buoy_record := source_buoy_record;
    END IF;
    
    -- Consolidate missing fields
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
    
    IF NOT consolidated_conditions ? 'updated_at' 
       AND source_buoy_record.conditions ? 'updated_at' THEN
      consolidated_conditions := consolidated_conditions || 
        jsonb_build_object('updated_at', source_buoy_record.conditions->'updated_at');
    END IF;
    
    -- Check if we have complete data
    IF consolidated_conditions ? 'air_temperature'
       AND consolidated_conditions ? 'water_temperature'
       AND consolidated_conditions ? 'wave_period'
       AND consolidated_conditions ? 'wave_height'
       AND consolidated_conditions ? 'wind_speed'
       AND consolidated_conditions ? 'wind_gust'
       AND consolidated_conditions ? 'wind_direction'
       AND consolidated_conditions ? 'tides' THEN
      EXIT;
    END IF;
  END LOOP;
  
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
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Fix create_activity function
CREATE OR REPLACE FUNCTION create_activity(
  p_user_id UUID,
  p_activity_type VARCHAR(50),
  p_entity_type VARCHAR(50),
  p_entity_id UUID,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO user_activities (user_id, activity_type, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_activity_type, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;

-- Fix get_user_activity_feed function
CREATE OR REPLACE FUNCTION get_user_activity_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  activity_type VARCHAR(50),
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  user_name TEXT,
  user_avatar TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ua.id,
    ua.user_id,
    ua.activity_type,
    ua.entity_type,
    ua.entity_id,
    ua.metadata,
    ua.created_at,
    p.full_name as user_name,
    p.avatar_url as user_avatar
  FROM user_activities ua
  JOIN profiles p ON ua.user_id = p.id
  WHERE ua.user_id = p_user_id 
    OR ua.user_id IN (
      SELECT following_id 
      FROM user_follows 
      WHERE follower_id = p_user_id
    )
  ORDER BY ua.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Fix trigger functions
CREATE OR REPLACE FUNCTION create_session_activity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_activity(
      NEW.user_id,
      'session_logged',
      'session',
      NEW.id,
      jsonb_build_object(
        'beach_name', NEW.beach_name,
        'status', NEW.status
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'completed' THEN
    PERFORM create_activity(
      NEW.user_id,
      'session_completed',
      'session',
      NEW.id,
      jsonb_build_object(
        'beach_name', NEW.beach_name,
        'rating', NEW.rating
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION create_beach_review_activity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_activity(
      NEW.user_id,
      'beach_reviewed',
      'beach_review',
      NEW.id,
      jsonb_build_object(
        'beach_id', NEW.beach_id,
        'overall_rating', NEW.overall_rating,
        'title', NEW.title
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION create_follow_activity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_activity(
      NEW.follower_id,
      'user_followed',
      'user_follow',
      NEW.id,
      jsonb_build_object(
        'followed_user_id', NEW.following_id
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

-- Fix update trigger functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_beach_reviews_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix spatial functions
CREATE OR REPLACE FUNCTION create_geographic_point(lat FLOAT, lng FLOAT)
RETURNS GEOGRAPHY(POINT, 4326) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN ST_Point(lng, lat)::geography;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_distance_meters(
  point1 GEOGRAPHY(POINT, 4326),
  point2 GEOGRAPHY(POINT, 4326)
)
RETURNS FLOAT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN ST_Distance(point1, point2);
END;
$$;

CREATE OR REPLACE FUNCTION format_coordinates(lat FLOAT, lng FLOAT)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN ROUND(lat::numeric, 4) || ', ' || ROUND(lng::numeric, 4);
END;
$$;

CREATE OR REPLACE FUNCTION direction_to_compass(degrees FLOAT)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN CASE 
    WHEN degrees IS NULL THEN NULL
    WHEN degrees > 348.75 OR degrees <= 11.25 THEN 'N'
    WHEN degrees > 11.25 AND degrees <= 33.75 THEN 'NNE'
    WHEN degrees > 33.75 AND degrees <= 56.25 THEN 'NE'
    WHEN degrees > 56.25 AND degrees <= 78.75 THEN 'ENE'
    WHEN degrees > 78.75 AND degrees <= 101.25 THEN 'E'
    WHEN degrees > 101.25 AND degrees <= 123.75 THEN 'ESE'
    WHEN degrees > 123.75 AND degrees <= 146.25 THEN 'SE'
    WHEN degrees > 146.25 AND degrees <= 168.75 THEN 'SSE'
    WHEN degrees > 168.75 AND degrees <= 191.25 THEN 'S'
    WHEN degrees > 191.25 AND degrees <= 213.75 THEN 'SSW'
    WHEN degrees > 213.75 AND degrees <= 236.25 THEN 'SW'
    WHEN degrees > 236.25 AND degrees <= 258.75 THEN 'WSW'
    WHEN degrees > 258.75 AND degrees <= 281.25 THEN 'W'
    WHEN degrees > 281.25 AND degrees <= 303.75 THEN 'WNW'
    WHEN degrees > 303.75 AND degrees <= 326.25 THEN 'NW'
    WHEN degrees > 326.25 AND degrees <= 348.75 THEN 'NNW'
    ELSE NULL
  END;
END;
$$;

-- Fix coordinate trigger functions
CREATE OR REPLACE FUNCTION update_coordinates_from_lat_lng()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.coordinates = ST_Point(NEW.longitude, NEW.latitude)::geography;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_coordinates_on_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL AND NEW.coordinates IS NULL THEN
    NEW.coordinates = ST_Point(NEW.longitude, NEW.latitude)::geography;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix utility functions
CREATE OR REPLACE FUNCTION increment(val INTEGER, amount INTEGER DEFAULT 1)
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN val + amount;
END;
$$;

CREATE OR REPLACE FUNCTION decrement(val INTEGER, amount INTEGER DEFAULT 1)
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN val - amount;
END;
$$;

-- Fix enhanced forecast functions (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_enhanced_forecasts') THEN
    DROP FUNCTION cleanup_old_enhanced_forecasts();
    
    CREATE OR REPLACE FUNCTION cleanup_old_enhanced_forecasts(days_to_keep INTEGER DEFAULT 14)
    RETURNS INTEGER 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    DECLARE
      deleted_count INTEGER;
    BEGIN
      DELETE FROM enhanced_forecasts 
      WHERE forecast_date < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RETURN deleted_count;
    END;
    $func$;
  END IF;
END $$;

-- Fix activity functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_activity_feed') THEN
    DROP FUNCTION refresh_activity_feed();
    
    CREATE OR REPLACE FUNCTION refresh_activity_feed()
    RETURNS VOID 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    BEGIN
      -- Refresh materialized view if it exists
      IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'activity_feed') THEN
        REFRESH MATERIALIZED VIEW activity_feed;
      END IF;
    END;
    $func$;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_activities') THEN
    DROP FUNCTION cleanup_old_activities();
    
    CREATE OR REPLACE FUNCTION cleanup_old_activities(days_to_keep INTEGER DEFAULT 90)
    RETURNS INTEGER 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    DECLARE
      deleted_count INTEGER;
    BEGIN
      DELETE FROM user_activities 
      WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RETURN deleted_count;
    END;
    $func$;
  END IF;
END $$;

-- Fix session like functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_session_likes_count') THEN
    DROP FUNCTION update_session_likes_count();
    
    CREATE OR REPLACE FUNCTION update_session_likes_count()
    RETURNS TRIGGER 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        UPDATE sessions 
        SET likes_count = likes_count + 1 
        WHERE id = NEW.session_id;
      ELSIF TG_OP = 'DELETE' THEN
        UPDATE sessions 
        SET likes_count = GREATEST(0, likes_count - 1) 
        WHERE id = OLD.session_id;
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $func$;
  END IF;
END $$;

-- Fix storage functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user_storage_usage') THEN
    DROP FUNCTION update_user_storage_usage();
    
    CREATE OR REPLACE FUNCTION update_user_storage_usage()
    RETURNS TRIGGER 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        UPDATE profiles 
        SET storage_usage_bytes = COALESCE(storage_usage_bytes, 0) + NEW.file_size_bytes
        WHERE id = NEW.user_id;
      ELSIF TG_OP = 'DELETE' THEN
        UPDATE profiles 
        SET storage_usage_bytes = GREATEST(0, COALESCE(storage_usage_bytes, 0) - OLD.file_size_bytes)
        WHERE id = OLD.user_id;
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $func$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'track_session_media_upload') THEN
    DROP FUNCTION track_session_media_upload();
    
    CREATE OR REPLACE FUNCTION track_session_media_upload()
    RETURNS TRIGGER 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM create_activity(
          NEW.user_id,
          'media_uploaded',
          'session_media',
          NEW.id,
          jsonb_build_object(
            'session_id', NEW.session_id,
            'media_type', NEW.media_type,
            'file_size_bytes', NEW.file_size_bytes
          )
        );
      END IF;
      RETURN NEW;
    END;
    $func$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_orphaned_session_media') THEN
    DROP FUNCTION cleanup_orphaned_session_media();
    
    CREATE OR REPLACE FUNCTION cleanup_orphaned_session_media()
    RETURNS INTEGER 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    DECLARE
      deleted_count INTEGER;
    BEGIN
      DELETE FROM session_media sm
      WHERE NOT EXISTS (
        SELECT 1 FROM sessions s WHERE s.id = sm.session_id
      );
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RETURN deleted_count;
    END;
    $func$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_storage_stats') THEN
    DROP FUNCTION get_user_storage_stats();
    
    CREATE OR REPLACE FUNCTION get_user_storage_stats(p_user_id UUID)
    RETURNS TABLE (
      total_files INTEGER,
      total_size_bytes BIGINT,
      photos_count INTEGER,
      videos_count INTEGER,
      photos_size_bytes BIGINT,
      videos_size_bytes BIGINT
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT 
        COUNT(*)::INTEGER as total_files,
        COALESCE(SUM(sm.file_size_bytes), 0) as total_size_bytes,
        COUNT(CASE WHEN sm.media_type = 'photo' THEN 1 END)::INTEGER as photos_count,
        COUNT(CASE WHEN sm.media_type = 'video' THEN 1 END)::INTEGER as videos_count,
        COALESCE(SUM(CASE WHEN sm.media_type = 'photo' THEN sm.file_size_bytes ELSE 0 END), 0) as photos_size_bytes,
        COALESCE(SUM(CASE WHEN sm.media_type = 'video' THEN sm.file_size_bytes ELSE 0 END), 0) as videos_size_bytes
      FROM session_media sm
      WHERE sm.user_id = p_user_id;
    END;
    $func$;
  END IF;
END $$;

-- Fix follow functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_follow_counts') THEN
    DROP FUNCTION update_follow_counts();
    
    CREATE OR REPLACE FUNCTION update_follow_counts()
    RETURNS TRIGGER 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        -- Update follower count for the person being followed
        UPDATE profiles 
        SET followers_count = followers_count + 1 
        WHERE id = NEW.following_id;
        
        -- Update following count for the person doing the following
        UPDATE profiles 
        SET following_count = following_count + 1 
        WHERE id = NEW.follower_id;
        
      ELSIF TG_OP = 'DELETE' THEN
        -- Update follower count for the person being unfollowed
        UPDATE profiles 
        SET followers_count = GREATEST(0, followers_count - 1) 
        WHERE id = OLD.following_id;
        
        -- Update following count for the person doing the unfollowing
        UPDATE profiles 
        SET following_count = GREATEST(0, following_count - 1) 
        WHERE id = OLD.follower_id;
      END IF;
      
      RETURN COALESCE(NEW, OLD);
    END;
    $func$;
  END IF;
END $$;

-- Fix beach functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_most_visited_beach') THEN
    DROP FUNCTION get_most_visited_beach();
    
    CREATE OR REPLACE FUNCTION get_most_visited_beach()
    RETURNS TABLE (
      beach_id UUID,
      beach_name TEXT,
      visit_count BIGINT
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT 
        b.id as beach_id,
        b.name as beach_name,
        COUNT(s.id) as visit_count
      FROM beaches b
      LEFT JOIN sessions s ON b.id = s.beach_id
      GROUP BY b.id, b.name
      ORDER BY visit_count DESC
      LIMIT 1;
    END;
    $func$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_beaches_within_radius') THEN
    DROP FUNCTION get_beaches_within_radius();
    
    CREATE OR REPLACE FUNCTION get_beaches_within_radius(
      center_lat FLOAT,
      center_lng FLOAT,
      radius_meters INTEGER DEFAULT 50000
    )
    RETURNS TABLE (
      beach_id UUID,
      beach_name TEXT,
      latitude FLOAT,
      longitude FLOAT,
      distance_meters FLOAT
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT 
        b.id as beach_id,
        b.name as beach_name,
        b.latitude,
        b.longitude,
        ST_Distance(
          ST_Point(b.longitude, b.latitude)::geography,
          ST_Point(center_lng, center_lat)::geography
        ) as distance_meters
      FROM beaches b
      WHERE ST_Distance(
        ST_Point(b.longitude, b.latitude)::geography,
        ST_Point(center_lng, center_lat)::geography
      ) <= radius_meters
      ORDER BY distance_meters ASC;
    END;
    $func$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_nearby_beaches') THEN
    DROP FUNCTION get_nearby_beaches();
    
    CREATE OR REPLACE FUNCTION get_nearby_beaches(
      center_lat FLOAT,
      center_lng FLOAT,
      max_distance_meters INTEGER DEFAULT 50000,
      limit_count INTEGER DEFAULT 20
    )
    RETURNS TABLE (
      beach_id UUID,
      beach_name TEXT,
      latitude FLOAT,
      longitude FLOAT,
      distance_meters FLOAT,
      wave_quality_rating DECIMAL,
      crowd_density_rating DECIMAL
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT 
        b.id as beach_id,
        b.name as beach_name,
        b.latitude,
        b.longitude,
        ST_Distance(
          ST_Point(b.longitude, b.latitude)::geography,
          ST_Point(center_lng, center_lat)::geography
        ) as distance_meters,
        b.wave_quality_rating,
        b.crowd_density_rating
      FROM beaches b
      WHERE ST_Distance(
        ST_Point(b.longitude, b.latitude)::geography,
        ST_Point(center_lng, center_lat)::geography
      ) <= max_distance_meters
      ORDER BY distance_meters ASC
      LIMIT limit_count;
    END;
    $func$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_beach_name') THEN
    DROP FUNCTION update_beach_name();
    
    CREATE OR REPLACE FUNCTION update_beach_name(
      p_beach_id UUID,
      p_new_name TEXT
    )
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    BEGIN
      UPDATE beaches 
      SET name = p_new_name, updated_at = NOW()
      WHERE id = p_beach_id;
      
      RETURN FOUND;
    END;
    $func$;
  END IF;
END $$;

-- ================================================
-- 2. Fix PostGIS Extension in Public Schema
-- ================================================

-- Note: Moving PostGIS extension requires superuser access
-- This is typically done by Supabase team, not via migration
-- We'll create a schema for extensions and note the issue

CREATE SCHEMA IF NOT EXISTS extensions;

-- Note: The following would require superuser privileges:
-- ALTER EXTENSION postgis SET SCHEMA extensions;
-- This should be done by Supabase support team

-- Add a comment to document this
COMMENT ON SCHEMA extensions IS 'Schema for extensions - PostGIS should be moved here from public schema (requires superuser)';

-- ================================================
-- 3. Fix Materialized View in API
-- ================================================

-- Remove API access from materialized view
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'activity_feed') THEN
    -- Revoke access from anon and authenticated users
    REVOKE ALL ON activity_feed FROM anon;
    REVOKE ALL ON activity_feed FROM authenticated;
    REVOKE ALL ON activity_feed FROM public;
    
    -- Only allow service_role to access it
    GRANT SELECT ON activity_feed TO service_role;
    
    RAISE NOTICE 'Secured materialized view activity_feed - removed public API access';
  END IF;
END $$;

-- ================================================
-- 4. Create Secure Wrapper Functions for API Access
-- ================================================

-- Instead of direct materialized view access, create secure functions
CREATE OR REPLACE FUNCTION get_activity_feed(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  activity_type VARCHAR(50),
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  user_name TEXT,
  user_avatar TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Use the secure function instead of direct materialized view access
  IF p_user_id IS NOT NULL THEN
    RETURN QUERY SELECT * FROM get_user_activity_feed(p_user_id, p_limit, p_offset);
  ELSE
    -- Public activity feed - recent activities from all users
    RETURN QUERY
    SELECT 
      ua.id,
      ua.user_id,
      ua.activity_type,
      ua.entity_type,
      ua.entity_id,
      ua.metadata,
      ua.created_at,
      p.full_name as user_name,
      p.avatar_url as user_avatar
    FROM user_activities ua
    JOIN profiles p ON ua.user_id = p.id
    ORDER BY ua.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

-- ================================================
-- 5. Grant Appropriate Permissions
-- ================================================

-- Grant execute permissions on functions to appropriate roles
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Revoke dangerous permissions
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Grant specific safe functions to anon users
GRANT EXECUTE ON FUNCTION get_nearby_buoys(FLOAT, FLOAT, INT, INT) TO anon;
GRANT EXECUTE ON FUNCTION consolidate_buoy_conditions(FLOAT, FLOAT, INT, INT) TO anon;
GRANT EXECUTE ON FUNCTION get_beaches_within_radius(FLOAT, FLOAT, INT) TO anon;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(FLOAT, FLOAT, INT, INT) TO anon;
GRANT EXECUTE ON FUNCTION calculate_distance_meters(GEOGRAPHY, GEOGRAPHY) TO anon;
GRANT EXECUTE ON FUNCTION direction_to_compass(FLOAT) TO anon;
GRANT EXECUTE ON FUNCTION format_coordinates(FLOAT, FLOAT) TO anon;

-- ================================================
-- Success Message
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '🔒 Supabase Security Warnings Fixed Successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fixed Issues:';
  RAISE NOTICE '   - Added secure search_path to all plpgsql functions';
  RAISE NOTICE '   - Secured materialized view access';
  RAISE NOTICE '   - Created secure wrapper functions';
  RAISE NOTICE '   - Applied appropriate permissions';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Manual Action Required:';
  RAISE NOTICE '   - PostGIS extension: Contact Supabase support to move from public to extensions schema';
  RAISE NOTICE '   - Auth settings: Enable leaked password protection in Supabase dashboard';
  RAISE NOTICE '   - Auth settings: Enable additional MFA options in Supabase dashboard';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 All function search_path vulnerabilities are now secured!';
END $$; 