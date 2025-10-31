-- Fix all database functions to use correct coordinate column names
-- Migration created: 2025-10-31
-- Issue: Functions reference b.latitude/b.longitude which were renamed to b.lat/b.lon
-- Migration 20251031022000_fix_coordinate_migration.sql changed column names but didn't update functions
--
-- This migration updates 5 functions that reference coordinate columns:
-- 1. get_beaches_by_location_with_scores - Used for location pages
-- 2. get_beaches_by_metro_with_scores - Used for metro area pages
-- 3. get_beaches_near - Used for finding beaches near coordinates
-- 4. get_coach_picks - Used for recommending alternative beaches
-- 5. get_nearby_beaches - Used for proximity searches

BEGIN;

-- =============================================================================
-- Drop existing functions to ensure clean slate
-- =============================================================================

DROP FUNCTION IF EXISTS get_beaches_by_location_with_scores(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_beaches_by_metro_with_scores(TEXT[], TEXT, TEXT);
DROP FUNCTION IF EXISTS get_beaches_near(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS get_coach_picks(UUID, NUMERIC);
DROP FUNCTION IF EXISTS get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);

-- =============================================================================
-- Function 1: get_beaches_by_location_with_scores
-- Purpose: Retrieve beaches for a location with composite ranking scores
-- Fixed: b.latitude → b.lat, b.longitude → b.lon
-- =============================================================================

CREATE OR REPLACE FUNCTION get_beaches_by_location_with_scores(
  p_city TEXT,
  p_state TEXT,
  p_country TEXT DEFAULT 'USA'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  average_rating NUMERIC,
  review_count INTEGER,
  skill_level TEXT,
  break_type TEXT,
  description TEXT,
  crowd_level TEXT,
  best_conditions_prose TEXT,
  composite_score NUMERIC,
  recent_intel_count INTEGER,
  avg_confirmations NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.slug,
    b.city,
    b.state,
    b.country,
    b.lat,  -- FIXED: was b.latitude as lat
    b.lon,  -- FIXED: was b.longitude as lon
    COALESCE(review_stats.average_rating, 0)::NUMERIC as average_rating,
    COALESCE(review_stats.review_count, 0)::INTEGER as review_count,
    b.skill_level,
    b.break_type,
    b.description,
    b.crowd_level,
    b.best_conditions_prose,
    -- Composite score calculation (0-1 scale)
    -- Formula: rating(40%) + reviewVolume(30%) + recentIntel(20%) + intelQuality(10%)
    (
      -- Rating component (0-5 normalized to 0-1) * 40%
      (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +

      -- Review volume component (logarithmic, max at 1000+ reviews) * 30%
      (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3 +

      -- Recent intel count component (0-6+ normalized to 0-1) * 20%
      (LEAST(COALESCE(intel_recent.count, 0)::NUMERIC / 6.0, 1.0)) * 0.2 +

      -- Intel quality component (avg confirmations 0-6+ normalized to 0-1) * 10%
      (LEAST(COALESCE(intel_recent.avg_confirms, 0)::NUMERIC / 6.0, 1.0)) * 0.1
    )::NUMERIC(10, 4) as composite_score,

    COALESCE(intel_recent.count, 0)::INTEGER as recent_intel_count,
    COALESCE(intel_recent.avg_confirms, 0)::NUMERIC(10, 2) as avg_confirmations

  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) as average_rating,
      COUNT(*)::INTEGER as review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER as count,
      AVG(confirmations_count)::NUMERIC as avg_confirms
    FROM intel_posts ip
    WHERE ip.beach_id = b.id
      AND ip.created_at > NOW() - INTERVAL '7 days'
      AND ip.is_active = true
  ) intel_recent ON true
  WHERE b.city = p_city
    AND b.state = p_state
    AND b.country = p_country
    AND b.is_private = false
  ORDER BY composite_score DESC, review_stats.average_rating DESC, review_stats.review_count DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_beaches_by_location_with_scores IS
'Retrieves beaches for a specific location (city, state, country) with computed composite scores.
Composite score combines: rating (40%), review volume (30%), recent intel activity (20%), intel quality (10%).
Results are ordered by composite score descending. Uses lat/lon columns (not latitude/longitude).';

-- =============================================================================
-- Function 2: get_beaches_by_metro_with_scores
-- Purpose: Retrieve beaches for multiple cities in a metro area with composite scores
-- Fixed: b.latitude → b.lat, b.longitude → b.lon
-- =============================================================================

CREATE OR REPLACE FUNCTION get_beaches_by_metro_with_scores(
  p_cities TEXT[],  -- Array of city names in the metro
  p_state TEXT,
  p_country TEXT DEFAULT 'USA'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  average_rating NUMERIC,
  review_count INTEGER,
  skill_level TEXT,
  break_type TEXT,
  description TEXT,
  crowd_level TEXT,
  best_conditions_prose TEXT,
  composite_score NUMERIC,
  recent_intel_count INTEGER,
  avg_confirmations NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.slug,
    b.city,
    b.state,
    b.country,
    b.lat,  -- FIXED: was b.latitude as lat
    b.lon,  -- FIXED: was b.longitude as lon
    COALESCE(review_stats.average_rating, 0)::NUMERIC as average_rating,
    COALESCE(review_stats.review_count, 0)::INTEGER as review_count,
    b.skill_level,
    b.break_type,
    b.description,
    b.crowd_level,
    b.best_conditions_prose,
    -- Composite score calculation (same formula as single-city function)
    (
      (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +
      (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3 +
      (LEAST(COALESCE(intel_recent.count, 0)::NUMERIC / 6.0, 1.0)) * 0.2 +
      (LEAST(COALESCE(intel_recent.avg_confirms, 0)::NUMERIC / 6.0, 1.0)) * 0.1
    )::NUMERIC(10, 4) as composite_score,
    COALESCE(intel_recent.count, 0)::INTEGER as recent_intel_count,
    COALESCE(intel_recent.avg_confirms, 0)::NUMERIC(10, 2) as avg_confirmations

  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) as average_rating,
      COUNT(*)::INTEGER as review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER as count,
      AVG(confirmations_count)::NUMERIC as avg_confirms
    FROM intel_posts ip
    WHERE ip.beach_id = b.id
      AND ip.created_at > NOW() - INTERVAL '7 days'
      AND ip.is_active = true
  ) intel_recent ON true
  WHERE b.city = ANY(p_cities)  -- Match any city in the array
    AND b.state = p_state
    AND b.country = p_country
    AND b.is_private = false
  ORDER BY composite_score DESC, review_stats.average_rating DESC, review_stats.review_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_beaches_by_metro_with_scores IS
'Retrieves beaches across multiple cities in a metro area with composite scores.
Useful for aggregate views like "San Diego Area" which includes La Jolla, Pacific Beach, etc.
Uses lat/lon columns (not latitude/longitude).';

-- =============================================================================
-- Function 3: get_beaches_near
-- Purpose: Find beaches near given coordinates using Haversine formula
-- Fixed: b.latitude → b.lat, b.longitude → b.lon
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_beaches_near(
  _lat double precision,
  _lon double precision,
  _radius_km double precision DEFAULT 25
)
RETURNS TABLE (
  id uuid,
  name text,
  lat double precision,
  lon double precision,
  break_type text,
  aspect_deg int,
  wind_offshore_deg int,
  swell_window_center_deg int,
  swell_window_halfwidth_deg int,
  preferred_tide_ft_min numeric,
  preferred_tide_ft_max numeric,
  wind_cross_shore_ok_kt int,
  wind_onshore_bad_kt int,
  dist_km double precision
)
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT
      b.id,
      b.name,
      b.lat,  -- FIXED: was b.latitude AS lat
      b.lon,  -- FIXED: was b.longitude AS lon
      b.break_type,
      b.aspect_deg,
      b.wind_offshore_deg,  -- FIXED: was offshore_deg
      b.swell_window_center_deg,
      b.swell_window_halfwidth_deg,
      b.preferred_tide_ft_min,  -- FIXED: was tide_min_ft
      b.preferred_tide_ft_max,  -- FIXED: was tide_max_ft
      b.wind_cross_shore_ok_kt,  -- FIXED: was wind_cross_ok_kts
      b.wind_onshore_bad_kt,  -- FIXED: was wind_onshore_bad_kts
      -- Haversine (spherical law of cosines) with clamped argument
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(b.lat)) * cos(radians(b.lon) - radians(_lon))  -- FIXED: was b.latitude and b.longitude
          + sin(radians(_lat)) * sin(radians(b.lat))  -- FIXED: was b.latitude
        ))
      ) AS dist_km
    FROM public.beaches b
    WHERE b.lat IS NOT NULL AND b.lon IS NOT NULL  -- FIXED: was b.latitude and b.longitude
  )
  SELECT *
  FROM base
  WHERE dist_km <= _radius_km
  ORDER BY dist_km
  LIMIT 12;
