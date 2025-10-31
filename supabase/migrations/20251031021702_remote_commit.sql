drop extension if exists "btree_gist";

drop extension if exists "pg_net";

drop trigger if exists "trg_beach_calibration_set_updated_at" on "public"."beach_calibration";

drop trigger if exists "trigger_beach_review_activity" on "public"."beach_reviews";

drop trigger if exists "trg_set_beach_coordinates" on "public"."beaches";

drop trigger if exists "handle_invitation_acceptance" on "public"."session_invitations";

drop trigger if exists "add_session_owner_participant" on "public"."sessions";

drop trigger if exists "trigger_follow_activity" on "public"."user_follows";

drop policy "select_all" on "public"."beach_calibration";

drop policy "beach_forecast_accuracy_service_optimized" on "public"."beach_forecast_accuracy";

drop policy "beach_reviews_cud_optimized" on "public"."beach_reviews";

drop policy "boards_cud_optimized" on "public"."boards";

drop policy "buoys_service_optimized" on "public"."buoys";

drop policy "comments_delete_optimized" on "public"."comments";

drop policy "comments_insert_optimized" on "public"."comments";

drop policy "comments_update_optimized" on "public"."comments";

drop policy "enhanced_forecasts_service_optimized" on "public"."enhanced_forecasts";

drop policy "fav_cud_optimized" on "public"."favorite_beaches";

drop policy "intel_confirmations_cud_optimized" on "public"."intel_post_confirmations";

drop policy "intel_posts_cud_optimized" on "public"."intel_posts";

drop policy "session_forecast_snapshots_optimized" on "public"."session_forecast_snapshots";

drop policy "session_invitations_delete_optimized" on "public"."session_invitations";

drop policy "session_invitations_insert_optimized" on "public"."session_invitations";

drop policy "session_invitations_select_optimized" on "public"."session_invitations";

drop policy "session_invitations_update_optimized" on "public"."session_invitations";

drop policy "session_likes_delete_optimized" on "public"."session_likes";

drop policy "session_likes_insert_optimized" on "public"."session_likes";

drop policy "sessions_delete_optimized" on "public"."sessions";

drop policy "sessions_insert_optimized" on "public"."sessions";

drop policy "sessions_update_optimized" on "public"."sessions";

drop policy "spot_feedback_optimized" on "public"."spot_feedback";

drop policy "user_activities_optimized" on "public"."user_activities";

drop policy "user_follows_delete_optimized" on "public"."user_follows";

drop policy "user_follows_insert_optimized" on "public"."user_follows";

revoke delete on table "public"."beach_calibration" from "anon";

revoke insert on table "public"."beach_calibration" from "anon";

revoke references on table "public"."beach_calibration" from "anon";

revoke select on table "public"."beach_calibration" from "anon";

revoke trigger on table "public"."beach_calibration" from "anon";

revoke truncate on table "public"."beach_calibration" from "anon";

revoke update on table "public"."beach_calibration" from "anon";

revoke delete on table "public"."beach_calibration" from "authenticated";

revoke insert on table "public"."beach_calibration" from "authenticated";

revoke references on table "public"."beach_calibration" from "authenticated";

revoke select on table "public"."beach_calibration" from "authenticated";

revoke trigger on table "public"."beach_calibration" from "authenticated";

revoke truncate on table "public"."beach_calibration" from "authenticated";

revoke update on table "public"."beach_calibration" from "authenticated";

revoke delete on table "public"."beach_calibration" from "service_role";

revoke insert on table "public"."beach_calibration" from "service_role";

revoke references on table "public"."beach_calibration" from "service_role";

revoke select on table "public"."beach_calibration" from "service_role";

revoke trigger on table "public"."beach_calibration" from "service_role";

revoke truncate on table "public"."beach_calibration" from "service_role";

revoke update on table "public"."beach_calibration" from "service_role";

alter table "public"."beach_calibration" drop constraint "beach_calibration_beach_id_fkey";

alter table "public"."beaches" drop constraint "chk_beaches_lat_range";

