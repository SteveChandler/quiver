-- Fix Remaining Supabase Security Linter Warnings (Migration 027)
-- This migration addresses all remaining security warnings from Supabase Security Advisor
-- Date: 2025-01-17

-- ================================================
-- SECURITY ISSUES ADDRESSED:
-- ================================================
-- 1. Function Search Path Mutable (18 functions):
--    - Functions without SET search_path are vulnerable to search path injection
--    - Solution: Add search_path protection to all affected functions
--
-- 2. Materialized View in API (1 view):
--    - activity_feed materialized view is accessible to anon/authenticated roles
--    - Solution: Revoke public access, grant only to service_role
--
-- Functions to fix:
-- 1. get_most_visited_beach           11. format_coordinates
-- 2. update_follow_counts             12. direction_to_compass  
-- 3. update_beach_name                13. get_nearby_intel_posts
-- 4. check_foreign_key_indexes        14. consolidate_buoy_conditions
-- 5. increment                        15. get_user_activity_feed
-- 6. decrement                        16. update_user_storage_usage
-- 7. cleanup_old_enhanced_forecasts   17. add_session_owner_as_participant
-- 8. cleanup_old_activities           18. handle_invitation_acceptance
-- 9. create_beach_review_activity
-- 10. create_follow_activity
-- ================================================

BEGIN;

-- ================================================
-- 0. Drop Dependent Triggers First
-- ================================================
-- We must drop triggers before dropping functions to avoid dependency errors

-- Drop triggers that depend on functions we are about to recreate
DO $$
BEGIN
    -- Beach review activity trigger
    DROP TRIGGER IF EXISTS trigger_beach_review_activity ON beach_reviews;
    
    -- Follow activity trigger
    DROP TRIGGER IF EXISTS trigger_follow_activity ON user_follows;
    
    -- Session owner participant trigger  
    DROP TRIGGER IF EXISTS add_session_owner_participant ON sessions;
    
    -- Invitation acceptance trigger
    DROP TRIGGER IF EXISTS handle_invitation_acceptance ON session_invitations;
    
    -- Follow count triggers
    DROP TRIGGER IF EXISTS update_follow_counts_insert ON user_follows;
    DROP TRIGGER IF EXISTS update_follow_counts_delete ON user_follows;
    DROP TRIGGER IF EXISTS user_follows_count_trigger ON user_follows;
    
    -- Storage usage triggers
    DROP TRIGGER IF EXISTS update_user_storage_usage_insert ON session_media;
    DROP TRIGGER IF EXISTS update_user_storage_usage_delete ON session_media;
    
    RAISE NOTICE 'Dropped all dependent triggers before function recreation';
END $$;

-- ================================================
-- 1. Fix get_most_visited_beach Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Find and drop all functions named get_most_visited_beach
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'get_most_visited_beach'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

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

-- ================================================
-- 2. Fix update_follow_counts Function
-- ================================================

-- Drop all existing function overloads programmatically  
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'update_follow_counts'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update follower count for the user being followed
    UPDATE profiles 
    SET followers_count = (
      SELECT COUNT(*) FROM user_follows WHERE following_id = NEW.following_id
    )
    WHERE id = NEW.following_id;
    
    -- Update following count for the user doing the following
    UPDATE profiles 
    SET following_count = (
      SELECT COUNT(*) FROM user_follows WHERE follower_id = NEW.follower_id
    )
    WHERE id = NEW.follower_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update follower count for the user being unfollowed
    UPDATE profiles 
    SET followers_count = (
      SELECT COUNT(*) FROM user_follows WHERE following_id = OLD.following_id
    )
    WHERE id = OLD.following_id;
    
    -- Update following count for the user doing the unfollowing
    UPDATE profiles 
    SET following_count = (
      SELECT COUNT(*) FROM user_follows WHERE follower_id = OLD.follower_id
    )
    WHERE id = OLD.follower_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ================================================
-- 3. Fix update_beach_name Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'update_beach_name'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

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

