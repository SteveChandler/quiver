-- Fix Function Search Path Mutable warnings
-- Add fixed search_path to all database functions to prevent search path injection attacks
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- This migration sets search_path = public, pg_catalog for all custom functions
-- to protect against search path injection vulnerabilities

-- The DO block allows us to conditionally ALTER functions only if they exist
-- This makes the migration more robust across different database states

DO $$ 
BEGIN
    -- Database Health & Maintenance Functions
    PERFORM 1 FROM pg_proc WHERE proname = 'check_database_health' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.check_database_health() SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'cleanup_inactive_buoys' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.cleanup_inactive_buoys(inactive_days integer) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'cleanup_old_forecasts' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.cleanup_old_forecasts(retention_days integer) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'cleanup_stale_enhanced_forecasts' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.cleanup_stale_enhanced_forecasts(retention_days integer) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'run_database_maintenance' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.run_database_maintenance(cleanup_forecasts boolean, cleanup_buoys boolean, update_stats boolean, forecast_retention_days integer, buoy_inactive_days integer) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'trigger_manual_maintenance' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.trigger_manual_maintenance() SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'nightly_forecast_maintenance' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.nightly_forecast_maintenance() SET search_path = public, pg_catalog;
    END IF;

    -- Activity & Social Functions
    PERFORM 1 FROM pg_proc WHERE proname = 'create_activity' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.create_activity(p_user_id uuid, p_activity_type character varying, p_entity_type character varying, p_entity_id uuid, p_metadata jsonb) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'update_follow_counts' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.update_follow_counts() SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'update_session_comments_count' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.update_session_comments_count() SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'update_session_likes_count' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.update_session_likes_count() SET search_path = public, pg_catalog;
    END IF;

    -- Beach & Location Functions
    PERFORM 1 FROM pg_proc WHERE proname = 'get_beach_review_stats' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.get_beach_review_stats(target_beach_id uuid) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'get_beach_reviews' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.get_beach_reviews(target_beach_id uuid, offset_count integer, limit_count integer, min_rating integer) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'get_beaches_near' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.get_beaches_near(_lat double precision, _lon double precision, _radius_km double precision) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'update_beach_coordinates' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.update_beach_coordinates(p_beach_id uuid, p_longitude double precision, p_latitude double precision) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'update_review_helpful_count' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.update_review_helpful_count() SET search_path = public, pg_catalog;
    END IF;

    -- Forecast Functions
    PERFORM 1 FROM pg_proc WHERE proname = 'get_best_times' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.get_best_times(p_beach uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_limit integer) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'get_coach_picks' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.get_coach_picks(_beach_id uuid, _radius_km numeric) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'create_session_forecast_snapshot' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.create_session_forecast_snapshot() SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'refresh_enhanced_forecasts_for_active_beaches' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.refresh_enhanced_forecasts_for_active_beaches() SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'update_forecast_table_stats' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.update_forecast_table_stats() SET search_path = public, pg_catalog;
    END IF;

    -- Materialized View Functions
    PERFORM 1 FROM pg_proc WHERE proname = 'refresh_mv_beach_hourly_scores' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.refresh_mv_beach_hourly_scores() SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'refresh_mv_beach_hourly_scores_and_analyze' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.refresh_mv_beach_hourly_scores_and_analyze() SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'refresh_mv_best_times' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.refresh_mv_best_times() SET search_path = public, pg_catalog;
    END IF;

    -- Buoy Functions
    PERFORM 1 FROM pg_proc WHERE proname = 'get_nearby_buoys' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.get_nearby_buoys(target_lat double precision, target_lng double precision, max_distance_m integer, result_limit integer) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'get_nearest_buoy_with_conditions' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.get_nearest_buoy_with_conditions(target_lat double precision, target_lng double precision, max_distance_m integer) SET search_path = public, pg_catalog;
    END IF;

    -- Intel Functions
    PERFORM 1 FROM pg_proc WHERE proname = 'get_nearby_intel_posts' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.get_nearby_intel_posts(center_lat double precision, center_lng double precision, limit_count integer, radius_miles double precision, tag_filter text) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'get_intel_confirmations' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.get_intel_confirmations(target_post_id uuid) SET search_path = public, pg_catalog;
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'update_intel_confirmations_count' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.update_intel_confirmations_count() SET search_path = public, pg_catalog;
    END IF;

    -- Trigger Functions
    PERFORM 1 FROM pg_proc WHERE proname = 'prevent_delete_on_protected' AND pronamespace = 'public'::regnamespace;
    IF FOUND THEN
        ALTER FUNCTION public.prevent_delete_on_protected() SET search_path = public, pg_catalog;
    END IF;

    RAISE NOTICE 'Successfully set search_path for all existing custom functions';
END $$;

-- Notes:
-- - search_path set to 'public, pg_catalog' ensures functions look for objects in these schemas only
-- - This prevents malicious users from creating objects in other schemas to hijack function behavior
-- - Migration is idempotent and handles functions that may not exist in all environments
-- - Functions will continue to work normally but with enhanced security
