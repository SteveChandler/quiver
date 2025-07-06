-- Fix Supabase Security Warnings: Function Search Path Mutable
-- This migration addresses the security warnings by setting proper search_path on functions

BEGIN;

-- ================================================
-- 1. Fix Functions with Mutable Search Path
-- ================================================

-- Note: We'll recreate the functions with SECURITY DEFINER and proper search_path
-- This ensures they run with elevated privileges but in a secure context

-- Fix get_most_visited_beach function
DROP FUNCTION IF EXISTS get_most_visited_beach();
CREATE OR REPLACE FUNCTION get_most_visited_beach()
RETURNS TABLE(beach_id UUID, visit_count BIGINT, beach_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as beach_id,
    COUNT(s.id) as visit_count,
    b.name as beach_name
  FROM beaches b
  LEFT JOIN sessions s ON b.id = s.beach_id
  GROUP BY b.id, b.name
  ORDER BY visit_count DESC
  LIMIT 1;
END;
$$;

-- Fix get_beaches_within_radius function
DROP FUNCTION IF EXISTS get_beaches_within_radius(FLOAT, FLOAT, INTEGER);
CREATE OR REPLACE FUNCTION get_beaches_within_radius(
  center_lat FLOAT,
  center_lng FLOAT,
  radius_meters INTEGER DEFAULT 50000
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  latitude FLOAT,
  longitude FLOAT,
  distance_meters FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.latitude::FLOAT,
    b.longitude::FLOAT,
    ST_Distance(
      ST_Point(center_lng, center_lat)::geography,
      ST_Point(b.longitude, b.latitude)::geography
    )::FLOAT as distance_meters
  FROM beaches b
  WHERE ST_Distance(
    ST_Point(center_lng, center_lat)::geography,
    ST_Point(b.longitude, b.latitude)::geography
  ) <= radius_meters
  ORDER BY distance_meters ASC;
END;
$$;

-- Fix update_beach_name function
DROP FUNCTION IF EXISTS update_beach_name(UUID, TEXT);
CREATE OR REPLACE FUNCTION update_beach_name(beach_uuid UUID, new_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE beaches 
  SET name = new_name, updated_at = NOW()
  WHERE id = beach_uuid;
  
  RETURN FOUND;
END;
$$;

-- Fix increment function
DROP FUNCTION IF EXISTS increment(INTEGER, INTEGER);
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

-- Fix decrement function
DROP FUNCTION IF EXISTS decrement(INTEGER, INTEGER);
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

-- Fix cleanup_old_enhanced_forecasts function
DROP FUNCTION IF EXISTS cleanup_old_enhanced_forecasts(INTEGER);
CREATE OR REPLACE FUNCTION cleanup_old_enhanced_forecasts(days_to_keep INTEGER DEFAULT 14)
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM enhanced_forecasts 
  WHERE forecast_date < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Fix refresh_activity_feed function
DROP FUNCTION IF EXISTS refresh_activity_feed();
CREATE OR REPLACE FUNCTION refresh_activity_feed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Refresh the materialized view if it exists
  IF EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE schemaname = 'public' AND matviewname = 'activity_feed'
  ) THEN
    REFRESH MATERIALIZED VIEW activity_feed;
  END IF;
END;
$$;

-- Fix cleanup_old_activities function
DROP FUNCTION IF EXISTS cleanup_old_activities(INTEGER);
CREATE OR REPLACE FUNCTION cleanup_old_activities(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_activities 
  WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Fix create_beach_review_activity function
DROP FUNCTION IF EXISTS create_beach_review_activity(UUID, UUID, UUID);
CREATE OR REPLACE FUNCTION create_beach_review_activity(
  p_user_id UUID,
  p_beach_id UUID,
  p_review_id UUID
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
  VALUES (
    p_user_id, 
    'beach_review', 
    'beach_review', 
    p_review_id,
    jsonb_build_object('beach_id', p_beach_id)
  )
  RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;

-- Fix create_follow_activity function
DROP FUNCTION IF EXISTS create_follow_activity(UUID, UUID);
CREATE OR REPLACE FUNCTION create_follow_activity(
  follower_id UUID,
  following_id UUID
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
  VALUES (
    follower_id,
    'follow',
    'user',
    following_id,
    jsonb_build_object('following_id', following_id)
  )
  RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;

-- Fix update_session_likes_count function (handle triggers)
-- Drop existing triggers first
DROP TRIGGER IF EXISTS update_session_likes_count_insert ON session_likes;
DROP TRIGGER IF EXISTS update_session_likes_count_delete ON session_likes;

-- Now we can safely drop and recreate the function
DROP FUNCTION IF EXISTS update_session_likes_count();
CREATE OR REPLACE FUNCTION update_session_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sessions 
    SET likes_count = likes_count + 1
    WHERE id = NEW.session_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sessions 
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.session_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Recreate the triggers
CREATE TRIGGER update_session_likes_count_insert
  AFTER INSERT ON session_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_session_likes_count();

CREATE TRIGGER update_session_likes_count_delete
  AFTER DELETE ON session_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_session_likes_count();

-- ================================================
-- 2. Continue with remaining functions...
-- ================================================

-- Fix update_beach_reviews_updated_at function (handle potential triggers)
-- Drop potential triggers first (if they exist)
DROP TRIGGER IF EXISTS update_beach_reviews_updated_at ON beach_reviews;

-- Now we can safely drop and recreate the function
DROP FUNCTION IF EXISTS update_beach_reviews_updated_at();
CREATE OR REPLACE FUNCTION update_beach_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate trigger (this trigger exists in the schema)
CREATE TRIGGER update_beach_reviews_updated_at
  BEFORE UPDATE ON beach_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_beach_reviews_updated_at();

-- Fix create_geographic_point function
DROP FUNCTION IF EXISTS create_geographic_point(FLOAT, FLOAT);
CREATE OR REPLACE FUNCTION create_geographic_point(lat FLOAT, lng FLOAT)
RETURNS geography
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN ST_Point(lng, lat)::geography;
END;
$$;

-- Fix calculate_distance_meters function
DROP FUNCTION IF EXISTS calculate_distance_meters(geography, geography);
CREATE OR REPLACE FUNCTION calculate_distance_meters(point1 geography, point2 geography)
RETURNS FLOAT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN ST_Distance(point1, point2);
END;
$$;

-- Fix format_coordinates function
DROP FUNCTION IF EXISTS format_coordinates(FLOAT, FLOAT);
CREATE OR REPLACE FUNCTION format_coordinates(lat FLOAT, lng FLOAT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN FORMAT('%.6f, %.6f', lat, lng);
END;
$$;

-- Fix direction_to_compass function
DROP FUNCTION IF EXISTS direction_to_compass(INTEGER);
CREATE OR REPLACE FUNCTION direction_to_compass(degrees INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  CASE 
    WHEN degrees IS NULL THEN RETURN NULL;
    WHEN degrees > 348.75 OR degrees <= 11.25 THEN RETURN 'N';
    WHEN degrees > 11.25 AND degrees <= 33.75 THEN RETURN 'NNE';
    WHEN degrees > 33.75 AND degrees <= 56.25 THEN RETURN 'NE';
    WHEN degrees > 56.25 AND degrees <= 78.75 THEN RETURN 'ENE';
    WHEN degrees > 78.75 AND degrees <= 101.25 THEN RETURN 'E';
    WHEN degrees > 101.25 AND degrees <= 123.75 THEN RETURN 'ESE';
    WHEN degrees > 123.75 AND degrees <= 146.25 THEN RETURN 'SE';
    WHEN degrees > 146.25 AND degrees <= 168.75 THEN RETURN 'SSE';
    WHEN degrees > 168.75 AND degrees <= 191.25 THEN RETURN 'S';
    WHEN degrees > 191.25 AND degrees <= 213.75 THEN RETURN 'SSW';
    WHEN degrees > 213.75 AND degrees <= 236.25 THEN RETURN 'SW';
    WHEN degrees > 236.25 AND degrees <= 258.75 THEN RETURN 'WSW';
    WHEN degrees > 258.75 AND degrees <= 281.25 THEN RETURN 'W';
    WHEN degrees > 281.25 AND degrees <= 303.75 THEN RETURN 'WNW';
    WHEN degrees > 303.75 AND degrees <= 326.25 THEN RETURN 'NW';
    WHEN degrees > 326.25 AND degrees <= 348.75 THEN RETURN 'NNW';
    ELSE RETURN 'UNKNOWN';
  END CASE;
END;
$$;

-- Fix remaining trigger functions

-- Fix update_profiles_updated_at function (handle potential triggers)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP FUNCTION IF EXISTS update_profiles_updated_at();
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate the profiles updated_at trigger
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Fix update_updated_at_column function (handle potential triggers)
DROP FUNCTION IF EXISTS update_updated_at_column();
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix update_coordinates_from_lat_lng function (handle potential triggers)
DROP TRIGGER IF EXISTS update_beaches_coordinates ON beaches;
DROP FUNCTION IF EXISTS update_coordinates_from_lat_lng();
CREATE OR REPLACE FUNCTION update_coordinates_from_lat_lng()
RETURNS trigger
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

-- Recreate the beaches coordinates update trigger
CREATE TRIGGER update_beaches_coordinates
  BEFORE UPDATE ON beaches
  FOR EACH ROW
  EXECUTE FUNCTION update_coordinates_from_lat_lng();

-- Fix set_coordinates_on_insert function (handle potential triggers)
DROP TRIGGER IF EXISTS set_beaches_coordinates_on_insert ON beaches;
DROP FUNCTION IF EXISTS set_coordinates_on_insert();
CREATE OR REPLACE FUNCTION set_coordinates_on_insert()
RETURNS trigger
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

-- Recreate the beaches coordinates insert trigger
CREATE TRIGGER set_beaches_coordinates_on_insert
  BEFORE INSERT ON beaches
  FOR EACH ROW
  EXECUTE FUNCTION set_coordinates_on_insert();

-- Fix consolidate_buoy_conditions function
DROP FUNCTION IF EXISTS consolidate_buoy_conditions();
CREATE OR REPLACE FUNCTION consolidate_buoy_conditions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Consolidate duplicate buoy condition records
  DELETE FROM buoy_conditions bc1
  WHERE EXISTS (
    SELECT 1 FROM buoy_conditions bc2
    WHERE bc2.buoy_id = bc1.buoy_id
      AND bc2.timestamp > bc1.timestamp
      AND bc2.created_at > bc1.created_at
  );
END;
$$;

-- Fix get_user_activity_feed function
DROP FUNCTION IF EXISTS get_user_activity_feed(UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_user_activity_feed(
  user_uuid UUID,
  activity_limit INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  activity_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ
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
    ua.created_at
  FROM user_activities ua
  WHERE ua.user_id = user_uuid
  ORDER BY ua.created_at DESC
  LIMIT activity_limit
  OFFSET offset_count;
END;
$$;

-- Fix remaining storage and media functions
-- Drop storage usage triggers first
DROP TRIGGER IF EXISTS update_user_storage_usage_insert ON session_media;
DROP TRIGGER IF EXISTS update_user_storage_usage_delete ON session_media;

DROP FUNCTION IF EXISTS update_user_storage_usage();
CREATE OR REPLACE FUNCTION update_user_storage_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Update user storage usage when session media is added/removed
  IF TG_OP = 'INSERT' THEN
    -- Add to storage usage
    UPDATE profiles 
    SET storage_used = COALESCE(storage_used, 0) + COALESCE(NEW.file_size, 0)
    WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Subtract from storage usage
    UPDATE profiles 
    SET storage_used = GREATEST(0, COALESCE(storage_used, 0) - COALESCE(OLD.file_size, 0))
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Recreate storage usage triggers
CREATE TRIGGER update_user_storage_usage_insert
  AFTER INSERT ON session_media
  FOR EACH ROW
  EXECUTE FUNCTION update_user_storage_usage();

CREATE TRIGGER update_user_storage_usage_delete
  AFTER DELETE ON session_media
  FOR EACH ROW
  EXECUTE FUNCTION update_user_storage_usage();

DROP FUNCTION IF EXISTS track_session_media_upload(UUID, UUID, TEXT, BIGINT);
CREATE OR REPLACE FUNCTION track_session_media_upload(
  p_user_id UUID,
  p_session_id UUID,
  p_file_name TEXT,
  p_file_size BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  media_id UUID;
BEGIN
  INSERT INTO session_media (user_id, session_id, file_name, file_size)
  VALUES (p_user_id, p_session_id, p_file_name, p_file_size)
  RETURNING id INTO media_id;
  
  RETURN media_id;
END;
$$;

DROP FUNCTION IF EXISTS cleanup_orphaned_session_media(INTEGER);
CREATE OR REPLACE FUNCTION cleanup_orphaned_session_media(days_old INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM session_media 
  WHERE session_id IS NULL 
    AND created_at < NOW() - INTERVAL '1 day' * days_old;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

DROP FUNCTION IF EXISTS get_user_storage_stats(UUID);
CREATE OR REPLACE FUNCTION get_user_storage_stats(user_uuid UUID)
RETURNS TABLE(
  total_files BIGINT,
  total_size BIGINT,
  storage_limit BIGINT,
  storage_used BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(sm.id) as total_files,
    COALESCE(SUM(sm.file_size), 0) as total_size,
    COALESCE(p.storage_limit, 104857600) as storage_limit, -- 100MB default
    COALESCE(p.storage_used, 0) as storage_used
  FROM profiles p
  LEFT JOIN session_media sm ON p.id = sm.user_id
  WHERE p.id = user_uuid
  GROUP BY p.id, p.storage_limit, p.storage_used;
END;
$$;

-- Drop triggers first for follow counts
DROP TRIGGER IF EXISTS update_follow_counts_insert ON user_follows;
DROP TRIGGER IF EXISTS update_follow_counts_delete ON user_follows;

DROP FUNCTION IF EXISTS update_follow_counts();
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment following count for follower
    UPDATE profiles 
    SET following_count = following_count + 1
    WHERE id = NEW.follower_id;
    
    -- Increment followers count for following
    UPDATE profiles 
    SET followers_count = followers_count + 1
    WHERE id = NEW.following_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement following count for follower
    UPDATE profiles 
    SET following_count = GREATEST(0, following_count - 1)
    WHERE id = OLD.follower_id;
    
    -- Decrement followers count for following
    UPDATE profiles 
    SET followers_count = GREATEST(0, followers_count - 1)
    WHERE id = OLD.following_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Recreate follow count triggers
CREATE TRIGGER update_follow_counts_insert
  AFTER INSERT ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

CREATE TRIGGER update_follow_counts_delete
  AFTER DELETE ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

-- ================================================
-- 3. Grant necessary permissions
-- ================================================

-- Grant execute permissions to appropriate roles
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ================================================
-- 4. Add comments for documentation
-- ================================================

COMMENT ON FUNCTION get_most_visited_beach() IS 'Returns the beach with the most session visits - SECURITY DEFINER with secure search_path';
COMMENT ON FUNCTION get_beaches_within_radius(FLOAT, FLOAT, INTEGER) IS 'Returns beaches within specified radius - SECURITY DEFINER with secure search_path';
COMMENT ON FUNCTION cleanup_old_enhanced_forecasts(INTEGER) IS 'Cleans up old forecast data - SECURITY DEFINER with secure search_path';

COMMIT;

-- ================================================
-- 5. Verification queries (run these manually to verify)
-- ================================================

-- Check that functions have proper security settings:
-- SELECT 
--   p.proname as function_name,
--   p.prosecdef as security_definer,
--   p.proconfig as search_path_config
-- FROM pg_proc p
-- WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
--   AND p.proname IN (
--     'get_most_visited_beach',
--     'get_beaches_within_radius', 
--     'cleanup_old_enhanced_forecasts',
--     'increment',
--     'decrement'
--   ); 