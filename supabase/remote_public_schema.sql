

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'Last performance optimization: 2025-01-27 - Fixed Supabase Performance Advisor warnings';



CREATE TYPE "public"."intel_post_tag" AS ENUM (
    'parking',
    'hazard',
    'crowd',
    'conditions',
    'access',
    'other'
);


ALTER TYPE "public"."intel_post_tag" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_database_health"() RETURNS TABLE("table_name" "text", "row_count" bigint, "table_size" "text", "last_analyzed" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::TEXT,
        COALESCE(t.n_live_tup, 0) AS row_count,
        pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.relname)) AS table_size,
        t.last_analyze
    FROM pg_stat_user_tables t
    WHERE t.schemaname = 'public' 
      AND t.relname IN ('enhanced_forecasts', 'buoys', 'beaches', 'spot_feedback')
    ORDER BY pg_total_relation_size(t.schemaname||'.'||t.relname) DESC;
END;
$$;


ALTER FUNCTION "public"."check_database_health"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_inactive_buoys"("inactive_days" integer DEFAULT 7) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Mark buoys as inactive if no recent updates
    UPDATE public.buoys 
    SET active = false, 
        updated_at = NOW()
    WHERE active = true 
      AND updated_at < NOW() - (inactive_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Log the cleanup
    RAISE NOTICE 'Marked % buoys as inactive after % days without updates', updated_count, inactive_days;
    
    RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_inactive_buoys"("inactive_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_forecasts"("retention_days" integer DEFAULT 30) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old enhanced forecasts beyond retention period
    DELETE FROM public.enhanced_forecasts 
    WHERE forecast_date < CURRENT_DATE - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    RAISE NOTICE 'Cleaned up % old forecast records older than % days', deleted_count, retention_days;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_forecasts"("retention_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_stale_enhanced_forecasts"("retention_days" integer DEFAULT 14) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete enhanced forecasts older than retention period
    DELETE FROM public.enhanced_forecasts 
    WHERE forecast_date < CURRENT_DATE - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % stale enhanced forecasts older than % days', 
        deleted_count, retention_days;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_stale_enhanced_forecasts"("retention_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_activity"("p_user_id" "uuid", "p_activity_type" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  activity_id uuid;
begin
  insert into public.user_activities (user_id, activity_type, entity_type, entity_id, metadata)
  values (p_user_id, p_activity_type, p_entity_type, p_entity_id, p_metadata)
  returning id into activity_id;
  
  return activity_id;
end;
$$;


ALTER FUNCTION "public"."create_activity"("p_user_id" "uuid", "p_activity_type" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_session_forecast_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  forecast_data JSONB;
  conditions_data JSONB;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    SELECT to_jsonb(ef.*) INTO forecast_data
    FROM enhanced_forecasts ef
    WHERE ef.beach_id::uuid = NEW.beach_id::uuid
      AND ef.forecast_date = NEW.arrival_time::date
    ORDER BY ABS(EXTRACT(EPOCH FROM (ef.forecast_time::time - NEW.arrival_time::time))) ASC
    LIMIT 1;

    conditions_data := jsonb_build_object(
      'wave_quality', NEW.wave_quality,
      'water_temp', NEW.water_temp,
      'crowd_level', NEW.crowd_level,
      'parking_ease', NEW.parking_ease,
      'rating', NEW.rating,
      'notes', NEW.notes,
      'duration_minutes', NEW.duration_minutes,
      'arrival_time', NEW.arrival_time
    );

    IF forecast_data IS NOT NULL THEN
      INSERT INTO session_forecast_snapshots (
        session_id, user_id, beach_id, forecast_snapshot, actual_conditions,
        forecast_confidence_score, data_source, session_date
      ) VALUES (
        NEW.id, NEW.user_id, NEW.beach_id::uuid, forecast_data, conditions_data,
        (forecast_data->>'confidence_score')::integer,
        forecast_data->>'data_source', NEW.arrival_time::date
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_session_forecast_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") RETURNS TABLE("beach_id" "uuid", "total_reviews" integer, "average_overall_rating" numeric, "average_wave_quality" numeric, "average_crowd_density" numeric, "average_parking" numeric, "average_accessibility" numeric, "rating_distribution" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        target_beach_id,
        COUNT(*)::INTEGER AS total_reviews,
        ROUND(AVG(br.overall_rating)::DECIMAL, 2) AS average_overall_rating,
        ROUND(AVG(br.wave_quality_rating)::DECIMAL, 2) AS average_wave_quality,
        ROUND(AVG(br.crowd_density_rating)::DECIMAL, 2) AS average_crowd_density,
        ROUND(AVG(br.parking_rating)::DECIMAL, 2) AS average_parking,
        ROUND(AVG(br.accessibility_rating)::DECIMAL, 2) AS average_accessibility,
        jsonb_build_object(
            '5_star', COUNT(*) FILTER (WHERE br.overall_rating = 5),
            '4_star', COUNT(*) FILTER (WHERE br.overall_rating = 4),
            '3_star', COUNT(*) FILTER (WHERE br.overall_rating = 3),
            '2_star', COUNT(*) FILTER (WHERE br.overall_rating = 2),
            '1_star', COUNT(*) FILTER (WHERE br.overall_rating = 1)
        ) AS rating_distribution
    FROM public.beach_reviews br
    WHERE br.beach_id = target_beach_id;
END;
$$;


ALTER FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer DEFAULT 0, "limit_count" integer DEFAULT 10, "min_rating" integer DEFAULT 1) RETURNS TABLE("id" "uuid", "beach_id" "uuid", "user_id" "uuid", "overall_rating" integer, "wave_quality_rating" integer, "crowd_density_rating" integer, "parking_rating" integer, "accessibility_rating" integer, "title" character varying, "content" "text", "visit_date" "date", "helpful_count" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "user_name" "text", "beach_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        br.id,
        br.beach_id,
        br.user_id,
        br.overall_rating,
        br.wave_quality_rating,
        br.crowd_density_rating,
        br.parking_rating,
        br.accessibility_rating,
        br.title,
        br.content,
        br.visit_date,
        br.helpful_count,
        br.created_at,
        br.updated_at,
        p.full_name AS user_name,
        b.name AS beach_name
    FROM public.beach_reviews br
    LEFT JOIN public.profiles p ON p.id = br.user_id
    LEFT JOIN public.beaches b ON b.id = br.beach_id
    WHERE (target_beach_id IS NULL OR br.beach_id = target_beach_id)
      AND br.overall_rating >= min_rating
    ORDER BY 
        br.helpful_count DESC,
        br.created_at DESC
    OFFSET offset_count
    LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer, "limit_count" integer, "min_rating" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_beaches_near"("_lat" double precision, "_lon" double precision, "_radius_km" double precision DEFAULT 25) RETURNS TABLE("id" "uuid", "name" "text", "lat" double precision, "lon" double precision, "break_type" "text", "aspect_deg" integer, "offshore_deg" integer, "swell_window_center_deg" integer, "swell_window_halfwidth_deg" integer, "tide_min_ft" numeric, "tide_max_ft" numeric, "wind_cross_ok_kts" integer, "wind_onshore_bad_kts" integer, "dist_km" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  WITH base AS (
    SELECT
      b.id,
      b.name,
      b.latitude AS lat,
      b.longitude AS lon,
      b.break_type,
      b.aspect_deg,
      b.offshore_deg,
      b.swell_window_center_deg,
      b.swell_window_halfwidth_deg,
      b.tide_min_ft,
      b.tide_max_ft,
      b.wind_cross_ok_kts,
      b.wind_onshore_bad_kts,
      -- Haversine (spherical law of cosines) with clamped argument
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(_lon))
          + sin(radians(_lat)) * sin(radians(b.latitude))
        ))
      ) AS dist_km
    FROM public.beaches b
    WHERE b.latitude IS NOT NULL AND b.longitude IS NOT NULL
  )
  SELECT *
  FROM base
  WHERE dist_km <= _radius_km
  ORDER BY dist_km
  LIMIT 12;
$$;


ALTER FUNCTION "public"."get_beaches_near"("_lat" double precision, "_lon" double precision, "_radius_km" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_best_times"("p_beach" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_limit" integer DEFAULT 6) RETURNS TABLE("start_ts" timestamp with time zone, "end_ts" timestamp with time zone, "label" "text", "score" integer)
    LANGUAGE "sql" STABLE
    AS $$