alter table "public"."beaches" drop constraint "chk_beaches_lon_range";

drop function if exists "public"."_norm_deg"(degrees numeric);

drop function if exists "public"."add_session_owner_as_participant"();

drop function if exists "public"."boards_touch_updated_at"();

drop function if exists "public"."cardinal_to_deg"(cardinal_dir text);

drop function if exists "public"."check_foreign_key_indexes"();

drop function if exists "public"."cleanup_old_activities"(days_to_keep integer);

drop function if exists "public"."cleanup_old_enhanced_forecasts"(days_to_keep integer);

drop function if exists "public"."cleanup_stale_enhanced_forecasts"();

drop function if exists "public"."consolidate_buoy_conditions"();

drop function if exists "public"."create_beach_review_activity"();

drop function if exists "public"."create_follow_activity"();

drop function if exists "public"."create_session_forecast_snapshot"(session_uuid uuid);

drop function if exists "public"."decrement"(val integer, amount integer);

drop function if exists "public"."direction_to_compass"(degrees double precision, precision_level text);

drop function if exists "public"."extract_numeric"(input_text text);

drop function if exists "public"."first_number"(input_text text);

drop function if exists "public"."format_coordinates"(latitude double precision, longitude double precision, precision_digits integer);

drop function if exists "public"."get_beach_hourly_scores_secure"(p_beach uuid, p_start timestamp with time zone, p_end timestamp with time zone);

drop function if exists "public"."get_beach_review_stats"(beach_uuid uuid);

drop function if exists "public"."get_beach_reviews"(beach_uuid uuid, limit_count integer);

drop function if exists "public"."get_best_times_secure"(p_beach uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_limit integer);

drop function if exists "public"."get_coach_picks"(user_lat double precision, user_lng double precision, radius_km double precision, max_results integer);

drop function if exists "public"."get_forecast_accuracy_stats"(beach_uuid uuid);

drop function if exists "public"."get_intel_confirmations"(intel_post_uuid uuid);

drop function if exists "public"."get_most_visited_beach"();

drop function if exists "public"."get_nearby_intel_posts"(center_lat double precision, center_lng double precision, radius_meters integer, limit_count integer);

drop function if exists "public"."get_overall_quality_score"(beach_uuid uuid);

drop function if exists "public"."get_recent_check_ins"(beach_uuid uuid, limit_count integer);

drop function if exists "public"."get_user_activity_feed"(p_user_id uuid, p_limit integer, p_offset integer);

drop function if exists "public"."handle_invitation_acceptance"();

drop function if exists "public"."increment"(val integer, amount integer);

drop function if exists "public"."set_beach_coordinates"();

drop function if exists "public"."update_beach_forecast_accuracy"();

drop function if exists "public"."update_beach_name"(beach_uuid uuid, new_name text);

drop function if exists "public"."update_check_ins_updated_at"();

drop function if exists "public"."update_intel_posts_updated_at"();

drop function if exists "public"."update_user_storage_usage"();

drop function if exists "public"."validate_raw_forecast_structure"(forecast_json jsonb);

drop function if exists "public"."get_best_times"(p_beach uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_limit integer);

drop function if exists "public"."get_nearest_buoy_with_conditions"(target_lat double precision, target_lng double precision, max_distance_m integer);

drop materialized view if exists "public"."mv_best_times";

drop view if exists "public"."profiles_with_home_beach";

drop view if exists "public"."v_beach_hourly_scores";

alter table "public"."beach_calibration" drop constraint "beach_calibration_pkey";

drop index if exists "public"."beach_calibration_pkey";

drop index if exists "public"."beaches_geog_gist";

drop index if exists "public"."beaches_slug_unique";

drop index if exists "public"."idx_beach_calibration_beach_id";

drop index if exists "public"."idx_beaches_alt_names_trgm";

drop index if exists "public"."idx_beaches_coordinates_gist";

drop index if exists "public"."idx_beaches_lat_lon";

drop index if exists "public"."idx_beaches_location_active";

drop index if exists "public"."idx_beaches_name_trgm";

