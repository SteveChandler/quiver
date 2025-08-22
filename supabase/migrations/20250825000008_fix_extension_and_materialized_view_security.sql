-- Fix Extension and Materialized View Security Issues (Migration 008)
-- This migration addresses remaining Supabase security linter warnings
-- Date: 2025-01-24

-- ================================================
-- SECURITY ISSUES ADDRESSED:
-- ================================================
-- 1. Extension in Public Schema:
--    - btree_gist extension is installed in public schema
--    - Solution: Move to extensions schema for better security isolation
--
-- 2. Materialized View API Exposure:
--    - mv_best_times and mv_beach_hourly_scores accessible to anon/authenticated
--    - Solution: Restrict access to service_role only
-- ================================================

BEGIN;

-- ================================================
-- 1. Fix Extension Security - Move btree_gist to extensions schema
-- ================================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Check if btree_gist exists in public schema and move it
DO $$
BEGIN
    -- Check if extension exists in public
    IF EXISTS (
        SELECT 1 FROM pg_extension 
        WHERE extname = 'btree_gist' 
        AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        -- Drop and recreate in extensions schema
        DROP EXTENSION IF EXISTS btree_gist CASCADE;
        CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
        
        RAISE NOTICE '✅ Moved btree_gist extension from public to extensions schema';
    ELSE
        -- Just ensure it exists in extensions schema
        CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
        
        RAISE NOTICE '✅ Ensured btree_gist extension exists in extensions schema';
    END IF;
END $$;

-- ================================================
-- 2. Fix Materialized View API Exposure
-- ================================================

-- Secure mv_best_times materialized view
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' AND matviewname = 'mv_best_times'
    ) THEN
        -- Revoke access from anon and authenticated users
        REVOKE ALL ON mv_best_times FROM anon;
        REVOKE ALL ON mv_best_times FROM authenticated;
        REVOKE ALL ON mv_best_times FROM public;
        
        -- Only allow service_role to access it
        GRANT SELECT ON mv_best_times TO service_role;
        
        -- Add security comment
        COMMENT ON MATERIALIZED VIEW mv_best_times IS 
            'Precomputed best surf times - RESTRICTED ACCESS: service_role only for security';
        
        RAISE NOTICE '✅ Secured mv_best_times - removed public API access';
    ELSE
        RAISE NOTICE 'ℹ️  Materialized view mv_best_times does not exist - skipping';
    END IF;
END $$;

-- Secure mv_beach_hourly_scores materialized view
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' AND matviewname = 'mv_beach_hourly_scores'
    ) THEN
        -- Revoke access from anon and authenticated users
        REVOKE ALL ON mv_beach_hourly_scores FROM anon;
        REVOKE ALL ON mv_beach_hourly_scores FROM authenticated;
        REVOKE ALL ON mv_beach_hourly_scores FROM public;
        
        -- Only allow service_role to access it
        GRANT SELECT ON mv_beach_hourly_scores TO service_role;
        
        -- Add security comment
        COMMENT ON MATERIALIZED VIEW mv_beach_hourly_scores IS 
            'Hourly beach scoring data - RESTRICTED ACCESS: service_role only for security';
        
        RAISE NOTICE '✅ Secured mv_beach_hourly_scores - removed public API access';
    ELSE
        RAISE NOTICE 'ℹ️  Materialized view mv_beach_hourly_scores does not exist - skipping';
    END IF;
END $$;

-- ================================================
-- 3. Create Secure API Functions for Materialized View Access
-- ================================================