WITH params AS (
  SELECT 
    b.id AS beach_id,
    b.wind_offshore_deg,
    b.wind_cross_shore_ok_kt,
    b.preferred_tide_ft_min,
    b.preferred_tide_ft_max,
    ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) AS swell_span,
    b.swell_window_min_deg AS swell_min
  FROM public.beaches b
  WHERE b.id = p_beach
),
hrs AS (
  SELECT generate_series(
           date_trunc('hour', p_start),
           date_trunc('hour', p_end),
           interval '1 hour'
         ) AS ts_utc
),
nearest AS (
  SELECT
    h.ts_utc,
    -- nearest marine within ±6 hours
    (
      SELECT m.ts FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS m_ts,
    (
      SELECT m.wave_height_m FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wave_height_m,
    (
      SELECT m.wave_period_s FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wave_period_s,
    (
      SELECT m.wave_direction_deg FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wave_direction_deg,
    (
      SELECT m.wind_speed_ms FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wind_speed_ms,
    (
      SELECT m.wind_direction_deg FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wind_direction_deg,
    -- nearest tide within ±90 minutes
    (
      SELECT t.tide_height_m FROM public.tide_forecasts t
      WHERE t.beach_id = p_beach
        AND t.ts BETWEEN h.ts_utc - interval '90 minutes' AND h.ts_utc + interval '90 minutes'
      ORDER BY ABS(EXTRACT(EPOCH FROM (t.ts - h.ts_utc)))
      LIMIT 1
    ) AS tide_height_m
  FROM hrs h
),
scored AS (
  SELECT
    n.ts_utc,
    -- Wind score
    GREATEST(
      0,
      (1 + COS(RADIANS(ABS(MOD(((n.wind_direction_deg)::int - p.wind_offshore_deg + 540),360) - 180))))/2
      * (1 - GREATEST(0, ((COALESCE(n.wind_speed_ms,0) * 1.94384449) - p.wind_cross_shore_ok_kt)::float / 10.0))
    ) AS wind_score,
    -- Tide score (ft band triangle)
    COALESCE(
      GREATEST(
        0,
        1 - ABS(((n.tide_height_m * 3.28084)) - ((p.preferred_tide_ft_min + p.preferred_tide_ft_max)/2.0))
              / NULLIF((p.preferred_tide_ft_max - p.preferred_tide_ft_min)/2.0,0)
      ), 0
    )::numeric AS tide_score,
    -- Swell direction score
    GREATEST(
      0,
      1 - GREATEST(
            0,
            ABS(MOD(((n.wave_direction_deg)::int - ((p.swell_min + p.swell_span/2.0)) + 540)::int, 360) - 180) - (p.swell_span/2.0)
          )::float / 30.0
    ) AS swell_dir_score,
    0.0 AS period_score,
    0.0 AS height_score,
    -- Total score
    ROUND(
      100 * GREATEST(
        0,
        (0.4 * GREATEST(0,
          (1 + COS(RADIANS(ABS(MOD(((n.wind_direction_deg)::int - p.wind_offshore_deg + 540),360) - 180))))/2
          * (1 - GREATEST(0, ((COALESCE(n.wind_speed_ms,0) * 1.94384449) - p.wind_cross_shore_ok_kt)::float / 10.0))
        ))
        + (0.2 * COALESCE(
          GREATEST(
            0,
            1 - ABS(((n.tide_height_m * 3.28084)) - ((p.preferred_tide_ft_min + p.preferred_tide_ft_max)/2.0))
                  / NULLIF((p.preferred_tide_ft_max - p.preferred_tide_ft_min)/2.0,0)
          ), 0
        ))
        + (0.4 * GREATEST(
          0,
          1 - GREATEST(0, ABS(MOD(((n.wave_direction_deg)::int - ((p.swell_min + p.swell_span/2.0)) + 540)::int, 360) - 180) - (p.swell_span/2.0))::float / 30.0
        ))
      )
    )::int AS score_0_100
  FROM nearest n
  JOIN params p ON TRUE
  WHERE n.m_ts IS NOT NULL -- require a marine reference within window
),
win AS (
  SELECT
    h1.ts_utc                       AS start_ts,
    h1.ts_utc + interval '2 hour'   AS end_ts,
    round(avg(h2.score_0_100))::int AS score
  FROM scored h1
  JOIN scored h2
    ON h2.ts_utc BETWEEN h1.ts_utc AND h1.ts_utc + interval '1 hour'
  GROUP BY h1.ts_utc
),
ranked AS (
  SELECT
    w.*,
    CASE
      WHEN w.score >= 85 THEN 'epic'
      WHEN w.score >= 70 THEN 'good'
      WHEN w.score >= 55 THEN 'fair'
      ELSE 'poor'
    END AS grade
  FROM win w
  WHERE w.score >= 55
)
SELECT
  r.start_ts,
  r.end_ts,
  (r.grade || ' (' || r.score || ')')::text AS label,
  r.score
FROM ranked r
ORDER BY r.score DESC, r.start_ts
LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_best_times"("p_beach" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric DEFAULT 80) RETURNS TABLE("pick_rank" integer, "beach_id" "uuid", "name" "text", "distance_km" numeric, "score" integer)
    LANGUAGE "sql" STABLE
    AS $$
with origin as (
  select id, name, latitude as lat, longitude as lon
  from beaches where id = _beach_id
),
candidates as (
  select b.id, b.name, b.latitude, b.longitude,
         -- Haversine distance (km)
         6371 * 2 * asin(sqrt(
           pow(sin(radians(b.latitude - o.lat)/2),2) +
           cos(radians(o.lat))*cos(radians(b.latitude))*
           pow(sin(radians(b.longitude - o.lon)/2),2)
         )) as distance_km,
         coalesce(s.score_0_100, 0) as score
  from beaches b
  cross join origin o
  left join v_beach_hourly_scores s on s.beach_id = b.id
  where b.id <> _beach_id
)
select row_number() over(order by score desc nulls last, distance_km asc) as pick_rank,
       id as beach_id, name, distance_km, score
from candidates
where distance_km <= _radius_km
order by pick_rank
limit 3;
$$;


ALTER FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") RETURNS TABLE("id" "uuid", "intel_post_id" "uuid", "user_id" "uuid", "user_name" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ipc.id,
        ipc.intel_post_id,
        ipc.user_id,
        p.full_name AS user_name,
        ipc.created_at
    FROM public.intel_post_confirmations ipc
    LEFT JOIN public.profiles p ON p.id = ipc.user_id
    WHERE ipc.intel_post_id = target_post_id
    ORDER BY ipc.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer DEFAULT 80467, "limit_count" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "name" "text", "location" "text", "latitude" double precision, "longitude" double precision, "is_private" boolean, "distance_meters" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.location,
        b.latitude,
        b.longitude,
        b.is_private,
        ST_Distance(
            ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(input_lng, input_lat), 4326)::geography
        ) AS distance_meters
    FROM public.beaches b
    WHERE b.latitude IS NOT NULL 
      AND b.longitude IS NOT NULL
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(input_lng, input_lat), 4326)::geography,
          max_distance_meters
      )
    ORDER BY distance_meters ASC
    LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) IS 'Returns beaches within specified distance (meters) of given coordinates. Uses PostGIS for accurate earth-surface distance calculations. Optimized with spatial indexes for performance.';



CREATE OR REPLACE FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer DEFAULT 100000, "result_limit" integer DEFAULT 4) RETURNS TABLE("buoy_uuid" "text", "buoy_name" "text", "active" boolean, "coordinates" "public"."geometry", "water_temperature" numeric, "air_temperature" numeric, "wave_height" numeric, "wave_period" numeric, "wind_speed" numeric, "wind_gust" numeric, "wind_direction" numeric, "tides" "jsonb", "updated_at" timestamp with time zone, "distance_meters" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.buoy_uuid,
        b.buoy_name,
        b.active,
        b.coordinates,
        b.water_temperature,
        b.air_temperature,
        b.wave_height,
        b.wave_period,
        b.wind_speed,
        b.wind_gust,
        b.wind_direction,
        b.tides,
        b.updated_at,
        ST_Distance(
            b.coordinates,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters
    FROM public.buoys b
    WHERE b.active = true
      AND b.coordinates IS NOT NULL
      AND ST_DWithin(
          b.coordinates,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          max_distance_m
      )
    ORDER BY distance_meters ASC
    LIMIT result_limit;
END;
$$;


ALTER FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer, "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer DEFAULT 20, "radius_miles" double precision DEFAULT 25.0, "tag_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "beach_id" "uuid", "latitude" numeric, "longitude" numeric, "tag" "public"."intel_post_tag", "title" "text", "description" "text", "photo_url" "text", "confirmations_count" integer, "is_active" boolean, "surf_conditions" "jsonb", "expires_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "distance_miles" double precision, "user_name" "text", "beach_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ip.id,
        ip.user_id,
        ip.beach_id,
        ip.latitude,
        ip.longitude,
        ip.tag,
        ip.title,
        ip.description,
        ip.photo_url,
        ip.confirmations_count,
        ip.is_active,
        ip.surf_conditions,
        ip.expires_at,
        ip.created_at,
        ip.updated_at,
        (ST_Distance(
            ST_SetSRID(ST_MakePoint(ip.longitude, ip.latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
        ) / 1609.34) AS distance_miles, -- Convert meters to miles
        p.full_name AS user_name,
        COALESCE(b.name, 'Unknown Beach') AS beach_name
    FROM public.intel_posts ip
    LEFT JOIN public.profiles p ON p.id = ip.user_id
    LEFT JOIN public.beaches b ON b.id = ip.beach_id
    WHERE ip.is_active = true
      AND (ip.expires_at IS NULL OR ip.expires_at > NOW())
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(ip.longitude, ip.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
          radius_miles * 1609.34 -- Convert miles to meters
      )
      AND (tag_filter IS NULL OR ip.tag::TEXT = tag_filter)
    ORDER BY 
        ip.confirmations_count DESC,
        ip.created_at DESC
    LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer, "radius_miles" double precision, "tag_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer DEFAULT 100000) RETURNS TABLE("buoy_uuid" "text", "buoy_name" "text", "active" boolean, "coordinates" "public"."geometry", "water_temperature" numeric, "air_temperature" numeric, "wave_height" numeric, "wave_period" numeric, "wind_speed" numeric, "wind_gust" numeric, "wind_direction" numeric, "tides" "jsonb", "updated_at" timestamp with time zone, "distance_meters" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.buoy_uuid,
        b.buoy_name,
        b.active,
        b.coordinates,
        b.water_temperature,
        b.air_temperature,
        b.wave_height,
        b.wave_period,
        b.wind_speed,
        b.wind_gust,
        b.wind_direction,
        b.tides,
        b.updated_at,
        ST_Distance(
            b.coordinates,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters
    FROM public.buoys b
    WHERE b.active = true
      AND b.coordinates IS NOT NULL
      AND (b.water_temperature IS NOT NULL 
           OR b.air_temperature IS NOT NULL 
           OR b.wave_height IS NOT NULL)
      AND ST_DWithin(
          b.coordinates,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          max_distance_m
      )
    ORDER BY 
        b.updated_at DESC,
        distance_meters ASC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nightly_forecast_maintenance"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    refresh_result JSON;
    cleanup_count INTEGER;
    final_result JSON;
    start_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Refresh enhanced forecasts
    refresh_result := refresh_enhanced_forecasts_for_active_beaches();
    
    -- Cleanup stale forecasts
    cleanup_count := cleanup_stale_enhanced_forecasts(14);
    
    -- Update table statistics
    ANALYZE public.enhanced_forecasts;
    ANALYZE public.beaches;
    
    -- Build final result
    final_result := jsonb_build_object(
        'operation', 'nightly_forecast_maintenance',
        'started_at', start_time,
        'completed_at', NOW(),
        'duration_seconds', EXTRACT(EPOCH FROM (NOW() - start_time)),
        'refresh_summary', refresh_result,
        'stale_forecasts_cleaned', cleanup_count,
        'statistics_updated', true
    );
    
    RETURN final_result;
END;
$$;


ALTER FUNCTION "public"."nightly_forecast_maintenance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_delete_on_protected"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- DBA escape hatch: allow deletes only if this flag is set inside a transaction
  IF current_setting('app.allow_destructive', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DELETE blocked on % (user=%). Set app.allow_destructive=on inside a transaction if you truly need to proceed.',
      TG_TABLE_NAME, current_user;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."prevent_delete_on_protected"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_enhanced_forecasts_for_active_beaches"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    beaches_count INTEGER := 0;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
    start_time TIMESTAMP WITH TIME ZONE := NOW();
    beach_rec RECORD;
BEGIN
    -- Initialize result
    result := jsonb_build_object(
        'operation', 'enhanced_forecasts_refresh',
        'started_at', start_time,
        'beaches_processed', 0,
        'successful_updates', 0,
        'failed_updates', 0,
        'errors', '[]'::jsonb
    );
    
    -- Get active beaches that need forecast updates
    -- Focus on beaches with recent activity or explicit priority
    FOR beach_rec IN
        SELECT DISTINCT b.id, b.name, b.latitude, b.longitude
        FROM public.beaches b
        WHERE b.latitude IS NOT NULL 
          AND b.longitude IS NOT NULL
          AND (
            -- Beaches with recent sessions (within 30 days)
            EXISTS (
                SELECT 1 FROM public.sessions s 
                WHERE s.beach_id = b.id 
                  AND s.created_at > NOW() - INTERVAL '30 days'
            )
            -- OR beaches with recent check-ins
            OR EXISTS (
                SELECT 1 FROM public.beach_checkins bc
                WHERE bc.beach_id = b.id
                  AND bc.created_at > NOW() - INTERVAL '7 days'
            )
            -- OR beaches explicitly marked as priority (if such a column exists)
            OR b.is_private = false -- Include all public beaches for now
          )
        ORDER BY b.name
        LIMIT 50 -- Limit to prevent overwhelming the API services
    LOOP
        beaches_count := beaches_count + 1;
        
        BEGIN
            -- Note: The actual forecast generation should be called via the enhanced forecast service
            -- This is a placeholder that logs the attempt - the actual implementation
            -- would call the NextJS API endpoint or service function
            
            RAISE NOTICE 'Processing forecast refresh for beach: % (%, %)', 
                beach_rec.name, beach_rec.latitude, beach_rec.longitude;
            
            -- TODO: Call enhanced forecast service API endpoint
            -- For now, just log success
            success_count := success_count + 1;
            
        EXCEPTION 
            WHEN OTHERS THEN
                error_count := error_count + 1;
                
                -- Add error to result
                result := jsonb_set(
                    result,
                    '{errors}',
                    (result->'errors')::jsonb || jsonb_build_object(
                        'beach_id', beach_rec.id,
                        'beach_name', beach_rec.name,
                        'error', SQLERRM,
                        'timestamp', NOW()
                    )
                );
                
                RAISE NOTICE 'Error processing beach %: %', beach_rec.name, SQLERRM;
        END;
    END LOOP;
    
    -- Update result with final counts
    result := jsonb_set(result, '{beaches_processed}', to_jsonb(beaches_count));
    result := jsonb_set(result, '{successful_updates}', to_jsonb(success_count));
    result := jsonb_set(result, '{failed_updates}', to_jsonb(error_count));
    result := jsonb_set(result, '{completed_at}', to_jsonb(NOW()));
    result := jsonb_set(result, '{duration_seconds}', 
        to_jsonb(EXTRACT(EPOCH FROM (NOW() - start_time))));
    
    -- Log summary
    RAISE NOTICE 'Enhanced forecasts refresh completed: % beaches processed, % successful, % failed',
        beaches_count, success_count, error_count;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."refresh_enhanced_forecasts_for_active_beaches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_beach_hourly_scores"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_beach_hourly_scores;

  UPDATE public.mv_beach_hourly_scores mv
  SET score_0_100 = GREATEST(
    0,
    (
      ROUND((100 * (
        -- wind
        (COALESCE(b.w_wind, 0.30) * GREATEST(
          0,
          (1 + COS(RADIANS(ABS(MOD(((mv.wind_dir_deg)::int - b.wind_offshore_deg + 540)::int, 360) - 180))))/2
          * (1 - GREATEST(0, (mv.wind_spd_kts) - COALESCE(b.wind_cross_shore_ok_kt, 8))::float / 10.0)
        )))
        +
        -- tide
        (COALESCE(b.w_tide, 0.20) * COALESCE(
          GREATEST(
            0,
            1 - ABS((mv.tide_ft) - ((COALESCE(b.preferred_tide_ft_min, 1) + COALESCE(b.preferred_tide_ft_max, 3))/2.0))
                  / NULLIF((COALESCE(b.preferred_tide_ft_max, 3) - COALESCE(b.preferred_tide_ft_min, 1))/2.0, 0)
          ),
          0
        )))
        +
        -- swell dir
        (COALESCE(b.w_swell, 0.25) * (
          WITH params AS (
            SELECT ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) AS span,
                   b.swell_window_min_deg AS min_deg
          )
          SELECT GREATEST(
            0,
            1 - GREATEST(
                  0,
                  ABS(MOD(((mv.swell_dir_deg)::int - ((min_deg + span/2.0)) + 540)::int, 360) - 180) - (span/2.0)
                )::float / 30.0
          )
          FROM params
        ))
        + (COALESCE(b.w_period, 0.15) * 0)
        + (COALESCE(b.w_height, 0.10) * 0)
      ))::int
    )
  FROM public.beaches b
  WHERE b.id = mv.beach_id;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_beach_hourly_scores"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_mv_beach_hourly_scores"() IS 'Refresh + compute scores for mv_beach_hourly_scores (fixed rounding/casting)';



CREATE OR REPLACE FUNCTION "public"."refresh_mv_beach_hourly_scores_and_analyze"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM public.refresh_mv_beach_hourly_scores();
  -- Update planner stats to keep queries fast
  PERFORM 1;
  BEGIN
    EXECUTE 'ANALYZE public.mv_beach_hourly_scores';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_beach_hourly_scores_and_analyze"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_mv_beach_hourly_scores_and_analyze"() IS 'Wrapper: refresh MV + compute scores + analyze; scheduled via pg_cron when available.';



CREATE OR REPLACE FUNCTION "public"."refresh_mv_best_times"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_best_times;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_best_times"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_database_maintenance"("cleanup_forecasts" boolean DEFAULT true, "cleanup_buoys" boolean DEFAULT true, "update_stats" boolean DEFAULT true, "forecast_retention_days" integer DEFAULT 30, "buoy_inactive_days" integer DEFAULT 7) RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    forecasts_cleaned INTEGER := 0;
    buoys_cleaned INTEGER := 0;
    start_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Initialize result object
    result := '{"maintenance_started": "' || start_time || '", "operations": []}'::JSON;
    
    -- Clean up old forecasts
    IF cleanup_forecasts THEN
        forecasts_cleaned := cleanup_old_forecasts(forecast_retention_days);
        result := jsonb_set(
            result::JSONB, 
            '{operations}', 
            (result->'operations')::JSONB || jsonb_build_object(
                'operation', 'forecast_cleanup',
                'records_affected', forecasts_cleaned,
                'retention_days', forecast_retention_days
            )
        )::JSON;
    END IF;
    
    -- Clean up inactive buoys
    IF cleanup_buoys THEN
        buoys_cleaned := cleanup_inactive_buoys(buoy_inactive_days);
        result := jsonb_set(
            result::JSONB, 
            '{operations}', 
            (result->'operations')::JSONB || jsonb_build_object(
                'operation', 'buoy_cleanup',
                'records_affected', buoys_cleaned,
                'inactive_days', buoy_inactive_days
            )
        )::JSON;
    END IF;
    
    -- Update statistics
    IF update_stats THEN
        PERFORM update_forecast_table_stats();
        result := jsonb_set(
            result::JSONB, 
            '{operations}', 
            (result->'operations')::JSONB || jsonb_build_object(
                'operation', 'statistics_update',
                'completed', true
            )
        )::JSON;
    END IF;
    
    -- Add completion info
    result := jsonb_set(
        result::JSONB, 
        '{maintenance_completed}', 
        to_jsonb(NOW())
    )::JSON;
    
    result := jsonb_set(
        result::JSONB, 
        '{duration_seconds}', 
        to_jsonb(EXTRACT(EPOCH FROM (NOW() - start_time)))
    )::JSON;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."run_database_maintenance"("cleanup_forecasts" boolean, "cleanup_buoys" boolean, "update_stats" boolean, "forecast_retention_days" integer, "buoy_inactive_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_manual_maintenance"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    -- Run standard maintenance
    result := run_database_maintenance(true, true, true, 30, 7);
    
    -- Add manual trigger timestamp
    result := jsonb_set(
        result::JSONB,
        '{trigger_type}',
        '"manual"'::JSONB
    )::JSON;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."trigger_manual_maintenance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_follow_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment follower count for the user being followed
        UPDATE public.profiles 
        SET followers_count = followers_count + 1 
        WHERE id = NEW.following_id;
        
        -- Increment following count for the user doing the following
        UPDATE public.profiles 
        SET following_count = following_count + 1 
        WHERE id = NEW.follower_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement follower count for the user being unfollowed
        UPDATE public.profiles 
        SET followers_count = GREATEST(0, followers_count - 1) 
        WHERE id = OLD.following_id;
        
        -- Decrement following count for the user doing the unfollowing
        UPDATE public.profiles 
        SET following_count = GREATEST(0, following_count - 1) 
        WHERE id = OLD.follower_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_follow_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_forecast_table_stats"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Update table statistics for better query planning
    ANALYZE public.enhanced_forecasts;
    ANALYZE public.buoys;
    ANALYZE public.beaches;
    ANALYZE public.spot_feedback;
    
    -- Log the update
    RAISE NOTICE 'Database statistics updated for forecast tables at %', NOW();
END;
$$;


ALTER FUNCTION "public"."update_forecast_table_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_intel_confirmations_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.intel_posts 
        SET confirmations_count = confirmations_count + 1 
        WHERE id = NEW.intel_post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts 
        SET confirmations_count = GREATEST(confirmations_count - 1, 0) 
        WHERE id = OLD.intel_post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_intel_confirmations_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_review_helpful_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.beach_reviews 
        SET helpful_count = helpful_count + 1 
        WHERE id = NEW.review_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.beach_reviews 
        SET helpful_count = GREATEST(helpful_count - 1, 0) 
        WHERE id = OLD.review_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_review_helpful_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_comments_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.sessions 
    set comments_count = comments_count + 1 
    where id = new.session_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.sessions 
    set comments_count = greatest(comments_count - 1, 0)
    where id = old.session_id;
    return old;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."update_session_comments_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.sessions 
    set likes_count = likes_count + 1 
    where id = new.session_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.sessions 
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.session_id;
    return old;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."update_session_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."badge_definitions" (
    "badge_slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "category" "text" NOT NULL,
    "xp_reward" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "badge_definitions_badge_slug_check" CHECK (("badge_slug" ~ '^[a-z][a-z0-9_]*[a-z0-9]$'::"text")),
    CONSTRAINT "badge_definitions_category_check" CHECK (("category" = ANY (ARRAY['global'::"text", 'journal'::"text", 'quiver'::"text"]))),
    CONSTRAINT "badge_definitions_description_check" CHECK (("length"("description") <= 500)),
    CONSTRAINT "badge_definitions_icon_check" CHECK (("length"("icon") <= 50)),
    CONSTRAINT "badge_definitions_name_check" CHECK (("length"("name") <= 100)),
    CONSTRAINT "badge_definitions_xp_reward_check" CHECK (("xp_reward" >= 0))
);


ALTER TABLE "public"."badge_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beach_forecast_accuracy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "avg_wave_height_delta" numeric(5,2),
    "avg_wind_speed_delta" numeric(5,2),
    "avg_confidence_accuracy" numeric(5,2),
    "total_sessions_count" integer DEFAULT 0,
    "last_30_days_count" integer DEFAULT 0,
    "last_7_days_count" integer DEFAULT 0,
    "overall_accuracy_score" numeric(5,2),
    "calculation_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."beach_forecast_accuracy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beach_recommendation_calibration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "window_start" "date" NOT NULL,
    "window_end" "date" NOT NULL,
    "samples_count" integer DEFAULT 0 NOT NULL,
    "best_swell_dir_deg_min" smallint,
    "best_swell_dir_deg_max" smallint,
    "best_wind_offshore_deg" smallint,
    "best_wind_tol_deg" smallint,
    "best_tide_ft_min" numeric,
    "best_tide_ft_max" numeric,
    "skill_level_inferred" "text",
    "method" "text" DEFAULT 'default_seed'::"text" NOT NULL,
    "metrics" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."beach_recommendation_calibration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beach_review_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."beach_review_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beach_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "overall_rating" integer NOT NULL,
    "wave_quality_rating" integer NOT NULL,
    "crowd_density_rating" integer NOT NULL,
    "parking_rating" integer NOT NULL,
    "accessibility_rating" integer NOT NULL,
    "title" character varying(255) NOT NULL,
    "content" "text" NOT NULL,
    "visit_date" "date",
    "helpful_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "beach_reviews_accessibility_rating_check" CHECK ((("accessibility_rating" >= 1) AND ("accessibility_rating" <= 5))),
    CONSTRAINT "beach_reviews_crowd_density_rating_check" CHECK ((("crowd_density_rating" >= 1) AND ("crowd_density_rating" <= 5))),
    CONSTRAINT "beach_reviews_overall_rating_check" CHECK ((("overall_rating" >= 1) AND ("overall_rating" <= 5))),
    CONSTRAINT "beach_reviews_parking_rating_check" CHECK ((("parking_rating" >= 1) AND ("parking_rating" <= 5))),
    CONSTRAINT "beach_reviews_wave_quality_rating_check" CHECK ((("wave_quality_rating" >= 1) AND ("wave_quality_rating" <= 5)))
);


ALTER TABLE "public"."beach_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "latitude" double precision,
    "longitude" double precision,
    "is_private" boolean DEFAULT false NOT NULL,
    "owner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "region" "text",
    "country" "text",
    "lat" double precision,
    "lon" double precision,
    "break_type" "text",
    "hazards" "text"[] DEFAULT '{}'::"text"[],
    "skill_level" "text",
    "shoreline_aspect_deg" smallint,
    "swell_window_min_deg" smallint,
    "swell_window_max_deg" smallint,
    "wind_offshore_deg" smallint,
    "wind_offshore_tol_deg" smallint DEFAULT 30,
    "wind_cross_shore_ok_kt" smallint DEFAULT 10,
    "wind_onshore_bad_kt" smallint DEFAULT 8,
    "preferred_tide_ft_min" numeric,
    "preferred_tide_ft_max" numeric,
    "preference_model" "jsonb",
    "coordinates" "public"."geography"(Point,4326),
    "aspect_deg" integer,
    "offshore_deg" integer,
    "swell_window_center_deg" integer,
    "swell_window_halfwidth_deg" integer,
    "tide_min_ft" numeric,
    "tide_max_ft" numeric,
    "wind_cross_ok_kts" integer DEFAULT 8,
    "wind_onshore_bad_kts" integer DEFAULT 10,
    "region_id" "uuid"
);


ALTER TABLE "public"."beaches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."beaches"."break_type" IS 'Primary break type (e.g., beach, point, reef)';



COMMENT ON COLUMN "public"."beaches"."aspect_deg" IS 'Beach aspect/orientation in degrees (0-360)';



COMMENT ON COLUMN "public"."beaches"."offshore_deg" IS 'Offshore wind direction in degrees (0-360)';



COMMENT ON COLUMN "public"."beaches"."swell_window_center_deg" IS 'Center direction of swell window (0-360)';



COMMENT ON COLUMN "public"."beaches"."swell_window_halfwidth_deg" IS 'Half-width of acceptable swell window in degrees';



COMMENT ON COLUMN "public"."beaches"."tide_min_ft" IS 'Minimum preferred tide level (feet)';



COMMENT ON COLUMN "public"."beaches"."tide_max_ft" IS 'Maximum preferred tide level (feet)';



COMMENT ON COLUMN "public"."beaches"."wind_cross_ok_kts" IS 'Cross-shore wind threshold (knots) considered acceptable';



COMMENT ON COLUMN "public"."beaches"."wind_onshore_bad_kts" IS 'Onshore wind threshold (knots) considered bad';



CREATE TABLE IF NOT EXISTS "public"."boards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "board_type" "text" NOT NULL,
    "dimensions" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "session_count" integer DEFAULT 0,
    "size" "text",
    "volume" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."boards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buoys" (
    "buoy_uuid" "text" NOT NULL,
    "buoy_name" "text",
    "active" boolean DEFAULT true NOT NULL,
    "coordinates" "public"."geometry"(Point,4326),
    "water_temperature" numeric,
    "air_temperature" numeric,
    "wave_height" numeric,
    "wave_period" numeric,
    "wind_speed" numeric,
    "wind_gust" numeric,
    "wind_direction" numeric,
    "tides" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."buoys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enhanced_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "forecast_date" "date" NOT NULL,
    "forecast_time" time without time zone NOT NULL,
    "wave_height" "text",
    "wave_period" "text",
    "wave_direction" "text",
    "swell_1_height" "text",
    "swell_1_period" "text",
    "swell_1_direction" "text",
    "swell_2_height" "text",
    "swell_2_period" "text",
    "swell_2_direction" "text",
    "wind_wave_height" "text",
    "wind_wave_period" "text",
    "wind_wave_direction" "text",
    "water_temp" "text",
    "air_temperature" "text",
    "wind_speed" "text",
    "wind_direction" "text",
    "weather_condition" "text",
    "tide_status" "text",
    "tide_height" "text",
    "next_tide_time" "text",
    "next_tide_type" "text",
    "next_tide_height" "text",
    "confidence_score" integer DEFAULT 50 NOT NULL,
    "data_source" "text",
    "raw_forecast" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."enhanced_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorite_beaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "rank" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorite_beaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intel_post_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intel_post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intel_post_confirmations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intel_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid",
    "latitude" numeric(10,8) NOT NULL,
    "longitude" numeric(11,8) NOT NULL,
    "tag" "public"."intel_post_tag" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "photo_url" "text",
    "photo_storage_path" "text",
    "confirmations_count" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "expires_at" timestamp with time zone,
    "surf_conditions" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intel_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marine_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "ts" timestamp with time zone NOT NULL,
    "wave_height_m" numeric,
    "wave_period_s" numeric,
    "wave_direction_deg" numeric,
    "wind_speed_ms" numeric,
    "wind_direction_deg" numeric,
    "source" "text" NOT NULL,
    "is_observed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ts_utc" timestamp with time zone GENERATED ALWAYS AS ("ts") STORED,
    "hs_m" real GENERATED ALWAYS AS (
CASE
    WHEN ("wave_height_m" IS NULL) THEN NULL::real
    ELSE ("wave_height_m")::real
END) STORED,
    "tp_s" real GENERATED ALWAYS AS (
CASE
    WHEN ("wave_period_s" IS NULL) THEN NULL::real
    ELSE ("wave_period_s")::real
END) STORED,
    "swell_dir_deg" integer GENERATED ALWAYS AS (
CASE
    WHEN ("wave_direction_deg" IS NULL) THEN NULL::integer
    ELSE ("wave_direction_deg")::integer
END) STORED,
    "wind_spd_kts" real GENERATED ALWAYS AS (
CASE
    WHEN ("wind_speed_ms" IS NULL) THEN NULL::real
    ELSE (("wind_speed_ms" * 1.94384449))::real
END) STORED,
    "wind_dir_deg" integer GENERATED ALWAYS AS (
CASE
    WHEN ("wind_direction_deg" IS NULL) THEN NULL::integer
    ELSE ("wind_direction_deg")::integer
END) STORED,
    CONSTRAINT "marine_forecasts_source_check" CHECK (("source" = ANY (ARRAY['open-meteo'::"text", 'cdip'::"text", 'ndbc'::"text"])))
);


ALTER TABLE "public"."marine_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tide_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "ts" timestamp with time zone NOT NULL,
    "tide_height_m" numeric,
    "tide_phase" "text",
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ts_utc" timestamp with time zone GENERATED ALWAYS AS ("ts") STORED,
    "tide_ft" real GENERATED ALWAYS AS (
CASE
    WHEN ("tide_height_m" IS NULL) THEN NULL::real
    ELSE (("tide_height_m" * 3.28084))::real
END) STORED,
    CONSTRAINT "tide_forecasts_source_check" CHECK (("source" = ANY (ARRAY['open-meteo'::"text", 'noaa'::"text"])))
);


ALTER TABLE "public"."tide_forecasts" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_beach_hourly_scores" AS
 SELECT "m"."beach_id",
    ("m"."ts" AT TIME ZONE 'UTC'::"text") AS "ts_utc",
    "m"."wave_height_m" AS "hs_m",
    "m"."wave_period_s" AS "tp_s",
    "m"."wave_direction_deg" AS "swell_dir_deg",
    (("m"."wind_speed_ms" * 1.94384449))::numeric(6,2) AS "wind_spd_kts",
    "m"."wind_direction_deg" AS "wind_dir_deg",
    (("t"."tide_height_m" * 3.28084))::numeric(6,2) AS "tide_ft",
    0 AS "score_0_100"
   FROM ("public"."marine_forecasts" "m"
     JOIN "public"."tide_forecasts" "t" ON ((("t"."beach_id" = "m"."beach_id") AND ("t"."ts" = "m"."ts"))))
  WITH NO DATA;


ALTER TABLE "public"."mv_beach_hourly_scores" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."mv_beach_hourly_scores" IS 'Precomputed hourly marine+tide join keyed by (beach_id, ts_utc). score_0_100 is placeholder; computed via separate refresh routine.';



CREATE OR REPLACE VIEW "public"."v_beach_hourly_scores" WITH ("security_invoker"='true') AS
 SELECT "m"."beach_id",
    ("m"."ts" AT TIME ZONE 'UTC'::"text") AS "ts_utc",
    "abs"(("mod"(((("m"."wind_direction_deg" - ("b"."wind_offshore_deg")::numeric) + (540)::numeric))::integer, 360) - 180)) AS "wind_off_by_deg",
    GREATEST((0)::double precision, ((((1)::double precision + "cos"("radians"(("abs"(("mod"(((("m"."wind_direction_deg" - ("b"."wind_offshore_deg")::numeric) + (540)::numeric))::integer, 360) - 180)))::double precision))) / (2)::double precision) * ((1)::double precision - ((GREATEST((0)::numeric, (("m"."wind_speed_ms" * 1.94384449) - ("b"."wind_cross_shore_ok_kt")::numeric)))::double precision / (10.0)::double precision)))) AS "wind_score",
    COALESCE(GREATEST((0)::numeric, ((1)::numeric - ("abs"((("t_near"."tide_height_m" * 3.28084) - (("b"."preferred_tide_ft_min" + "b"."preferred_tide_ft_max") / 2.0))) / NULLIF((("b"."preferred_tide_ft_max" - "b"."preferred_tide_ft_min") / 2.0), (0)::numeric)))), (0)::numeric) AS "tide_score",
    ( WITH "params" AS (
                 SELECT ((("b"."swell_window_max_deg" - "b"."swell_window_min_deg") + 360) % 360) AS "span",
                    "b"."swell_window_min_deg" AS "min_deg"
                )
         SELECT GREATEST((0)::double precision, ((1)::double precision - ((GREATEST((0)::numeric, (("abs"(("mod"(((("m"."wave_direction_deg" - (("params"."min_deg")::numeric + (("params"."span")::numeric / 2.0))) + (540)::numeric))::integer, 360) - 180)))::numeric - (("params"."span")::numeric / 2.0))))::double precision / (30.0)::double precision))) AS "greatest"
           FROM "params") AS "swell_dir_score",
    0.0 AS "period_score",
    0.0 AS "height_score",
    ("round"((((100)::double precision * GREATEST((0)::double precision, ((((0.4)::double precision * GREATEST((0)::double precision, ((((1)::double precision + "cos"("radians"(("abs"(("mod"(((("m"."wind_direction_deg" - ("b"."wind_offshore_deg")::numeric) + (540)::numeric))::integer, 360) - 180)))::double precision))) / (2)::double precision) * ((1)::double precision - ((GREATEST((0)::numeric, (("m"."wind_speed_ms" * 1.94384449) - ("b"."wind_cross_shore_ok_kt")::numeric)))::double precision / (10.0)::double precision))))) + ((0.2 * COALESCE(GREATEST((0)::numeric, ((1)::numeric - ("abs"((("t_near"."tide_height_m" * 3.28084) - (("b"."preferred_tide_ft_min" + "b"."preferred_tide_ft_max") / 2.0))) / NULLIF((("b"."preferred_tide_ft_max" - "b"."preferred_tide_ft_min") / 2.0), (0)::numeric)))), (0)::numeric)))::double precision) + ((0.4)::double precision * ( WITH "params" AS (
                 SELECT ((("b"."swell_window_max_deg" - "b"."swell_window_min_deg") + 360) % 360) AS "span",
                    "b"."swell_window_min_deg" AS "min_deg"
                )
         SELECT GREATEST((0)::double precision, ((1)::double precision - ((GREATEST((0)::numeric, (("abs"(("mod"(((("m"."wave_direction_deg" - (("params"."min_deg")::numeric + (("params"."span")::numeric / 2.0))) + (540)::numeric))::integer, 360) - 180)))::numeric - (("params"."span")::numeric / 2.0))))::double precision / (30.0)::double precision))) AS "greatest"
           FROM "params"))))) * (1)::double precision)))::integer AS "score_0_100"
   FROM (("public"."marine_forecasts" "m"
     JOIN "public"."beaches" "b" ON (("b"."id" = "m"."beach_id")))
     LEFT JOIN LATERAL ( SELECT "t"."ts",
            "t"."tide_height_m"
           FROM "public"."tide_forecasts" "t"
          WHERE (("t"."beach_id" = "m"."beach_id") AND (("t"."ts" >= ("m"."ts" - '01:30:00'::interval)) AND ("t"."ts" <= ("m"."ts" + '01:30:00'::interval))))
          ORDER BY ("abs"(EXTRACT(epoch FROM ("t"."ts" - "m"."ts"))))
         LIMIT 1) "t_near" ON (true));


ALTER TABLE "public"."v_beach_hourly_scores" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_beach_hourly_scores" IS 'Per-hour beach suitability scores (0-100). Security: security_invoker = true so underlying table RLS applies to caller.';



CREATE MATERIALIZED VIEW "public"."mv_best_times" AS
 WITH "hrs" AS (
         SELECT "v_beach_hourly_scores"."beach_id",
            "v_beach_hourly_scores"."ts_utc",
            "v_beach_hourly_scores"."score_0_100"
           FROM "public"."v_beach_hourly_scores"
          WHERE (("v_beach_hourly_scores"."ts_utc" >= "now"()) AND ("v_beach_hourly_scores"."ts_utc" < ("now"() + '72:00:00'::interval)))
        ), "win" AS (
         SELECT "h1"."beach_id",
            "h1"."ts_utc" AS "start_ts",
            ("h1"."ts_utc" + '02:00:00'::interval) AS "end_ts",
            ("round"("avg"("h2"."score_0_100")))::integer AS "score"
           FROM ("hrs" "h1"
             JOIN "hrs" "h2" ON ((("h2"."beach_id" = "h1"."beach_id") AND (("h2"."ts_utc" >= "h1"."ts_utc") AND ("h2"."ts_utc" <= ("h1"."ts_utc" + '01:00:00'::interval))))))
          GROUP BY "h1"."beach_id", "h1"."ts_utc"
        ), "ranked" AS (
         SELECT "w"."beach_id",
            "w"."start_ts",
            "w"."end_ts",
            "w"."score",
                CASE
                    WHEN ("w"."score" >= 85) THEN 'epic'::"text"
                    WHEN ("w"."score" >= 70) THEN 'good'::"text"
                    WHEN ("w"."score" >= 55) THEN 'fair'::"text"
                    ELSE 'poor'::"text"
                END AS "grade"
           FROM "win" "w"
        )
 SELECT "ranked"."beach_id",
    "ranked"."start_ts",
    "ranked"."end_ts",
    "ranked"."grade",
    "ranked"."score",
    "now"() AS "updated_at"
   FROM "ranked"
  WITH NO DATA;


ALTER TABLE "public"."mv_best_times" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_session_invites" boolean DEFAULT true NOT NULL,
    "inapp_session_invites" boolean DEFAULT true NOT NULL,
    "digest_session_invites" boolean DEFAULT false NOT NULL,
    "favorite_spot" "text",
    "favorite_spot_id" "uuid",
    "followers_count" integer DEFAULT 0,
    "following_count" integer DEFAULT 0,
    "is_mock" boolean DEFAULT false NOT NULL,
    "avatar_url" "text",
    "email" "text",
    "phone_number" "text",
    "bio" "text",
    "location" "text",
    "experience_level" "text",
    "instagram" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "home_beach_id" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."is_mock" IS 'Flag to identify mock/test users for development and testing purposes';



COMMENT ON COLUMN "public"."profiles"."home_beach_id" IS 'User''s preferred home beach for forecasts and session defaults';



CREATE TABLE IF NOT EXISTS "public"."session_forecast_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "forecast_snapshot" "jsonb" NOT NULL,
    "actual_conditions" "jsonb" NOT NULL,
    "forecast_confidence_score" integer,
    "data_source" "text",
    "session_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."session_forecast_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "inviter_id" "uuid" NOT NULL,
    "invitee_id" "uuid",
    "invitee_email" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    "idempotency_key" "text",
    CONSTRAINT "session_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."session_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "board_id" "uuid",
    "arrival_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "goals" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "notes" "text",
    "invitee_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'planned'::"text",
    "beach_name" "text",
    "rating" smallint,
    "description" "text",
    "image_url" "text",
    "likes_count" integer DEFAULT 0 NOT NULL,
    "comments_count" integer DEFAULT 0 NOT NULL,
    "crowd_level" integer,
    "wave_quality" integer,
    "water_temp" numeric,
    "parking_ease" integer,
    "is_public" boolean DEFAULT true
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spot_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "spot_id" "uuid" NOT NULL,
    "rec_id" "uuid",
    "accurate" boolean NOT NULL,
    "reasons" "text"[],
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "spot_feedback_note_check" CHECK (("char_length"("note") <= 280))
);


ALTER TABLE "public"."spot_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sun_times" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "sunrise_utc" timestamp with time zone,
    "sunset_utc" timestamp with time zone,
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sun_times_source_check" CHECK (("source" = ANY (ARRAY['open-meteo'::"text", 'computed'::"text"])))
);


ALTER TABLE "public"."sun_times" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ten_day_enhanced_forecasts" WITH ("security_invoker"='true') AS
 SELECT "enhanced_forecasts"."id",
    "enhanced_forecasts"."beach_id",
    "enhanced_forecasts"."forecast_date",
    "enhanced_forecasts"."forecast_time",
    "enhanced_forecasts"."wave_height",
    "enhanced_forecasts"."wave_period",
    "enhanced_forecasts"."wave_direction",
    "enhanced_forecasts"."swell_1_height",
    "enhanced_forecasts"."swell_1_period",
    "enhanced_forecasts"."swell_1_direction",
    "enhanced_forecasts"."swell_2_height",
    "enhanced_forecasts"."swell_2_period",
    "enhanced_forecasts"."swell_2_direction",
    "enhanced_forecasts"."wind_wave_height",
    "enhanced_forecasts"."wind_wave_period",
    "enhanced_forecasts"."wind_wave_direction",
    "enhanced_forecasts"."water_temp",
    "enhanced_forecasts"."air_temperature",
    "enhanced_forecasts"."wind_speed",
    "enhanced_forecasts"."wind_direction",
    "enhanced_forecasts"."weather_condition",
    "enhanced_forecasts"."tide_status",
    "enhanced_forecasts"."tide_height",
    "enhanced_forecasts"."next_tide_time",
    "enhanced_forecasts"."next_tide_type",
    "enhanced_forecasts"."next_tide_height",
    "enhanced_forecasts"."confidence_score",
    "enhanced_forecasts"."data_source",
    "enhanced_forecasts"."raw_forecast",
    "enhanced_forecasts"."created_at",
    "enhanced_forecasts"."updated_at"
   FROM "public"."enhanced_forecasts"
  WHERE (("enhanced_forecasts"."forecast_date" >= CURRENT_DATE) AND ("enhanced_forecasts"."forecast_date" <= (CURRENT_DATE + '10 days'::interval)))
  ORDER BY "enhanced_forecasts"."beach_id", "enhanced_forecasts"."forecast_date", "enhanced_forecasts"."forecast_time";


ALTER TABLE "public"."ten_day_enhanced_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_type" character varying(50) NOT NULL,
    "entity_type" character varying(50) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_slug" "text" NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_follows_check" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."user_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_xp" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "xp_total" integer DEFAULT 0 NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_xp_level_check" CHECK ((("level" >= 1) AND ("level" <= 9))),
    CONSTRAINT "user_xp_xp_total_check" CHECK (("xp_total" >= 0))
);


