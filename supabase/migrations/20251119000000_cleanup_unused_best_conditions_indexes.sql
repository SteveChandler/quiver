-- ============================================================================
-- Migration: Cleanup Unused Best Conditions Indexes
-- ============================================================================
-- Date: 2025-11-19
-- Purpose: Remove database indexes that were created exclusively for the
--          BeachRecommendationService feature (removed Nov 2025)
--
-- CONTEXT:
-- BeachRecommendationService was removed as part of home screen simplification.
-- Most indexes from the original optimization migration (20251117000000) are
-- still actively used by other features:
--   - idx_user_beach_affinity_user_beach_covering → PersonalizedScoringService
--   - idx_enhanced_forecasts_date_time_beach → Home screen, beach detail, session conditions
--   - idx_beach_daily_intel_latest → BestSurfWindow component, IntelGenerationService
--
-- CLEANUP:
-- This migration drops only idx_session_media_photos_recent, which was used
-- exclusively by BeachRecommendationService for loading recent beach photos.
--
-- ROLLBACK: See 20251119000001_rollback_cleanup_unused_indexes.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop session_media photos index (no longer used)
-- ============================================================================
-- Original purpose: Optimize BeachRecommendationService photo queries
-- Query pattern: WHERE media_type IN ('photo', 'image') ORDER BY created_at DESC
-- Current usage: NONE - BeachRecommendationService removed
--
-- Note: session_media table is still indexed by session_id and user_id for
-- profile and session detail queries, which remain active features.

DROP INDEX IF EXISTS public.idx_session_media_photos_recent;

-- Update table comment to reflect current indexing strategy
COMMENT ON TABLE public.session_media IS 
'Session media storage (photos, videos). Indexed by session_id for session detail queries and user_id for profile queries. Photos displayed on session detail pages and user profiles.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- PRESERVED INDEXES (still actively used):
--
-- 1. user_beach_affinity:
--    - idx_user_beach_affinity_user_beach_covering
--      Used by: PersonalizedScoringService, /api/user/beach-affinity
--
-- 2. enhanced_forecasts:
--    - idx_enhanced_forecasts_date_time_beach
--      Used by: Home screen, beach detail, session conditions, forecast APIs
--
-- 3. beach_daily_intel:
--    - idx_beach_daily_intel_latest
--      Used by: BestSurfWindow component, IntelGenerationService
--
-- 4. Spatial indexes:
--    - beaches_geog_gist (geospatial queries)
--    - sessions_beach_idx (session queries by beach)
--
-- FUTURE FEATURE (indexes preserved):
-- - mv_beach_hourly_scores (materialized view for best-times feature)
-- - mv_best_times (precomputed surf windows)
-- - See docs/data-engineering/BEACH_RECOMMENDATION_CLEANUP_REVIEW.md for
--   data engineering review items regarding refresh schedules
--
-- ============================================================================