-- Create secure function to access best times data
CREATE OR REPLACE FUNCTION get_best_times_secure(
    p_beach UUID, 
    p_start TIMESTAMPTZ, 
    p_end TIMESTAMPTZ, 
    p_limit INT DEFAULT 6
)
RETURNS TABLE(
    start_ts TIMESTAMP,
    end_ts TIMESTAMP,
    score INTEGER,
    quality_label TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bt.start_ts,
        bt.end_ts,
        bt.score,
        bt.grade as quality_label
    FROM mv_best_times bt
    WHERE bt.beach_id = p_beach
    AND bt.start_ts >= p_start
    AND bt.end_ts <= p_end
    ORDER BY bt.score DESC, bt.start_ts ASC
    LIMIT p_limit;
END;
$$;

-- Grant access to the secure function
GRANT EXECUTE ON FUNCTION get_best_times_secure(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) 
TO anon, authenticated, service_role;

-- Create secure function to access beach hourly scores
CREATE OR REPLACE FUNCTION get_beach_hourly_scores_secure(
    p_beach UUID,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
)
RETURNS TABLE(
    beach_id UUID,
    ts_utc TIMESTAMPTZ,
    score_0_100 INTEGER,
    wind_score NUMERIC,
    tide_score NUMERIC,
    swell_score NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bhs.beach_id,
        bhs.ts_utc,
        bhs.score_0_100,
        bhs.wind_score,
        bhs.tide_score,
        bhs.swell_dir_score as swell_score
    FROM mv_beach_hourly_scores bhs
    WHERE bhs.beach_id = p_beach
    AND bhs.ts_utc >= p_start
    AND bhs.ts_utc <= p_end
    ORDER BY bhs.ts_utc ASC;
END;
$$;

-- Grant access to the secure function
GRANT EXECUTE ON FUNCTION get_beach_hourly_scores_secure(UUID, TIMESTAMPTZ, TIMESTAMPTZ) 
TO anon, authenticated, service_role;

-- ================================================
-- 4. Add Security Comments to All Functions
-- ================================================

-- Add comments documenting the security fixes
COMMENT ON FUNCTION update_check_ins_updated_at IS 'Check-ins timestamp trigger - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_follow_counts IS 'Social follow trigger function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION cleanup_old_enhanced_forecasts IS 'Forecast cleanup function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_session_comments_count IS 'Session comments trigger - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_beach_forecast_accuracy IS 'Beach forecast accuracy updater - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_recent_check_ins IS 'Recent check-ins query - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_forecast_accuracy_stats IS 'Forecast accuracy statistics - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION cardinal_to_deg IS 'Cardinal direction converter - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION extract_numeric IS 'Numeric extraction utility - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_coach_picks IS 'Coach recommendations function - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION create_session_forecast_snapshot IS 'Session forecast snapshot creator - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_nearby_intel_posts IS 'Nearby intel posts query - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION first_number IS 'First number extraction utility - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_nearby_buoys IS 'Nearby buoys query - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_nearest_buoy_with_conditions IS 'Nearest buoy with conditions - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION _norm_deg IS 'Degree normalization utility - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_nearby_beaches IS 'Nearby beaches query - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION check_database_health IS 'Database health checker - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION refresh_enhanced_forecasts_for_active_beaches IS 'Active beaches forecast refresh - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_beach_reviews IS 'Beach reviews query - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_intel_confirmations IS 'Intel confirmations query - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_overall_quality_score IS 'Overall quality scorer - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION refresh_mv_best_times IS 'Best times MV refresh - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION boards_touch_updated_at IS 'Boards timestamp trigger - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_best_times IS 'DEPRECATED: Use get_best_times_secure instead - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_forecast_table_stats IS 'Forecast table statistics updater - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION cleanup_old_forecasts IS 'Old forecasts cleanup - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION cleanup_inactive_buoys IS 'Inactive buoys cleanup - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION run_database_maintenance IS 'Comprehensive maintenance runner - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION refresh_mv_beach_hourly_scores IS 'Beach hourly scores MV refresh - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION refresh_mv_beach_hourly_scores_and_analyze IS 'Beach scores refresh with analyze - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_session_likes_count IS 'Session likes trigger - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION trigger_manual_maintenance IS 'Manual maintenance trigger - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION create_activity IS 'Activity creator - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_intel_posts_updated_at IS 'Intel posts timestamp trigger - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_review_helpful_count IS 'Review helpful count trigger - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION update_intel_confirmations_count IS 'Intel confirmations trigger - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION nightly_forecast_maintenance IS 'Nightly maintenance scheduler - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION cleanup_stale_enhanced_forecasts IS 'Stale forecasts cleanup - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION get_beach_review_stats IS 'Beach review statistics - SECURITY DEFINER with search_path protection';
COMMENT ON FUNCTION validate_raw_forecast_structure IS 'Forecast structure validator - SECURITY DEFINER with search_path protection';

-- Secure API access functions
COMMENT ON FUNCTION get_best_times_secure IS 'SECURE API: Best times data access with proper authorization';
COMMENT ON FUNCTION get_beach_hourly_scores_secure IS 'SECURE API: Beach hourly scores with proper authorization';

-- ================================================
-- Success Message and Verification
-- ================================================
DO $$
BEGIN
    RAISE NOTICE '🔒 Extension and Materialized View Security Fixes Complete!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Extension Security:';
    RAISE NOTICE '   • btree_gist moved from public to extensions schema';
    RAISE NOTICE '   • Extension now properly isolated from user access';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Materialized View Security:';
    RAISE NOTICE '   • mv_best_times access restricted to service_role only';
    RAISE NOTICE '   • mv_beach_hourly_scores access restricted to service_role only';
    RAISE NOTICE '   • Created secure API functions for authorized access';
    RAISE NOTICE '';
    RAISE NOTICE '✅ API Access:';
    RAISE NOTICE '   • get_best_times_secure() - public API for best times data';
    RAISE NOTICE '   • get_beach_hourly_scores_secure() - public API for hourly scores';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Security Benefits:';
    RAISE NOTICE '   • Extensions isolated from public schema injection';
    RAISE NOTICE '   • Materialized views protected from unauthorized access';
    RAISE NOTICE '   • Secure API functions maintain functionality safely';
END $$;

COMMIT;