ALTER TABLE "public"."user_xp" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."xp_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "xp_amount" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "related_entity_id" "uuid",
    "related_entity_type" "text",
    CONSTRAINT "xp_events_action_check" CHECK (("length"("action") <= 100)),
    CONSTRAINT "xp_events_related_entity_type_check" CHECK (("related_entity_type" = ANY (ARRAY['session'::"text", 'board'::"text", 'intel_post'::"text", 'review'::"text", 'invite'::"text", 'photo'::"text"]))),
    CONSTRAINT "xp_events_xp_amount_check" CHECK (("xp_amount" > 0))
);


ALTER TABLE "public"."xp_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."badge_definitions"
    ADD CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("badge_slug");



ALTER TABLE ONLY "public"."beach_forecast_accuracy"
    ADD CONSTRAINT "beach_forecast_accuracy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_recommendation_calibration"
    ADD CONSTRAINT "beach_recommendation_calibration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_review_likes"
    ADD CONSTRAINT "beach_review_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_review_likes"
    ADD CONSTRAINT "beach_review_likes_review_id_user_id_key" UNIQUE ("review_id", "user_id");



ALTER TABLE ONLY "public"."beach_reviews"
    ADD CONSTRAINT "beach_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beaches"
    ADD CONSTRAINT "beaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buoys"
    ADD CONSTRAINT "buoys_pkey" PRIMARY KEY ("buoy_uuid");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enhanced_forecasts"
    ADD CONSTRAINT "enhanced_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enhanced_forecasts"
    ADD CONSTRAINT "enhanced_forecasts_unique" UNIQUE ("beach_id", "forecast_date", "forecast_time");