drop index if exists "public"."idx_beaches_slug_trgm";

drop index if exists "public"."idx_beaches_active_with_coords";

drop index if exists "public"."idx_beaches_id_active";

drop index if exists "public"."idx_beaches_list_covering";

drop index if exists "public"."idx_beaches_location";

drop index if exists "public"."idx_beaches_name_with_coords";

drop index if exists "public"."idx_beaches_public";

drop table "public"."beach_calibration";


  create table "public"."session_shares" (
    "id" uuid not null default gen_random_uuid(),
    "session_id" uuid not null,
    "user_id" uuid not null,
    "platform" text not null,
    "share_url" text,
    "variant" text default 'story'::text,
    "created_at" timestamp with time zone not null default now(),
    "share_date" date not null default CURRENT_DATE
      );


alter table "public"."session_shares" enable row level security;

-- Column changes moved to 20251031022000_fix_coordinate_migration.sql
-- to properly handle geog column dependency

alter table "public"."sessions" add column "share_count" integer not null default 0;

-- Beach indexes moved to 20251031022000_fix_coordinate_migration.sql

CREATE INDEX idx_session_shares_created_at ON public.session_shares USING btree (created_at DESC);

CREATE INDEX idx_session_shares_platform ON public.session_shares USING btree (platform);

CREATE INDEX idx_session_shares_session_id ON public.session_shares USING btree (session_id);

CREATE INDEX idx_session_shares_user_id ON public.session_shares USING btree (user_id);

CREATE INDEX idx_sessions_share_count ON public.sessions USING btree (share_count DESC) WHERE (share_count > 0);

CREATE UNIQUE INDEX idx_unique_daily_share ON public.session_shares USING btree (session_id, user_id, platform, share_date);

CREATE UNIQUE INDEX session_shares_pkey ON public.session_shares USING btree (id);

alter table "public"."session_shares" add constraint "session_shares_pkey" PRIMARY KEY using index "session_shares_pkey";

alter table "public"."session_shares" add constraint "session_shares_platform_check" CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'twitter'::text, 'facebook'::text, 'copy'::text, 'native'::text, 'other'::text]))) not valid;

alter table "public"."session_shares" validate constraint "session_shares_platform_check";

alter table "public"."session_shares" add constraint "session_shares_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE not valid;

alter table "public"."session_shares" validate constraint "session_shares_session_id_fkey";

alter table "public"."session_shares" add constraint "session_shares_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."session_shares" validate constraint "session_shares_user_id_fkey";

alter table "public"."session_shares" add constraint "session_shares_variant_check" CHECK ((variant = ANY (ARRAY['story'::text, 'square'::text]))) not valid;

alter table "public"."session_shares" validate constraint "session_shares_variant_check";