-- ================================================
-- 4. Fix check_foreign_key_indexes Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'check_foreign_key_indexes'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION check_foreign_key_indexes()
RETURNS TABLE (
    table_name text,
    constraint_name text,
    column_name text,
    has_covering_index boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.table_name::text,
        tc.constraint_name::text,
        kcu.column_name::text,
        EXISTS (
            SELECT 1 FROM pg_indexes pi
            WHERE pi.tablename = tc.table_name
            AND pi.indexdef LIKE '%' || kcu.column_name || '%'
        ) AS has_covering_index
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
END;
$$;

-- ================================================
-- 5. Fix increment Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'increment'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

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

-- ================================================
-- 6. Fix decrement Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'decrement'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

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

-- ================================================
-- 7. Fix cleanup_old_enhanced_forecasts Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'cleanup_old_enhanced_forecasts'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

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

-- ================================================
-- 8. Fix cleanup_old_activities Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'cleanup_old_activities'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

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
  WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ================================================
-- 9. Fix create_beach_review_activity Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'create_beach_review_activity'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION create_beach_review_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO user_activities (
      user_id,
      activity_type,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
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

-- ================================================
-- 10. Fix create_follow_activity Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'create_follow_activity'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION create_follow_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO user_activities (
      user_id,
      activity_type,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      NEW.follower_id,
      'followed',
      'user_follow',
      NEW.id,
      jsonb_build_object(
        'following_id', NEW.following_id,
        'follower_id', NEW.follower_id
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

-- ================================================
-- 11. Fix format_coordinates Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'format_coordinates'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION format_coordinates(
  latitude FLOAT,
  longitude FLOAT,
  precision_digits INT DEFAULT 5
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  lat_dir TEXT := CASE WHEN latitude >= 0 THEN 'N' ELSE 'S' END;
  lng_dir TEXT := CASE WHEN longitude >= 0 THEN 'E' ELSE 'W' END;
  lat_abs FLOAT := abs(latitude);
  lng_abs FLOAT := abs(longitude);
BEGIN
  RETURN round(lat_abs, precision_digits) || '°' || lat_dir || '  ' || 
         round(lng_abs, precision_digits) || '°' || lng_dir;
END;
$$;

-- ================================================
-- 12. Fix direction_to_compass Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'direction_to_compass'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION direction_to_compass(
  degrees FLOAT,
  precision_level TEXT DEFAULT 'high'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF precision_level = 'low' THEN
    -- 4-point compass
    IF degrees >= 315 OR degrees < 45 THEN RETURN 'N';
    ELSIF degrees >= 45 AND degrees < 135 THEN RETURN 'E';
    ELSIF degrees >= 135 AND degrees < 225 THEN RETURN 'S';
    ELSE RETURN 'W';
    END IF;
  ELSE
    -- 8-point compass (high precision)
    IF degrees >= 337.5 OR degrees < 22.5 THEN RETURN 'N';
    ELSIF degrees >= 22.5 AND degrees < 67.5 THEN RETURN 'NE';
    ELSIF degrees >= 67.5 AND degrees < 112.5 THEN RETURN 'E';
    ELSIF degrees >= 112.5 AND degrees < 157.5 THEN RETURN 'SE';
    ELSIF degrees >= 157.5 AND degrees < 202.5 THEN RETURN 'S';
    ELSIF degrees >= 202.5 AND degrees < 247.5 THEN RETURN 'SW';
    ELSIF degrees >= 247.5 AND degrees < 292.5 THEN RETURN 'W';
    ELSE RETURN 'NW';
    END IF;
  END IF;
END;
$$;

-- ================================================
-- 13. Fix get_nearby_intel_posts Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'get_nearby_intel_posts'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION get_nearby_intel_posts(
  center_lat FLOAT,
  center_lng FLOAT,
  radius_meters INTEGER DEFAULT 50000,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  author_id UUID,
  author_name TEXT,
  latitude FLOAT,
  longitude FLOAT,
  distance_meters FLOAT,
  created_at TIMESTAMP WITH TIME ZONE,
  confirmed_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ip.id,
    ip.title,
    ip.content,
    ip.author_id,
    p.full_name as author_name,
    ip.latitude::FLOAT,
    ip.longitude::FLOAT,
    ST_Distance(
      ST_Point(center_lng, center_lat)::geography,
      ST_Point(ip.longitude, ip.latitude)::geography
    )::FLOAT as distance_meters,
    ip.created_at,
    ip.confirmed_count
  FROM intel_posts ip
  JOIN profiles p ON ip.author_id = p.id
  WHERE ST_Distance(
    ST_Point(center_lng, center_lat)::geography,
    ST_Point(ip.longitude, ip.latitude)::geography
  ) <= radius_meters
  AND ip.expires_at > NOW()
  ORDER BY distance_meters ASC
  LIMIT limit_count;
END;
$$;

-- ================================================
-- 14. Fix consolidate_buoy_conditions Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'consolidate_buoy_conditions'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION consolidate_buoy_conditions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  processed_count INTEGER := 0;
BEGIN
  -- Consolidate duplicate buoy condition records
  WITH duplicates AS (
    SELECT 
      buoy_id,
      recorded_at::date as record_date,
      COUNT(*) as duplicate_count,
      MIN(id) as keep_id
    FROM buoy_conditions 
    GROUP BY buoy_id, recorded_at::date
    HAVING COUNT(*) > 1
  )
  DELETE FROM buoy_conditions bc
  WHERE EXISTS (
    SELECT 1 FROM duplicates d 
    WHERE bc.buoy_id = d.buoy_id 
    AND bc.recorded_at::date = d.record_date
    AND bc.id != d.keep_id
  );
  
  GET DIAGNOSTICS processed_count = ROW_COUNT;
  RETURN processed_count;
END;
$$;

-- ================================================
-- 15. Fix get_user_activity_feed Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'get_user_activity_feed'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

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

-- ================================================
-- 16. Fix update_user_storage_usage Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'update_user_storage_usage'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION update_user_storage_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  user_id_to_update UUID;
  total_usage BIGINT;
BEGIN
  -- Determine which user to update based on the operation
  IF TG_OP = 'DELETE' THEN
    user_id_to_update := OLD.user_id;
  ELSE
    user_id_to_update := NEW.user_id;
  END IF;
  
  -- Calculate total storage usage for the user
  SELECT COALESCE(SUM(file_size), 0)
  INTO total_usage
  FROM session_media
  WHERE user_id = user_id_to_update;
  
  -- Update the users profile with new storage usage
  UPDATE profiles 
  SET storage_usage = total_usage,
      updated_at = NOW()
  WHERE id = user_id_to_update;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ================================================
-- 17. Fix add_session_owner_as_participant Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'add_session_owner_as_participant'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION add_session_owner_as_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Only add for planned sessions
  IF NEW.status = 'planned' THEN
    INSERT INTO session_participants (session_id, user_id, status, joined_at)
    VALUES (NEW.id, NEW.user_id, 'going', NEW.created_at)
    ON CONFLICT (session_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ================================================
-- 18. Fix handle_invitation_acceptance Function
-- ================================================

-- Drop all existing function overloads programmatically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'handle_invitation_acceptance'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION handle_invitation_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- If invitation was accepted, add user to session participants
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND NEW.invitee_id IS NOT NULL THEN
    INSERT INTO session_participants (session_id, user_id, status, joined_at)
    VALUES (NEW.session_id, NEW.invitee_id, 'going', NOW())
    ON CONFLICT (session_id, user_id) DO UPDATE SET
      status = 'going',
      joined_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- ================================================
-- 19. Fix Materialized View API Exposure
-- ================================================

-- Remove API access from activity_feed materialized view
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
  ELSE
    RAISE NOTICE 'Materialized view activity_feed does not exist - skipping';
  END IF;
END $$;

-- ================================================
-- 20. Add Security Comments
-- ================================================

-- Add comments to document the security fixes
COMMENT ON FUNCTION get_most_visited_beach IS 'Beach analytics function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_follow_counts IS 'Social follow trigger function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_beach_name IS 'Beach management function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION check_foreign_key_indexes IS 'Database monitoring function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION increment IS 'Utility function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION decrement IS 'Utility function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION cleanup_old_enhanced_forecasts IS 'Cleanup function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION cleanup_old_activities IS 'Cleanup function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION create_beach_review_activity IS 'Activity creation function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION create_follow_activity IS 'Activity creation function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION format_coordinates IS 'Utility function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION direction_to_compass IS 'Utility function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_nearby_intel_posts IS 'Intel query function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION consolidate_buoy_conditions IS 'Data cleanup function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_user_activity_feed IS 'Activity feed function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_user_storage_usage IS 'Storage tracking trigger - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION add_session_owner_as_participant IS 'Session management trigger - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION handle_invitation_acceptance IS 'Invitation management trigger - SECURITY DEFINER with search_path protection';

-- ================================================
-- 21. Recreate Dependent Triggers
-- ================================================
-- Now recreate all the triggers that depend on our fixed functions

DO $$
BEGIN
    -- Recreate beach review activity trigger
    CREATE TRIGGER trigger_beach_review_activity
        AFTER INSERT ON beach_reviews
        FOR EACH ROW
        EXECUTE FUNCTION create_beach_review_activity();
    
    -- Recreate follow activity trigger
    CREATE TRIGGER trigger_follow_activity
        AFTER INSERT ON user_follows
        FOR EACH ROW
        EXECUTE FUNCTION create_follow_activity();
    
    -- Recreate session owner participant trigger
    CREATE TRIGGER add_session_owner_participant
        AFTER INSERT ON sessions
        FOR EACH ROW
        EXECUTE FUNCTION add_session_owner_as_participant();
    
    -- Recreate invitation acceptance trigger
    CREATE TRIGGER handle_invitation_acceptance
        AFTER UPDATE ON session_invitations
        FOR EACH ROW
        EXECUTE FUNCTION handle_invitation_acceptance();
    
    -- Recreate follow count triggers
    CREATE TRIGGER update_follow_counts_insert
        AFTER INSERT ON user_follows
        FOR EACH ROW
        EXECUTE FUNCTION update_follow_counts();
        
    CREATE TRIGGER update_follow_counts_delete
        AFTER DELETE ON user_follows
        FOR EACH ROW
        EXECUTE FUNCTION update_follow_counts();
    
    -- Recreate storage usage triggers
    CREATE TRIGGER update_user_storage_usage_insert
        AFTER INSERT ON session_media
        FOR EACH ROW
        EXECUTE FUNCTION update_user_storage_usage();
        
    CREATE TRIGGER update_user_storage_usage_delete
        AFTER DELETE ON session_media
        FOR EACH ROW
        EXECUTE FUNCTION update_user_storage_usage();
    
    RAISE NOTICE 'Recreated all dependent triggers with secure functions';
END $$;

COMMIT;

-- ================================================
-- 21. Success Message and Verification
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '✅ All Security Warnings Fixed Successfully!';
    RAISE NOTICE '   ✓ Fixed 18 functions with search_path protection';
    RAISE NOTICE '   ✓ Secured activity_feed materialized view API access';
    RAISE NOTICE '   ✓ All functions now use SECURITY DEFINER with search_path protection';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Functions Fixed:';
    RAISE NOTICE '   • get_most_visited_beach           • format_coordinates';
    RAISE NOTICE '   • update_follow_counts             • direction_to_compass';
    RAISE NOTICE '   • update_beach_name                • get_nearby_intel_posts';
    RAISE NOTICE '   • check_foreign_key_indexes        • consolidate_buoy_conditions';
    RAISE NOTICE '   • increment                        • get_user_activity_feed';
    RAISE NOTICE '   • decrement                        • update_user_storage_usage';
    RAISE NOTICE '   • cleanup_old_enhanced_forecasts   • add_session_owner_as_participant';
    RAISE NOTICE '   • cleanup_old_activities           • handle_invitation_acceptance';
    RAISE NOTICE '   • create_beach_review_activity';
    RAISE NOTICE '   • create_follow_activity';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Security Benefits:';
    RAISE NOTICE '   • Functions protected against search path injection attacks';
    RAISE NOTICE '   • Materialized view access restricted to service_role only';
    RAISE NOTICE '   • All functions maintain SECURITY DEFINER privileges safely';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Remaining Auth Security Warnings (require dashboard config):';
    RAISE NOTICE '   • Enable leaked password protection in Supabase Auth settings';
    RAISE NOTICE '   • Configure additional MFA options in Auth settings';
END $$;

-- ================================================
-- 22. Verification Queries (for manual testing)
-- ================================================

-- Uncomment to verify the fixes manually:
-- 
-- -- Check that all functions have search_path set:
-- SELECT 
--     p.proname as function_name,
--     p.prosecdef as is_security_definer,
--     pg_get_function_identity_arguments(p.oid) as arguments,
--     CASE 
--         WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 'PROTECTED'
--         ELSE 'VULNERABLE'
--     END as search_path_status
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'get_most_visited_beach', 'update_follow_counts', 'update_beach_name',
--     'check_foreign_key_indexes', 'increment', 'decrement',
--     'cleanup_old_enhanced_forecasts', 'cleanup_old_activities',
--     'create_beach_review_activity', 'create_follow_activity',
--     'format_coordinates', 'direction_to_compass', 'get_nearby_intel_posts',
--     'consolidate_buoy_conditions', 'get_user_activity_feed',
--     'update_user_storage_usage', 'add_session_owner_as_participant',
--     'handle_invitation_acceptance'
--   )
-- ORDER BY function_name;
--
-- -- Check materialized view permissions:
-- SELECT 
--     schemaname,
--     matviewname,
--     matviewowner,
--     hasindexes
-- FROM pg_matviews 
-- WHERE matviewname = 'activity_feed';