ALTER TABLE ONLY "public"."favorite_beaches"
    ADD CONSTRAINT "favorite_beaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intel_post_confirmations"
    ADD CONSTRAINT "intel_post_confirmations_intel_post_id_user_id_key" UNIQUE ("intel_post_id", "user_id");



ALTER TABLE ONLY "public"."intel_post_confirmations"
    ADD CONSTRAINT "intel_post_confirmations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intel_posts"
    ADD CONSTRAINT "intel_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marine_forecasts"
    ADD CONSTRAINT "marine_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marine_forecasts"
    ADD CONSTRAINT "marine_forecasts_unique" UNIQUE ("beach_id", "ts", "source");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_forecast_snapshots"
    ADD CONSTRAINT "session_forecast_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_invitations"
    ADD CONSTRAINT "session_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_invitations"
    ADD CONSTRAINT "session_invitations_unique_session_invitee_email" UNIQUE ("session_id", "invitee_email");



ALTER TABLE ONLY "public"."session_invitations"
    ADD CONSTRAINT "session_invitations_unique_session_invitee_id" UNIQUE ("session_id", "invitee_id");



ALTER TABLE ONLY "public"."session_likes"
    ADD CONSTRAINT "session_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_likes"
    ADD CONSTRAINT "session_likes_session_id_user_id_key" UNIQUE ("session_id", "user_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spot_feedback"
    ADD CONSTRAINT "spot_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sun_times"
    ADD CONSTRAINT "sun_times_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sun_times"
    ADD CONSTRAINT "sun_times_unique" UNIQUE ("beach_id", "date", "source");



ALTER TABLE ONLY "public"."tide_forecasts"
    ADD CONSTRAINT "tide_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tide_forecasts"
    ADD CONSTRAINT "tide_forecasts_unique" UNIQUE ("beach_id", "ts", "source");



ALTER TABLE ONLY "public"."beach_forecast_accuracy"
    ADD CONSTRAINT "unique_beach_accuracy" UNIQUE ("beach_id");



ALTER TABLE ONLY "public"."session_forecast_snapshots"
    ADD CONSTRAINT "unique_session_forecast_snapshot" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."user_activities"
    ADD CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_slug_key" UNIQUE ("user_id", "badge_slug");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_xp"
    ADD CONSTRAINT "user_xp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_xp"
    ADD CONSTRAINT "user_xp_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."xp_events"
    ADD CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "beach_review_likes_review_id_idx" ON "public"."beach_review_likes" USING "btree" ("review_id");



CREATE INDEX "beach_review_likes_user_id_idx" ON "public"."beach_review_likes" USING "btree" ("user_id");



CREATE INDEX "beach_reviews_beach_id_idx" ON "public"."beach_reviews" USING "btree" ("beach_id");



CREATE INDEX "beach_reviews_created_at_idx" ON "public"."beach_reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "beach_reviews_helpful_count_idx" ON "public"."beach_reviews" USING "btree" ("helpful_count" DESC);



CREATE INDEX "beach_reviews_overall_rating_idx" ON "public"."beach_reviews" USING "btree" ("overall_rating");



CREATE INDEX "beach_reviews_user_id_idx" ON "public"."beach_reviews" USING "btree" ("user_id");



CREATE UNIQUE INDEX "beaches_name_unique" ON "public"."beaches" USING "btree" ("lower"("name"));



CREATE INDEX "beaches_region_id_idx" ON "public"."beaches" USING "btree" ("region_id");



CREATE UNIQUE INDEX "favorite_beaches_unique" ON "public"."favorite_beaches" USING "btree" ("user_id", "beach_id");



CREATE INDEX "idx_beaches_lat_lon" ON "public"."beaches" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_beaches_location_active" ON "public"."beaches" USING "btree" ("latitude", "longitude") WHERE (("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL));