-- Beach constraints moved to 20251031022000_fix_coordinate_migration.sql

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cleanup_stale_enhanced_forecasts(retention_days integer DEFAULT 14)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.decrement_session_share_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  UPDATE sessions
  SET share_count = GREATEST(0, share_count - 1)
  WHERE id = OLD.session_id;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_beach_review_stats(target_beach_id uuid)
 RETURNS TABLE(beach_id uuid, total_reviews integer, average_overall_rating numeric, average_wave_quality numeric, average_crowd_density numeric, average_parking numeric, average_accessibility numeric, rating_distribution jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_beach_reviews(target_beach_id uuid, offset_count integer DEFAULT 0, limit_count integer DEFAULT 10, min_rating integer DEFAULT 1)
 RETURNS TABLE(id uuid, beach_id uuid, user_id uuid, overall_rating integer, wave_quality_rating integer, crowd_density_rating integer, parking_rating integer, accessibility_rating integer, title character varying, content text, visit_date date, helpful_count integer, created_at timestamp with time zone, updated_at timestamp with time zone, user_name text, beach_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_coach_picks(_beach_id uuid, _radius_km numeric DEFAULT 80)
 RETURNS TABLE(pick_rank integer, beach_id uuid, name text, distance_km numeric, score integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
with origin as (
  select id, name, lat, lon
  from beaches where id = _beach_id
),
candidates as (
  select b.id, b.name, b.lat, b.lon,
         -- Haversine distance (km)
         6371 * 2 * asin(sqrt(
           pow(sin(radians(b.lat - o.lat)/2),2) +
           cos(radians(o.lat))*cos(radians(b.lat))*
           pow(sin(radians(b.lon - o.lon)/2),2)
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_intel_confirmations(target_post_id uuid)
 RETURNS TABLE(id uuid, intel_post_id uuid, user_id uuid, user_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_session_share_stats(p_session_id uuid)
 RETURNS TABLE(total_shares bigint, instagram_shares bigint, tiktok_shares bigint, twitter_shares bigint, facebook_shares bigint, copy_shares bigint, unique_sharers bigint, last_shared_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_shares,
    COUNT(*) FILTER (WHERE platform = 'instagram')::bigint AS instagram_shares,
    COUNT(*) FILTER (WHERE platform = 'tiktok')::bigint AS tiktok_shares,
    COUNT(*) FILTER (WHERE platform = 'twitter')::bigint AS twitter_shares,
    COUNT(*) FILTER (WHERE platform = 'facebook')::bigint AS facebook_shares,
    COUNT(*) FILTER (WHERE platform = 'copy')::bigint AS copy_shares,
    COUNT(DISTINCT user_id)::bigint AS unique_sharers,
    MAX(created_at) AS last_shared_at
  FROM session_shares
  WHERE session_id = p_session_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_viral_coefficient(p_user_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  total_sessions bigint;
  total_shares bigint;
  viral_coefficient numeric;
BEGIN
  -- Count user's public sessions
  SELECT COUNT(*)
  INTO total_sessions
  FROM sessions
  WHERE user_id = p_user_id
  AND status = 'completed'
  AND is_public = true;

  -- Return 0 if no sessions
  IF total_sessions = 0 THEN
    RETURN 0;
  END IF;

  -- Count total shares of user's sessions
  SELECT COUNT(*)
  INTO total_shares
  FROM session_shares ss
  INNER JOIN sessions s ON s.id = ss.session_id
  WHERE s.user_id = p_user_id;

  -- Calculate coefficient
  viral_coefficient := total_shares::numeric / total_sessions::numeric;

  RETURN ROUND(viral_coefficient, 2);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_session_share_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  UPDATE sessions
  SET share_count = share_count + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_database_health()
 RETURNS TABLE(table_name text, row_count bigint, table_size text, last_analyzed timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_activity(p_user_id uuid, p_activity_type character varying, p_entity_type character varying, p_entity_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  activity_id uuid;
begin
  insert into public.user_activities (user_id, activity_type, entity_type, entity_id, metadata)
  values (p_user_id, p_activity_type, p_entity_type, p_entity_id, p_metadata)
  returning id into activity_id;
  
  return activity_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_best_times(p_beach uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_limit integer DEFAULT 6)
 RETURNS TABLE(start_ts timestamp with time zone, end_ts timestamp with time zone, label text, score integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_nearby_buoys(target_lat double precision, target_lng double precision, max_distance_m integer DEFAULT 100000, result_limit integer DEFAULT 4)
 RETURNS TABLE(buoy_uuid text, buoy_name text, active boolean, coordinates public.geometry, water_temperature numeric, air_temperature numeric, wave_height numeric, wave_period numeric, wind_speed numeric, wind_gust numeric, wind_direction numeric, tides jsonb, updated_at timestamp with time zone, distance_meters double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_nearby_intel_posts(center_lat double precision, center_lng double precision, limit_count integer DEFAULT 20, radius_miles double precision DEFAULT 25.0, tag_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, user_id uuid, beach_id uuid, latitude numeric, longitude numeric, tag public.intel_post_tag, title text, description text, photo_url text, confirmations_count integer, is_active boolean, surf_conditions jsonb, expires_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, distance_miles double precision, user_name text, beach_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
     ) / 1609.34) AS distance_miles,
    p.full_name AS user_name,
    COALESCE(b.name, 'Unknown Beach') AS beach_name
  FROM public.intel_posts ip
  LEFT JOIN public.profiles p ON p.id = ip.user_id
  LEFT JOIN public.beaches  b ON b.id = ip.beach_id
  WHERE ip.is_active = true
    AND (ip.expires_at IS NULL OR ip.expires_at > NOW())
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(ip.longitude, ip.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_miles * 1609.34
    )
    AND (tag_filter IS NULL OR ip.tag::text = tag_filter)
  ORDER BY
    ip.created_at DESC,            -- recency first
    ip.confirmations_count DESC
  LIMIT limit_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_nearest_buoy_with_conditions(target_lat double precision, target_lng double precision, max_distance_m integer DEFAULT 100000)
 RETURNS TABLE(buoy_uuid text, buoy_name text, active boolean, coordinates public.geometry, water_temperature numeric, air_temperature numeric, wave_height numeric, wave_period numeric, wind_speed numeric, wind_gust numeric, wind_direction numeric, tides jsonb, updated_at timestamp with time zone, distance_meters double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.nightly_forecast_maintenance()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

-- Drop functions that are being recreated with different signatures
DROP FUNCTION IF EXISTS public.refresh_enhanced_forecasts_for_active_beaches();

create or replace view "public"."profiles_with_home_beach" as  SELECT p.id,
    p.full_name,
    p.created_at,
    p.email_session_invites,
    p.inapp_session_invites,
    p.digest_session_invites,
    p.favorite_spot,
    p.favorite_spot_id,
    p.followers_count,
    p.following_count,
    p.is_mock,
    p.avatar_url,
    p.email,
    p.phone_number,
    p.bio,
    p.location,
    p.experience_level,
    p.instagram,
    p.updated_at,
    p.home_beach_id,
    b.name AS home_beach_name
   FROM (public.profiles p
     LEFT JOIN public.beaches b ON ((b.id = p.home_beach_id)));


CREATE OR REPLACE FUNCTION public.refresh_enhanced_forecasts_for_active_beaches()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
        SELECT DISTINCT b.id, b.name, b.lat, b.lon
        FROM public.beaches b
        WHERE b.lat IS NOT NULL
          AND b.lon IS NOT NULL
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
                beach_rec.name, beach_rec.lat, beach_rec.lon;
            
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_mv_beach_hourly_scores()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_mv_beach_hourly_scores_and_analyze()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_mv_best_times()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_best_times;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.run_database_maintenance(cleanup_forecasts boolean DEFAULT true, cleanup_buoys boolean DEFAULT true, update_stats boolean DEFAULT true, forecast_retention_days integer DEFAULT 30, buoy_inactive_days integer DEFAULT 7)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_manual_maintenance()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_follow_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_intel_confirmations_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_review_helpful_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_session_comments_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_session_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

create or replace view "public"."v_beach_hourly_scores" as  SELECT m.beach_id,
    (m.ts AT TIME ZONE 'UTC'::text) AS ts_utc,
    abs((mod((((m.wind_direction_deg - (b.wind_offshore_deg)::numeric) + (540)::numeric))::integer, 360) - 180)) AS wind_off_by_deg,
    GREATEST((0)::double precision, ((((1)::double precision + cos(radians((abs((mod((((m.wind_direction_deg - (b.wind_offshore_deg)::numeric) + (540)::numeric))::integer, 360) - 180)))::double precision))) / (2)::double precision) * ((1)::double precision - ((GREATEST((0)::numeric, ((m.wind_speed_ms * 1.94384449) - (b.wind_cross_shore_ok_kt)::numeric)))::double precision / (10.0)::double precision)))) AS wind_score,
    COALESCE(GREATEST((0)::numeric, ((1)::numeric - (abs(((t_near.tide_height_m * 3.28084) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max) / 2.0))) / NULLIF(((b.preferred_tide_ft_max - b.preferred_tide_ft_min) / 2.0), (0)::numeric)))), (0)::numeric) AS tide_score,
    ( WITH params AS (
                 SELECT (((b.swell_window_max_deg - b.swell_window_min_deg) + 360) % 360) AS span,
                    b.swell_window_min_deg AS min_deg
                )
         SELECT GREATEST((0)::double precision, ((1)::double precision - ((GREATEST((0)::numeric, ((abs((mod((((m.wave_direction_deg - ((params.min_deg)::numeric + ((params.span)::numeric / 2.0))) + (540)::numeric))::integer, 360) - 180)))::numeric - ((params.span)::numeric / 2.0))))::double precision / (30.0)::double precision))) AS "greatest"
           FROM params) AS swell_dir_score,
    0.0 AS period_score,
    0.0 AS height_score,
    (round((((100)::double precision * GREATEST((0)::double precision, ((((0.4)::double precision * GREATEST((0)::double precision, ((((1)::double precision + cos(radians((abs((mod((((m.wind_direction_deg - (b.wind_offshore_deg)::numeric) + (540)::numeric))::integer, 360) - 180)))::double precision))) / (2)::double precision) * ((1)::double precision - ((GREATEST((0)::numeric, ((m.wind_speed_ms * 1.94384449) - (b.wind_cross_shore_ok_kt)::numeric)))::double precision / (10.0)::double precision))))) + ((0.2 * COALESCE(GREATEST((0)::numeric, ((1)::numeric - (abs(((t_near.tide_height_m * 3.28084) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max) / 2.0))) / NULLIF(((b.preferred_tide_ft_max - b.preferred_tide_ft_min) / 2.0), (0)::numeric)))), (0)::numeric)))::double precision) + ((0.4)::double precision * ( WITH params AS (
                 SELECT (((b.swell_window_max_deg - b.swell_window_min_deg) + 360) % 360) AS span,
                    b.swell_window_min_deg AS min_deg
                )
         SELECT GREATEST((0)::double precision, ((1)::double precision - ((GREATEST((0)::numeric, ((abs((mod((((m.wave_direction_deg - ((params.min_deg)::numeric + ((params.span)::numeric / 2.0))) + (540)::numeric))::integer, 360) - 180)))::numeric - ((params.span)::numeric / 2.0))))::double precision / (30.0)::double precision))) AS "greatest"
           FROM params))))) * (1)::double precision)))::integer AS score_0_100
   FROM ((public.marine_forecasts m
     JOIN public.beaches b ON ((b.id = m.beach_id)))
     LEFT JOIN LATERAL ( SELECT t.ts,
            t.tide_height_m
           FROM public.tide_forecasts t
          WHERE ((t.beach_id = m.beach_id) AND ((t.ts >= (m.ts - '01:30:00'::interval)) AND (t.ts <= (m.ts + '01:30:00'::interval))))
          ORDER BY (abs(EXTRACT(epoch FROM (t.ts - m.ts))))
         LIMIT 1) t_near ON (true));


create materialized view "public"."mv_best_times" as  WITH hrs AS (
         SELECT v_beach_hourly_scores.beach_id,
            v_beach_hourly_scores.ts_utc,
            v_beach_hourly_scores.score_0_100
           FROM public.v_beach_hourly_scores
          WHERE ((v_beach_hourly_scores.ts_utc >= now()) AND (v_beach_hourly_scores.ts_utc < (now() + '72:00:00'::interval)))
        ), win AS (
         SELECT h1.beach_id,
            h1.ts_utc AS start_ts,
            (h1.ts_utc + '02:00:00'::interval) AS end_ts,
            (round(avg(h2.score_0_100)))::integer AS score
           FROM (hrs h1
             JOIN hrs h2 ON (((h2.beach_id = h1.beach_id) AND ((h2.ts_utc >= h1.ts_utc) AND (h2.ts_utc <= (h1.ts_utc + '01:00:00'::interval))))))
          GROUP BY h1.beach_id, h1.ts_utc
        ), ranked AS (
         SELECT w.beach_id,
            w.start_ts,
            w.end_ts,
            w.score,
                CASE
                    WHEN (w.score >= 85) THEN 'epic'::text
                    WHEN (w.score >= 70) THEN 'good'::text
                    WHEN (w.score >= 55) THEN 'fair'::text
                    ELSE 'poor'::text
                END AS grade
           FROM win w
        )
 SELECT ranked.beach_id,
    ranked.start_ts,
    ranked.end_ts,
    ranked.grade,
    ranked.score,
    now() AS updated_at
   FROM ranked;


grant delete on table "public"."session_shares" to "anon";

grant insert on table "public"."session_shares" to "anon";

grant references on table "public"."session_shares" to "anon";

grant select on table "public"."session_shares" to "anon";

grant trigger on table "public"."session_shares" to "anon";

grant truncate on table "public"."session_shares" to "anon";

grant update on table "public"."session_shares" to "anon";

grant delete on table "public"."session_shares" to "authenticated";

grant insert on table "public"."session_shares" to "authenticated";

grant references on table "public"."session_shares" to "authenticated";

grant select on table "public"."session_shares" to "authenticated";

grant trigger on table "public"."session_shares" to "authenticated";

grant truncate on table "public"."session_shares" to "authenticated";

grant update on table "public"."session_shares" to "authenticated";

grant delete on table "public"."session_shares" to "service_role";

grant insert on table "public"."session_shares" to "service_role";

grant references on table "public"."session_shares" to "service_role";

grant select on table "public"."session_shares" to "service_role";

grant trigger on table "public"."session_shares" to "service_role";

grant truncate on table "public"."session_shares" to "service_role";

grant update on table "public"."session_shares" to "service_role";


  create policy "Intel confirmations are readable"
  on "public"."intel_post_confirmations"
  as permissive
  for select
  to public
using (true);



  create policy "Intel posts are publicly readable"
  on "public"."intel_posts"
  as permissive
  for select
  to public
using (true);



  create policy "Users can create shares for sessions they can view"
  on "public"."session_shares"
  as permissive
  for insert
  to public
with check (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.sessions
  WHERE ((sessions.id = session_shares.session_id) AND ((sessions.is_public = true) OR (sessions.user_id = auth.uid())))))));



  create policy "Users can delete their own shares"
  on "public"."session_shares"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "Users can view shares for public sessions or own sessions"
  on "public"."session_shares"
  as permissive
  for select
  to public
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.sessions
  WHERE ((sessions.id = session_shares.session_id) AND (sessions.is_public = true)))) OR (EXISTS ( SELECT 1
   FROM public.sessions
  WHERE ((sessions.id = session_shares.session_id) AND (sessions.user_id = auth.uid()))))));


CREATE TRIGGER beach_review_likes_count_trigger AFTER INSERT OR DELETE ON public.beach_review_likes FOR EACH ROW EXECUTE FUNCTION public.update_review_helpful_count();

CREATE TRIGGER trigger_update_session_comments_count AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_session_comments_count();

CREATE TRIGGER intel_post_confirmations_count_trigger AFTER INSERT OR DELETE ON public.intel_post_confirmations FOR EACH ROW EXECUTE FUNCTION public.update_intel_confirmations_count();

CREATE TRIGGER trigger_update_session_likes_count AFTER INSERT OR DELETE ON public.session_likes FOR EACH ROW EXECUTE FUNCTION public.update_session_likes_count();

CREATE TRIGGER trigger_decrement_share_count AFTER DELETE ON public.session_shares FOR EACH ROW EXECUTE FUNCTION public.decrement_session_share_count();

CREATE TRIGGER trigger_increment_share_count AFTER INSERT ON public.session_shares FOR EACH ROW EXECUTE FUNCTION public.increment_session_share_count();

CREATE TRIGGER trigger_create_session_forecast_snapshot AFTER INSERT OR UPDATE OF status ON public.sessions FOR EACH ROW WHEN ((new.status = 'completed'::text)) EXECUTE FUNCTION public.create_session_forecast_snapshot();

CREATE TRIGGER update_follow_counts_trigger AFTER INSERT OR DELETE ON public.user_follows FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();