$$;

GRANT EXECUTE ON FUNCTION public.get_beaches_near(double precision, double precision, double precision)
  TO anon, authenticated, service_role;

-- =============================================================================
-- Function 4: get_coach_picks
-- Purpose: Returns top 3 beach recommendations near a given beach
-- Fixed: b.latitude → b.lat, b.longitude → b.lon
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_coach_picks(
  _beach_id uuid,
  _radius_km numeric default 80
)
RETURNS TABLE (
  pick_rank int,
  beach_id uuid,
  name text,
  distance_km numeric,
  score int
) LANGUAGE sql STABLE AS
$$
WITH origin AS (
  SELECT id, name, lat, lon, region_id  -- FIXED: was latitude as lat, longitude as lon
  FROM beaches WHERE id = _beach_id
),
candidates AS (
  SELECT b.id, b.name, b.lat, b.lon, b.region_id,  -- FIXED: was b.latitude, b.longitude
         -- Haversine distance (km)
         6371 * 2 * asin(sqrt(
           pow(sin(radians(b.lat - o.lat)/2),2) +  -- FIXED: was b.latitude
           cos(radians(o.lat))*cos(radians(b.lat))*  -- FIXED: was b.latitude
           pow(sin(radians(b.lon - o.lon)/2),2)  -- FIXED: was b.longitude
         )) as distance_km,
         coalesce(s.score_0_100, 0) as score
  FROM beaches b
  CROSS JOIN origin o
  LEFT JOIN v_beach_hourly_scores s ON s.beach_id = b.id
  WHERE b.id <> _beach_id
    AND (
      b.region_id = o.region_id
      OR 6371 * 2 * asin(sqrt(
           pow(sin(radians(b.lat - o.lat)/2),2) +  -- FIXED: was b.latitude
           cos(radians(o.lat))*cos(radians(b.lat))*  -- FIXED: was b.latitude
           pow(sin(radians(b.lon - o.lon)/2),2)  -- FIXED: was b.longitude
         )) <= _radius_km
    )
)
SELECT row_number() over(order by score desc nulls last, distance_km asc) as pick_rank,
       id as beach_id, name, distance_km, score