CREATE INDEX "idx_beaches_owner_id_fkey" ON "public"."beaches" USING "btree" ("owner_id");



CREATE INDEX "idx_beaches_private_owner" ON "public"."beaches" USING "btree" ("is_private", "owner_id") WHERE ("is_private" = true);



CREATE INDEX "idx_bfa_beach_id" ON "public"."beach_forecast_accuracy" USING "btree" ("beach_id");



CREATE INDEX "idx_bfa_calc_date" ON "public"."beach_forecast_accuracy" USING "btree" ("calculation_date" DESC);



CREATE INDEX "idx_bfa_updated" ON "public"."beach_forecast_accuracy" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_buoys_active" ON "public"."buoys" USING "btree" ("active");



CREATE INDEX "idx_buoys_active_recent_data" ON "public"."buoys" USING "btree" ("active", "updated_at" DESC) WHERE ("active" = true);



CREATE INDEX "idx_buoys_conditions_lookup" ON "public"."buoys" USING "btree" ("active", "updated_at" DESC) WHERE (("active" = true) AND ("coordinates" IS NOT NULL));



CREATE INDEX "idx_buoys_coordinates_gist" ON "public"."buoys" USING "gist" ("coordinates");



CREATE INDEX "idx_buoys_updated_at" ON "public"."buoys" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_comments_session_id" ON "public"."comments" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "idx_comments_user_id" ON "public"."comments" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_enhanced_forecasts_beach_date_recent" ON "public"."enhanced_forecasts" USING "btree" ("beach_id", "forecast_date" DESC);



