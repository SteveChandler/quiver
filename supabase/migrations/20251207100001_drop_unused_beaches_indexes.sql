-- Drop unused beaches indexes (0 scans in production)
-- Migration: 20251207100001_drop_unused_beaches_indexes.sql
--
-- Analysis showed 14 indexes on beaches table with 0 scans:
-- - idx_beaches_break_type, idx_beaches_skill_level, idx_beaches_features
-- - idx_beaches_best_months, idx_beaches_location (duplicate of geog_gist)
-- - idx_beaches_public, idx_beaches_active_with_coords
-- - idx_beaches_city_lower, idx_beaches_state_lower, idx_beaches_country_lower
-- - idx_beaches_average_rating, idx_beaches_review_count
-- - idx_beaches_private_owner, idx_beaches_id_active
--
-- Note: Using IF EXISTS to make migration idempotent
-- Note: Cannot use CONCURRENTLY in transaction, so using regular DROP

-- Drop indexes that have never been used (0 scans)
DROP INDEX IF EXISTS idx_beaches_break_type;
DROP INDEX IF EXISTS idx_beaches_skill_level;
DROP INDEX IF EXISTS idx_beaches_features;
DROP INDEX IF EXISTS idx_beaches_best_months;

-- idx_beaches_location is a duplicate GIST index - idx_beaches_geog_gist is preferred (447 scans)
DROP INDEX IF EXISTS idx_beaches_location;

DROP INDEX IF EXISTS idx_beaches_public;
DROP INDEX IF EXISTS idx_beaches_active_with_coords;
DROP INDEX IF EXISTS idx_beaches_city_lower;
DROP INDEX IF EXISTS idx_beaches_state_lower;
DROP INDEX IF EXISTS idx_beaches_country_lower;
DROP INDEX IF EXISTS idx_beaches_average_rating;
DROP INDEX IF EXISTS idx_beaches_review_count;
DROP INDEX IF EXISTS idx_beaches_private_owner;
DROP INDEX IF EXISTS idx_beaches_id_active;

-- ============================================================================
-- VERIFICATION: Check remaining indexes after migration
-- ============================================================================
-- SELECT indexname, idx_scan FROM pg_stat_user_indexes
-- WHERE relname = 'beaches' ORDER BY idx_scan DESC;
--
-- Expected remaining indexes (14):
-- - beaches_pkey (542K scans)
-- - idx_beaches_location_hierarchy (18K scans)
-- - idx_beaches_slug_exact (16K scans)
-- - idx_beaches_location_lookup (4.7K scans)
-- - idx_beaches_geog_gist (447 scans)
-- - idx_beaches_state (62 scans)
-- - beaches_region_id_idx (36 scans)
-- - idx_beaches_crowd_level (24 scans)
-- - idx_beaches_owner_id_fkey (20 scans)
-- - beaches_name_unique (19 scans)
-- - idx_beaches_deleted_at (8 scans)
-- - idx_beaches_name_with_coords (6 scans)
-- - idx_beaches_list_covering (2 scans)
-- - idx_beaches_country (1 scan)