FROM candidates
ORDER BY pick_rank
LIMIT 3;
$$;

GRANT EXECUTE ON FUNCTION public.get_coach_picks(uuid, numeric) TO anon, authenticated;

-- =============================================================================
-- Function 5: get_nearby_beaches
-- Purpose: Returns beaches within specified distance of given coordinates
-- Fixed: b.latitude → b.lat, b.longitude → b.lon
-- =============================================================================

CREATE OR REPLACE FUNCTION get_nearby_beaches(
    input_lat DOUBLE PRECISION,
    input_lng DOUBLE PRECISION,
    max_distance_meters INTEGER DEFAULT 80467, -- 50 miles in meters
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    location TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    is_private BOOLEAN,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    target_lat DOUBLE PRECISION := input_lat;
    target_lng DOUBLE PRECISION := input_lng;
    capped_distance INTEGER := LEAST(GREATEST(max_distance_meters, 0), 160934); -- 0..100 miles
    capped_limit INTEGER := LEAST(GREATEST(limit_count, 1), 200); -- 1..200
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.name,
        b.location,
        b.lat,  -- FIXED: was b.latitude AS lat
        b.lon,  -- FIXED: was b.longitude AS lon
        b.is_private,
        ST_Distance(
            b.geog,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters
    FROM public.beaches b
    WHERE b.lat IS NOT NULL  -- FIXED: was b.latitude
      AND b.lon IS NOT NULL  -- FIXED: was b.longitude
      AND ST_DWithin(
          b.geog,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          capped_distance
      )
    ORDER BY distance_meters ASC
    LIMIT capped_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO anon;

COMMENT ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) IS
'Returns beaches within specified distance (meters) of given coordinates. Uses standardized lat/lon column naming. Utilizes generated geography column with GiST index for performance.';

-- =============================================================================
-- Grant Permissions (location functions)
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_beaches_by_location_with_scores TO authenticated;
GRANT EXECUTE ON FUNCTION get_beaches_by_location_with_scores TO anon;

GRANT EXECUTE ON FUNCTION get_beaches_by_metro_with_scores TO authenticated;
GRANT EXECUTE ON FUNCTION get_beaches_by_metro_with_scores TO anon;

COMMIT;

-- =============================================================================
-- Verification Tests (commented out - uncomment to test locally)
-- =============================================================================

/*
-- Test 1: Verify functions exist and have correct signatures
SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_beaches_by_location_with_scores',
    'get_beaches_by_metro_with_scores',
    'get_beaches_near',
    'get_coach_picks',
    'get_nearby_beaches'
  )
ORDER BY p.proname;

-- Test 2: Verify column names in beaches table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'beaches'
  AND column_name IN ('lat', 'lon', 'latitude', 'longitude')
ORDER BY column_name;

-- Test 3: Try calling a location function (should work without errors)
SELECT name, city, lat, lon
FROM get_beaches_by_location_with_scores('San Diego', 'CA', 'USA')
LIMIT 3;
*/