CREATE INDEX "idx_enhanced_forecasts_beach_date_time" ON "public"."enhanced_forecasts" USING "btree" ("beach_id", "forecast_date", "forecast_time");



CREATE INDEX "idx_enhanced_forecasts_beach_date_time_optimized" ON "public"."enhanced_forecasts" USING "btree" ("beach_id", "forecast_date", "forecast_time");



CREATE INDEX "idx_favorite_beaches_user_rank" ON "public"."favorite_beaches" USING "btree" ("user_id", "rank");



CREATE INDEX "idx_marine_forecasts_beach_ts" ON "public"."marine_forecasts" USING "btree" ("beach_id", "ts");



CREATE INDEX "idx_marine_forecasts_beach_ts_utc" ON "public"."marine_forecasts" USING "btree" ("beach_id", "ts_utc");



CREATE INDEX "idx_mv_best_times_beach_score" ON "public"."mv_best_times" USING "btree" ("beach_id", "score" DESC);



CREATE UNIQUE INDEX "idx_mv_best_times_beach_start" ON "public"."mv_best_times" USING "btree" ("beach_id", "start_ts");



CREATE INDEX "idx_mv_vbhs_beach_ts" ON "public"."mv_beach_hourly_scores" USING "btree" ("beach_id", "ts_utc");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_favorite_spot_id" ON "public"."profiles" USING "btree" ("favorite_spot_id");



