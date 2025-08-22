-- Fix Remaining Function Search Path Security Issues (Migration 007)
-- This migration completes the security fixes for all remaining functions
-- Date: 2025-01-24

BEGIN;

-- ================================================
-- Helper: Drop Function Safely
-- ================================================
CREATE OR REPLACE FUNCTION _temp_drop_function_safe(func_name TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = func_name
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            'public', func_record.proname, func_record.args);
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END;
$$;

-- ================================================
-- 19. Fix refresh_enhanced_forecasts_for_active_beaches Function
-- ================================================
SELECT _temp_drop_function_safe('refresh_enhanced_forecasts_for_active_beaches');

CREATE OR REPLACE FUNCTION refresh_enhanced_forecasts_for_active_beaches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Refresh forecasts for beaches with recent activity
    UPDATE enhanced_forecasts ef
    SET updated_at = NOW()
    WHERE ef.beach_id IN (
        SELECT DISTINCT s.beach_id 
        FROM sessions s 
        WHERE s.created_at > NOW() - INTERVAL '7 days'
    )
    AND ef.forecast_date >= CURRENT_DATE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- ================================================
-- 20. Fix get_beach_reviews Function
-- ================================================
SELECT _temp_drop_function_safe('get_beach_reviews');

CREATE OR REPLACE FUNCTION get_beach_reviews(beach_uuid UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    beach_id UUID,
    overall_rating INTEGER,
    wave_rating INTEGER,
    crowd_rating INTEGER,
    amenities_rating INTEGER,
    scenery_rating INTEGER,
    safety_rating INTEGER,
    title TEXT,
    content TEXT,
    helpful_count INTEGER,
    visit_date DATE,
    created_at TIMESTAMPTZ,
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
        br.id,
        br.user_id,
        br.beach_id,
        br.overall_rating,
        br.wave_rating,
        br.crowd_rating,
        br.amenities_rating,
        br.scenery_rating,
        br.safety_rating,
        br.title,
        br.content,
        br.helpful_count,
        br.visit_date,
        br.created_at,
        p.full_name as user_name,
        p.avatar_url as user_avatar
    FROM beach_reviews br
    JOIN profiles p ON br.user_id = p.id
    WHERE br.beach_id = beach_uuid
    ORDER BY br.created_at DESC
    LIMIT limit_count;
END;
$$;

-- ================================================
-- 21. Fix get_intel_confirmations Function
-- ================================================
SELECT _temp_drop_function_safe('get_intel_confirmations');

CREATE OR REPLACE FUNCTION get_intel_confirmations(intel_post_uuid UUID)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    intel_post_id UUID,
    created_at TIMESTAMPTZ,
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
        ic.id,
        ic.user_id,
        ic.intel_post_id,
        ic.created_at,
        p.full_name as user_name,
        p.avatar_url as user_avatar
    FROM intel_post_confirmations ic
    JOIN profiles p ON ic.user_id = p.id
    WHERE ic.intel_post_id = intel_post_uuid
    ORDER BY ic.created_at DESC;
END;
$$;

-- ================================================
-- 22. Fix get_overall_quality_score Function
-- ================================================
SELECT _temp_drop_function_safe('get_overall_quality_score');

CREATE OR REPLACE FUNCTION get_overall_quality_score(beach_uuid UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    quality_score NUMERIC;
BEGIN
    -- Calculate overall quality score based on recent sessions and reviews
    SELECT 
        ROUND(
            (
                COALESCE(AVG(s.wave_quality), 0) * 0.4 +
                COALESCE(AVG(br.overall_rating), 0) * 0.6
            ), 2
        ) INTO quality_score
    FROM beaches b
    LEFT JOIN sessions s ON b.id = s.beach_id 
        AND s.created_at > NOW() - INTERVAL '30 days'
        AND s.wave_quality IS NOT NULL
    LEFT JOIN beach_reviews br ON b.id = br.beach_id
        AND br.created_at > NOW() - INTERVAL '90 days'
    WHERE b.id = beach_uuid;
    
    RETURN COALESCE(quality_score, 0);
END;
$$;

-- ================================================
-- 23. Fix refresh_mv_best_times Function
-- ================================================
SELECT _temp_drop_function_safe('refresh_mv_best_times');

CREATE OR REPLACE FUNCTION refresh_mv_best_times()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_best_times;
END;
$$;

-- ================================================
-- 24. Fix boards_touch_updated_at Function
-- ================================================
SELECT _temp_drop_function_safe('boards_touch_updated_at');

CREATE OR REPLACE FUNCTION boards_touch_updated_at()
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

-- ================================================
-- 25. Fix get_best_times Function
-- ================================================
SELECT _temp_drop_function_safe('get_best_times');

CREATE OR REPLACE FUNCTION get_best_times(
    p_beach UUID, 
    p_start TIMESTAMPTZ, 
    p_end TIMESTAMPTZ, 
    p_limit INT DEFAULT 6
)
RETURNS TABLE(
    start_ts TIMESTAMPTZ,
    end_ts TIMESTAMPTZ,
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
        bt.quality_label
    FROM mv_best_times bt
    WHERE bt.beach_id = p_beach
    AND bt.start_ts >= p_start
    AND bt.end_ts <= p_end
    ORDER BY bt.score DESC, bt.start_ts ASC
    LIMIT p_limit;
END;
$$;

-- ================================================
-- 26. Fix update_forecast_table_stats Function (recreate with search_path)
-- ================================================
SELECT _temp_drop_function_safe('update_forecast_table_stats');

CREATE OR REPLACE FUNCTION update_forecast_table_stats() 
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- ================================================
-- 27. Fix cleanup_old_forecasts Function (recreate with search_path)
-- ================================================
SELECT _temp_drop_function_safe('cleanup_old_forecasts');

CREATE OR REPLACE FUNCTION cleanup_old_forecasts(retention_days INTEGER DEFAULT 30) 
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- ================================================
-- 28. Fix cleanup_inactive_buoys Function (recreate with search_path)
-- ================================================
SELECT _temp_drop_function_safe('cleanup_inactive_buoys');

CREATE OR REPLACE FUNCTION cleanup_inactive_buoys(inactive_days INTEGER DEFAULT 7) 
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- ================================================
-- 29. Fix run_database_maintenance Function (recreate with search_path)
-- ================================================
SELECT _temp_drop_function_safe('run_database_maintenance');

CREATE OR REPLACE FUNCTION run_database_maintenance(
    cleanup_forecasts BOOLEAN DEFAULT true,
    cleanup_buoys BOOLEAN DEFAULT true,
    update_stats BOOLEAN DEFAULT true,
    forecast_retention_days INTEGER DEFAULT 30,
    buoy_inactive_days INTEGER DEFAULT 7
) 
RETURNS JSON 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    result JSON;
    forecasts_cleaned INTEGER := 0;
    buoys_cleaned INTEGER := 0;
    start_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Initialize result object
    result := '{"maintenance_started": "' || start_time || '", "operations": []}'::JSON;
    
    -- Clean up old forecasts if requested
    IF cleanup_forecasts THEN
        SELECT cleanup_old_forecasts(forecast_retention_days) INTO forecasts_cleaned;
    END IF;
    
    -- Clean up inactive buoys if requested
    IF cleanup_buoys THEN
        SELECT cleanup_inactive_buoys(buoy_inactive_days) INTO buoys_cleaned;
    END IF;
    
    -- Update statistics if requested
    IF update_stats THEN
        PERFORM update_forecast_table_stats();
    END IF;
    
    -- Build result JSON
    result := json_build_object(
        'maintenance_started', start_time,
        'maintenance_completed', NOW(),
        'operations', json_build_array(
            json_build_object('cleanup_forecasts', cleanup_forecasts, 'records_cleaned', forecasts_cleaned),
            json_build_object('cleanup_buoys', cleanup_buoys, 'buoys_updated', buoys_cleaned),
            json_build_object('update_stats', update_stats)
        )
    );
    
    RETURN result;
END;
$$;

-- ================================================
-- 30. Fix refresh_mv_beach_hourly_scores Function (recreate with search_path)
-- ================================================
SELECT _temp_drop_function_safe('refresh_mv_beach_hourly_scores');

CREATE OR REPLACE FUNCTION refresh_mv_beach_hourly_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- ================================================
-- 31. Fix refresh_mv_beach_hourly_scores_and_analyze Function
-- ================================================
SELECT _temp_drop_function_safe('refresh_mv_beach_hourly_scores_and_analyze');

CREATE OR REPLACE FUNCTION refresh_mv_beach_hourly_scores_and_analyze()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.refresh_mv_beach_hourly_scores();
  
  -- Run ANALYZE if available
  EXECUTE 'ANALYZE public.mv_beach_hourly_scores';
END;
$$;

-- ================================================
-- 32. Fix update_session_likes_count Function (recreate with search_path)
-- ================================================
SELECT _temp_drop_function_safe('update_session_likes_count');

CREATE OR REPLACE FUNCTION update_session_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.sessions 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.session_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.sessions 
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.session_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ================================================
-- 33. Fix trigger_manual_maintenance Function
-- ================================================
SELECT _temp_drop_function_safe('trigger_manual_maintenance');

CREATE OR REPLACE FUNCTION trigger_manual_maintenance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- Trigger comprehensive maintenance with default parameters
    RETURN run_database_maintenance(
        cleanup_forecasts := true,
        cleanup_buoys := true,
        update_stats := true,
        forecast_retention_days := 30,
        buoy_inactive_days := 7
    );
END;
$$;

-- ================================================
-- 34. Fix create_activity Function
-- ================================================
SELECT _temp_drop_function_safe('create_activity');

CREATE OR REPLACE FUNCTION create_activity(
    p_user_id UUID,
    p_activity_type VARCHAR(50),
    p_entity_type VARCHAR(50),
    p_entity_id UUID,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO user_activities (
        user_id,
        activity_type,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        p_user_id,
        p_activity_type,
        p_entity_type,
        p_entity_id,
        p_metadata
    )
    RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$;

-- ================================================
-- 35. Fix update_intel_posts_updated_at Function
-- ================================================
SELECT _temp_drop_function_safe('update_intel_posts_updated_at');

CREATE OR REPLACE FUNCTION update_intel_posts_updated_at()
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

-- ================================================
-- 36. Fix update_review_helpful_count Function (recreate with search_path)
-- ================================================
SELECT _temp_drop_function_safe('update_review_helpful_count');

CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- ================================================
-- 37. Fix update_intel_confirmations_count Function
-- ================================================
SELECT _temp_drop_function_safe('update_intel_confirmations_count');

CREATE OR REPLACE FUNCTION update_intel_confirmations_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- ================================================
-- 38. Fix nightly_forecast_maintenance Function
-- ================================================
SELECT _temp_drop_function_safe('nightly_forecast_maintenance');

CREATE OR REPLACE FUNCTION nightly_forecast_maintenance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    result JSON;
    cleanup_result INTEGER;
    refresh_result BOOLEAN;
BEGIN
    -- Clean up old forecasts (keep 14 days)
    SELECT cleanup_old_enhanced_forecasts(14) INTO cleanup_result;
    
    -- Refresh materialized views
    PERFORM refresh_mv_beach_hourly_scores();
    PERFORM refresh_mv_best_times();
    refresh_result := true;
    
    -- Update statistics
    PERFORM update_forecast_table_stats();
    
    result := json_build_object(
        'maintenance_time', NOW(),
        'forecasts_cleaned', cleanup_result,
        'views_refreshed', refresh_result,
        'stats_updated', true
    );
    
    RETURN result;
END;
$$;

-- ================================================
-- 39. Fix cleanup_stale_enhanced_forecasts Function
-- ================================================
SELECT _temp_drop_function_safe('cleanup_stale_enhanced_forecasts');

CREATE OR REPLACE FUNCTION cleanup_stale_enhanced_forecasts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete stale enhanced forecasts (older than 7 days)
    DELETE FROM enhanced_forecasts 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ================================================
-- 40. Fix get_beach_review_stats Function
-- ================================================
SELECT _temp_drop_function_safe('get_beach_review_stats');

CREATE OR REPLACE FUNCTION get_beach_review_stats(beach_uuid UUID)
RETURNS TABLE(
    total_reviews BIGINT,
    average_rating NUMERIC,
    rating_breakdown JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_reviews,
        ROUND(AVG(overall_rating), 2) as average_rating,
        json_build_object(
            'wave_rating', ROUND(AVG(wave_rating), 2),
            'crowd_rating', ROUND(AVG(crowd_rating), 2),
            'amenities_rating', ROUND(AVG(amenities_rating), 2),
            'scenery_rating', ROUND(AVG(scenery_rating), 2),
            'safety_rating', ROUND(AVG(safety_rating), 2)
        ) as rating_breakdown
    FROM beach_reviews
    WHERE beach_id = beach_uuid;
END;
$$;

-- ================================================
-- 41. Fix validate_raw_forecast_structure Function
-- ================================================
SELECT _temp_drop_function_safe('validate_raw_forecast_structure');

CREATE OR REPLACE FUNCTION validate_raw_forecast_structure(forecast_json JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- Validate required forecast structure
    RETURN (
        forecast_json ? 'wave_height' AND
        forecast_json ? 'wave_period' AND
        forecast_json ? 'wind_speed' AND
        forecast_json ? 'wind_direction' AND
        forecast_json ? 'timestamp'
    );
END;
$$;

-- Clean up temporary helper function
DROP FUNCTION _temp_drop_function_safe(TEXT);

-- ================================================
-- Success Message
-- ================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Remaining Function Search Path Security Fixed!';
    RAISE NOTICE '   ✓ Applied search_path protection to 23 additional functions';
    RAISE NOTICE '   ✓ All functions now use SECURITY DEFINER with search_path = public, extensions';
    RAISE NOTICE '   ✓ Complete protection against search path injection attacks';
END $$;

COMMIT;
