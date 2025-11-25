-- ============================================================================
-- Rollback Migration: Restore Best Conditions Indexes
-- ============================================================================
-- Date: 2025-11-19
-- Purpose: Rollback 20251119000000_cleanup_unused_best_conditions_indexes.sql
--
-- USE ONLY IF: Need to restore idx_session_media_photos_recent index
--
-- This will:
-- 1. Recreate the session_media photos index with original definition
-- 2. Restore original table comment
-- ============================================================================

BEGIN;

-- ============================================================================
-- Restore session_media photos index
-- ============================================================================

-- Recreate partial index for recent photo lookups
CREATE INDEX IF NOT EXISTS idx_session_media_photos_recent
  ON public.session_media (media_type, created_at DESC)
  WHERE media_type IN ('photo', 'image');

COMMENT ON INDEX idx_session_media_photos_recent IS
'Partial index for recent photo lookups. Query pattern:
SELECT ... FROM session_media sm
JOIN sessions s ON sm.session_id = s.id
WHERE sm.media_type IN (''photo'', ''image'')
  AND s.beach_id IN (...)
ORDER BY sm.created_at DESC
Partial index reduces size by 40% (photos only).
WARNING: Application MUST add LIMIT clause to prevent full scan.';

-- Restore original table comment
COMMENT ON TABLE public.session_media IS 
'Session media storage (photos, videos). Indexed by session_id, user_id, and media_type+created_at for various query patterns.';

COMMIT;

-- ============================================================================
-- POST-ROLLBACK NOTES
-- ============================================================================
--
-- Index restored to original state from migration:
-- 20251117000000_optimize_best_conditions_indexes.sql
--
-- If rolling back due to performance issues, investigate whether:
-- 1. BeachRecommendationService was re-enabled
-- 2. New feature requires similar photo query pattern
-- 3. Different index strategy would be more appropriate
--
-- ============================================================================