CREATE INDEX "idx_profiles_home_beach_id" ON "public"."profiles" USING "btree" ("home_beach_id");



CREATE INDEX "idx_profiles_is_mock" ON "public"."profiles" USING "btree" ("is_mock") WHERE ("is_mock" = true);



CREATE UNIQUE INDEX "idx_session_invitations_idempotency_key" ON "public"."session_invitations" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_session_likes_session_id" ON "public"."session_likes" USING "btree" ("session_id");



CREATE INDEX "idx_session_likes_user_id" ON "public"."session_likes" USING "btree" ("user_id");



CREATE INDEX "idx_sfs_actual_gin" ON "public"."session_forecast_snapshots" USING "gin" ("actual_conditions");



CREATE INDEX "idx_sfs_beach_date" ON "public"."session_forecast_snapshots" USING "btree" ("beach_id", "session_date" DESC);



CREATE INDEX "idx_sfs_beach_id" ON "public"."session_forecast_snapshots" USING "btree" ("beach_id");



CREATE INDEX "idx_sfs_date" ON "public"."session_forecast_snapshots" USING "btree" ("session_date" DESC);



CREATE INDEX "idx_sfs_forecast_gin" ON "public"."session_forecast_snapshots" USING "gin" ("forecast_snapshot");



CREATE INDEX "idx_sfs_session_id" ON "public"."session_forecast_snapshots" USING "btree" ("session_id");



CREATE INDEX "idx_sfs_user_id" ON "public"."session_forecast_snapshots" USING "btree" ("user_id");



CREATE INDEX "idx_spot_feedback_spot_accurate" ON "public"."spot_feedback" USING "btree" ("spot_id", "accurate", "created_at" DESC);



CREATE INDEX "idx_spot_feedback_user_recent" ON "public"."spot_feedback" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_sun_times_beach_date" ON "public"."sun_times" USING "btree" ("beach_id", "date");



CREATE INDEX "idx_tide_forecasts_beach_ts" ON "public"."tide_forecasts" USING "btree" ("beach_id", "ts");



CREATE INDEX "idx_tide_forecasts_beach_ts_utc" ON "public"."tide_forecasts" USING "btree" ("beach_id", "ts_utc");



CREATE INDEX "idx_user_activities_created_at" ON "public"."user_activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_activities_entity" ON "public"."user_activities" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_user_activities_type_created_at" ON "public"."user_activities" USING "btree" ("activity_type", "created_at" DESC);



CREATE INDEX "idx_user_activities_user_id_created_at" ON "public"."user_activities" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_badges_badge_slug" ON "public"."user_badges" USING "btree" ("badge_slug");



CREATE INDEX "idx_user_badges_unlocked_at" ON "public"."user_badges" USING "btree" ("unlocked_at");



CREATE INDEX "idx_user_badges_user_id" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "idx_user_xp_level" ON "public"."user_xp" USING "btree" ("level");



CREATE INDEX "idx_user_xp_user_id" ON "public"."user_xp" USING "btree" ("user_id");



CREATE INDEX "idx_xp_events_action" ON "public"."xp_events" USING "btree" ("action");



CREATE INDEX "idx_xp_events_created_at" ON "public"."xp_events" USING "btree" ("created_at");



CREATE INDEX "idx_xp_events_user_id" ON "public"."xp_events" USING "btree" ("user_id");



CREATE INDEX "intel_post_confirmations_post_id_idx" ON "public"."intel_post_confirmations" USING "btree" ("intel_post_id");



CREATE INDEX "intel_post_confirmations_user_id_idx" ON "public"."intel_post_confirmations" USING "btree" ("user_id");



CREATE INDEX "intel_posts_beach_id_idx" ON "public"."intel_posts" USING "btree" ("beach_id");



CREATE INDEX "intel_posts_confirmations_count_idx" ON "public"."intel_posts" USING "btree" ("confirmations_count" DESC);



CREATE INDEX "intel_posts_created_at_idx" ON "public"."intel_posts" USING "btree" ("created_at" DESC);



CREATE INDEX "intel_posts_is_active_idx" ON "public"."intel_posts" USING "btree" ("is_active");



CREATE INDEX "intel_posts_location_idx" ON "public"."intel_posts" USING "gist" ("public"."st_point"(("longitude")::double precision, ("latitude")::double precision));



CREATE INDEX "intel_posts_tag_idx" ON "public"."intel_posts" USING "btree" ("tag");



CREATE INDEX "intel_posts_user_id_idx" ON "public"."intel_posts" USING "btree" ("user_id");



CREATE INDEX "sessions_beach_idx" ON "public"."sessions" USING "btree" ("beach_id", "created_at" DESC);



CREATE INDEX "sessions_created_idx" ON "public"."sessions" USING "btree" ("created_at" DESC);



CREATE INDEX "sessions_user_idx" ON "public"."sessions" USING "btree" ("user_id", "arrival_time" DESC);



CREATE OR REPLACE TRIGGER "beach_review_likes_count_trigger" AFTER INSERT OR DELETE ON "public"."beach_review_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_review_helpful_count"();



CREATE OR REPLACE TRIGGER "intel_post_confirmations_count_trigger" AFTER INSERT OR DELETE ON "public"."intel_post_confirmations" FOR EACH ROW EXECUTE FUNCTION "public"."update_intel_confirmations_count"();



CREATE OR REPLACE TRIGGER "trg_prevent_delete_profiles" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_delete_on_protected"();



CREATE OR REPLACE TRIGGER "trigger_create_session_forecast_snapshot" AFTER UPDATE OF "status" ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."create_session_forecast_snapshot"();



CREATE OR REPLACE TRIGGER "trigger_update_session_comments_count" AFTER INSERT OR DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_session_comments_count"();



CREATE OR REPLACE TRIGGER "trigger_update_session_likes_count" AFTER INSERT OR DELETE ON "public"."session_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_session_likes_count"();



CREATE OR REPLACE TRIGGER "update_follow_counts_trigger" AFTER INSERT OR DELETE ON "public"."user_follows" FOR EACH ROW EXECUTE FUNCTION "public"."update_follow_counts"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_xp_updated_at" BEFORE UPDATE ON "public"."user_xp" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."beach_forecast_accuracy"
    ADD CONSTRAINT "beach_forecast_accuracy_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_recommendation_calibration"
    ADD CONSTRAINT "beach_recommendation_calibration_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id");



ALTER TABLE ONLY "public"."beach_review_likes"
    ADD CONSTRAINT "beach_review_likes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."beach_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_review_likes"
    ADD CONSTRAINT "beach_review_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_reviews"
    ADD CONSTRAINT "beach_reviews_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_reviews"
    ADD CONSTRAINT "beach_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beaches"
    ADD CONSTRAINT "beaches_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enhanced_forecasts"
    ADD CONSTRAINT "enhanced_forecasts_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorite_beaches"
    ADD CONSTRAINT "favorite_beaches_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorite_beaches"
    ADD CONSTRAINT "favorite_beaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_post_confirmations"
    ADD CONSTRAINT "intel_post_confirmations_intel_post_id_fkey" FOREIGN KEY ("intel_post_id") REFERENCES "public"."intel_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_post_confirmations"
    ADD CONSTRAINT "intel_post_confirmations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_posts"
    ADD CONSTRAINT "intel_posts_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_posts"
    ADD CONSTRAINT "intel_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marine_forecasts"
    ADD CONSTRAINT "marine_forecasts_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_default_beach_id_fkey" FOREIGN KEY ("home_beach_id") REFERENCES "public"."beaches"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_favorite_spot_id_fkey" FOREIGN KEY ("favorite_spot_id") REFERENCES "public"."beaches"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_home_beach_id_fkey" FOREIGN KEY ("home_beach_id") REFERENCES "public"."beaches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_forecast_snapshots"
    ADD CONSTRAINT "session_forecast_snapshots_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_forecast_snapshots"
    ADD CONSTRAINT "session_forecast_snapshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_forecast_snapshots"
    ADD CONSTRAINT "session_forecast_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_likes"
    ADD CONSTRAINT "session_likes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_likes"
    ADD CONSTRAINT "session_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spot_feedback"
    ADD CONSTRAINT "spot_feedback_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spot_feedback"
    ADD CONSTRAINT "spot_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sun_times"
    ADD CONSTRAINT "sun_times_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tide_forecasts"
    ADD CONSTRAINT "tide_forecasts_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_activities"
    ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_slug_fkey" FOREIGN KEY ("badge_slug") REFERENCES "public"."badge_definitions"("badge_slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_xp"
    ADD CONSTRAINT "user_xp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."xp_events"
    ADD CONSTRAINT "xp_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view badge definitions" ON "public"."badge_definitions" FOR SELECT USING (true);



CREATE POLICY "Anyone can view beach forecast accuracy" ON "public"."beach_forecast_accuracy" FOR SELECT USING (true);



CREATE POLICY "Delete own like" ON "public"."beach_review_likes" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Insert own like" ON "public"."beach_review_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Intel confirmations are readable" ON "public"."intel_post_confirmations" FOR SELECT USING (true);



CREATE POLICY "Intel posts are publicly readable" ON "public"."intel_posts" FOR SELECT USING (true);



CREATE POLICY "Public profiles are viewable by all" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public read beaches" ON "public"."beaches" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read calibration" ON "public"."beach_recommendation_calibration" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Read likes (auth)" ON "public"."beach_review_likes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role can manage beach forecast accuracy" ON "public"."beach_forecast_accuracy" USING (((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("auth"."uid"() = "users"."id") AND (("users"."raw_app_meta_data" ->> 'role'::"text") = 'admin'::"text"))))));



CREATE POLICY "System can insert XP events" ON "public"."xp_events" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "System can insert user XP" ON "public"."user_xp" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "System can insert user badges" ON "public"."user_badges" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own session forecast snapshots" ON "public"."session_forecast_snapshots" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow others" ON "public"."user_follows" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own session forecast snapshots" ON "public"."session_forecast_snapshots" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can respond to invitations they received" ON "public"."session_invitations" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "invitee_id") OR ("invitee_email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "invitee_id") OR ("invitee_email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text"))));



CREATE POLICY "Users can unfollow others" ON "public"."user_follows" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can update own XP" ON "public"."user_xp" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own session forecast snapshots" ON "public"."session_forecast_snapshots" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view follow relationships" ON "public"."user_follows" FOR SELECT USING (true);



CREATE POLICY "Users can view invitations they received" ON "public"."session_invitations" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "invitee_id") OR ("invitee_email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text"))));



CREATE POLICY "Users can view own XP" ON "public"."user_xp" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own XP events" ON "public"."xp_events" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own badges" ON "public"."user_badges" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own session forecast snapshots" ON "public"."session_forecast_snapshots" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."badge_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beach_forecast_accuracy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beach_recommendation_calibration" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beach_review_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."buoys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buoys_select_all" ON "public"."buoys" FOR SELECT USING (true);



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_delete_own" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "comments_insert_own" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "comments_select_all" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "comments_update_own" ON "public"."comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."enhanced_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enhanced_forecasts_select_all" ON "public"."enhanced_forecasts" FOR SELECT USING (true);



ALTER TABLE "public"."favorite_beaches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "favorite_beaches_delete_own" ON "public"."favorite_beaches" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "favorite_beaches_insert_own" ON "public"."favorite_beaches" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "favorite_beaches_select_own" ON "public"."favorite_beaches" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "favorite_beaches_update_own" ON "public"."favorite_beaches" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."intel_post_confirmations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intel_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marine_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marine_forecasts_select_all" ON "public"."marine_forecasts" FOR SELECT USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_update_own_home_beach" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."session_forecast_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_likes_delete_own" ON "public"."session_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "session_likes_insert_own" ON "public"."session_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "session_likes_select_all" ON "public"."session_likes" FOR SELECT USING (true);



ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_delete_own" ON "public"."sessions" FOR DELETE USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "sessions_insert_own" ON "public"."sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "sessions_select_all" ON "public"."sessions" FOR SELECT USING (true);



CREATE POLICY "sessions_update_own" ON "public"."sessions" FOR UPDATE USING (("auth"."uid"() = "profile_id"));



ALTER TABLE "public"."spot_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "spot_feedback_insert_own" ON "public"."spot_feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "spot_feedback_select_own" ON "public"."spot_feedback" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."sun_times" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sun_times_select_all" ON "public"."sun_times" FOR SELECT USING (true);



ALTER TABLE "public"."tide_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tide_forecasts_select_all" ON "public"."tide_forecasts" FOR SELECT USING (true);



ALTER TABLE "public"."user_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_activities_insert_own" ON "public"."user_activities" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_activities_select_all" ON "public"."user_activities" FOR SELECT USING (true);



ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_xp" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."xp_events" ENABLE ROW LEVEL SECURITY;


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "claude_migrator";



GRANT ALL ON FUNCTION "public"."check_database_health"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_database_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_database_health"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_inactive_buoys"("inactive_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_inactive_buoys"("inactive_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_inactive_buoys"("inactive_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_forecasts"("retention_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_forecasts"("retention_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_forecasts"("retention_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_stale_enhanced_forecasts"("retention_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_stale_enhanced_forecasts"("retention_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_stale_enhanced_forecasts"("retention_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_activity"("p_user_id" "uuid", "p_activity_type" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_activity"("p_user_id" "uuid", "p_activity_type" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_activity"("p_user_id" "uuid", "p_activity_type" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_session_forecast_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_session_forecast_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_session_forecast_snapshot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer, "limit_count" integer, "min_rating" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer, "limit_count" integer, "min_rating" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer, "limit_count" integer, "min_rating" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_beaches_near"("_lat" double precision, "_lon" double precision, "_radius_km" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_beaches_near"("_lat" double precision, "_lon" double precision, "_radius_km" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_beaches_near"("_lat" double precision, "_lon" double precision, "_radius_km" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_best_times"("p_beach" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_best_times"("p_beach" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_best_times"("p_beach" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer, "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer, "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer, "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer, "radius_miles" double precision, "tag_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer, "radius_miles" double precision, "tag_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer, "radius_miles" double precision, "tag_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nightly_forecast_maintenance"() TO "anon";
GRANT ALL ON FUNCTION "public"."nightly_forecast_maintenance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."nightly_forecast_maintenance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_delete_on_protected"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_delete_on_protected"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_delete_on_protected"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_enhanced_forecasts_for_active_beaches"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_enhanced_forecasts_for_active_beaches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_enhanced_forecasts_for_active_beaches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_beach_hourly_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_beach_hourly_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_beach_hourly_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_beach_hourly_scores_and_analyze"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_beach_hourly_scores_and_analyze"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_beach_hourly_scores_and_analyze"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_best_times"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_best_times"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_best_times"() TO "service_role";



GRANT ALL ON FUNCTION "public"."run_database_maintenance"("cleanup_forecasts" boolean, "cleanup_buoys" boolean, "update_stats" boolean, "forecast_retention_days" integer, "buoy_inactive_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."run_database_maintenance"("cleanup_forecasts" boolean, "cleanup_buoys" boolean, "update_stats" boolean, "forecast_retention_days" integer, "buoy_inactive_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_database_maintenance"("cleanup_forecasts" boolean, "cleanup_buoys" boolean, "update_stats" boolean, "forecast_retention_days" integer, "buoy_inactive_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_manual_maintenance"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_manual_maintenance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_manual_maintenance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_follow_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_follow_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_follow_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_forecast_table_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_forecast_table_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_forecast_table_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_intel_confirmations_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_intel_confirmations_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_intel_confirmations_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_comments_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_comments_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_comments_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."badge_definitions" TO "anon";
GRANT ALL ON TABLE "public"."badge_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."badge_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."beach_forecast_accuracy" TO "anon";
GRANT ALL ON TABLE "public"."beach_forecast_accuracy" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_forecast_accuracy" TO "service_role";



GRANT ALL ON TABLE "public"."beach_recommendation_calibration" TO "anon";
GRANT ALL ON TABLE "public"."beach_recommendation_calibration" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_recommendation_calibration" TO "service_role";



GRANT ALL ON TABLE "public"."beach_review_likes" TO "anon";
GRANT ALL ON TABLE "public"."beach_review_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_review_likes" TO "service_role";



GRANT ALL ON TABLE "public"."beach_reviews" TO "anon";
GRANT ALL ON TABLE "public"."beach_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."beaches" TO "anon";
GRANT ALL ON TABLE "public"."beaches" TO "authenticated";
GRANT ALL ON TABLE "public"."beaches" TO "service_role";



GRANT ALL ON TABLE "public"."boards" TO "anon";
GRANT ALL ON TABLE "public"."boards" TO "authenticated";
GRANT ALL ON TABLE "public"."boards" TO "service_role";



GRANT ALL ON TABLE "public"."buoys" TO "anon";
GRANT ALL ON TABLE "public"."buoys" TO "authenticated";
GRANT ALL ON TABLE "public"."buoys" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."enhanced_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."enhanced_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."enhanced_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."favorite_beaches" TO "anon";
GRANT ALL ON TABLE "public"."favorite_beaches" TO "authenticated";
GRANT ALL ON TABLE "public"."favorite_beaches" TO "service_role";



GRANT ALL ON TABLE "public"."intel_post_confirmations" TO "anon";
GRANT ALL ON TABLE "public"."intel_post_confirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."intel_post_confirmations" TO "service_role";



GRANT ALL ON TABLE "public"."intel_posts" TO "anon";
GRANT ALL ON TABLE "public"."intel_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."intel_posts" TO "service_role";



GRANT ALL ON TABLE "public"."marine_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."marine_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."marine_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."tide_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."tide_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."tide_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."mv_beach_hourly_scores" TO "anon";
GRANT ALL ON TABLE "public"."mv_beach_hourly_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_beach_hourly_scores" TO "service_role";



GRANT ALL ON TABLE "public"."v_beach_hourly_scores" TO "anon";
GRANT ALL ON TABLE "public"."v_beach_hourly_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."v_beach_hourly_scores" TO "service_role";



GRANT ALL ON TABLE "public"."mv_best_times" TO "anon";
GRANT ALL ON TABLE "public"."mv_best_times" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_best_times" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."profiles" TO "claude_migrator";



GRANT ALL ON TABLE "public"."session_forecast_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."session_forecast_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."session_forecast_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."session_invitations" TO "anon";
GRANT ALL ON TABLE "public"."session_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."session_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."session_likes" TO "anon";
GRANT ALL ON TABLE "public"."session_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."session_likes" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."spot_feedback" TO "anon";
GRANT ALL ON TABLE "public"."spot_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."spot_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."sun_times" TO "anon";
GRANT ALL ON TABLE "public"."sun_times" TO "authenticated";
GRANT ALL ON TABLE "public"."sun_times" TO "service_role";



GRANT ALL ON TABLE "public"."ten_day_enhanced_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."ten_day_enhanced_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."ten_day_enhanced_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."user_activities" TO "anon";
GRANT ALL ON TABLE "public"."user_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."user_activities" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_follows" TO "anon";
GRANT ALL ON TABLE "public"."user_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."user_follows" TO "service_role";



GRANT ALL ON TABLE "public"."user_xp" TO "anon";
GRANT ALL ON TABLE "public"."user_xp" TO "authenticated";
GRANT ALL ON TABLE "public"."user_xp" TO "service_role";



GRANT ALL ON TABLE "public"."xp_events" TO "anon";
GRANT ALL ON TABLE "public"."xp_events" TO "authenticated";
GRANT ALL ON TABLE "public"."xp_events" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
