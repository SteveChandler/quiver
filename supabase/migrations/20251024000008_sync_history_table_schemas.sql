-- Migration: Sync History Table Schemas
-- Description: Add missing columns to history tables to match current schemas
-- Date: 2025-10-24
-- Author: Admin Portal Implementation (Workstream A - Schema Sync)

BEGIN;

-- ================================================
-- 1. Add missing columns to beaches_history
-- ================================================

-- Add all missing columns from beaches to beaches_history
ALTER TABLE public.beaches_history
    ADD COLUMN IF NOT EXISTS features TEXT[],
    ADD COLUMN IF NOT EXISTS parking_tips TEXT,
    ADD COLUMN IF NOT EXISTS access_tips TEXT,
    ADD COLUMN IF NOT EXISTS wave_tips TEXT,
    ADD COLUMN IF NOT EXISTS crowd_tips TEXT,
    ADD COLUMN IF NOT EXISTS best_conditions_prose TEXT,
    ADD COLUMN IF NOT EXISTS warnings TEXT[],
    ADD COLUMN IF NOT EXISTS local_etiquette TEXT,
    ADD COLUMN IF NOT EXISTS crowd_level TEXT,
    ADD COLUMN IF NOT EXISTS real_takeaways TEXT[],
    ADD COLUMN IF NOT EXISTS best_months TEXT[],
    ADD COLUMN IF NOT EXISTS region TEXT,
    ADD COLUMN IF NOT EXISTS country TEXT,
    ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS skill_level TEXT,
    ADD COLUMN IF NOT EXISTS shoreline_aspect_deg SMALLINT,
    ADD COLUMN IF NOT EXISTS swell_window_min_deg SMALLINT,
    ADD COLUMN IF NOT EXISTS swell_window_max_deg SMALLINT,
    ADD COLUMN IF NOT EXISTS wind_offshore_deg SMALLINT,
    ADD COLUMN IF NOT EXISTS wind_offshore_tol_deg SMALLINT,
    ADD COLUMN IF NOT EXISTS wind_cross_shore_ok_kt SMALLINT,
    ADD COLUMN IF NOT EXISTS wind_onshore_bad_kt SMALLINT,
    ADD COLUMN IF NOT EXISTS preferred_tide_ft_min NUMERIC,
    ADD COLUMN IF NOT EXISTS preferred_tide_ft_max NUMERIC,
    ADD COLUMN IF NOT EXISTS preference_model JSONB,
    ADD COLUMN IF NOT EXISTS coordinates GEOGRAPHY(POINT, 4326),
    ADD COLUMN IF NOT EXISTS aspect_deg INTEGER,
    ADD COLUMN IF NOT EXISTS offshore_deg INTEGER,
    ADD COLUMN IF NOT EXISTS swell_window_center_deg INTEGER,
    ADD COLUMN IF NOT EXISTS swell_window_halfwidth_deg INTEGER,
    ADD COLUMN IF NOT EXISTS tide_min_ft NUMERIC,
    ADD COLUMN IF NOT EXISTS tide_max_ft NUMERIC,
    ADD COLUMN IF NOT EXISTS wind_cross_ok_kts INTEGER,
    ADD COLUMN IF NOT EXISTS wind_onshore_bad_kts INTEGER;

COMMENT ON TABLE public.beaches_history IS 'Audit trail for beaches table. Schema synced with beaches table as of 2025-10-24.';

-- ================================================
-- 2. Check and add missing columns to other history tables
-- ================================================

-- For sessions_history, beach_reviews_history, etc., we'll add columns as needed
-- when we discover schema drift

COMMIT;

-- ================================================
-- VALIDATION QUERIES
-- ================================================
-- Verify schema sync:
-- SELECT COUNT(*) FROM (
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'beaches'
--   AND column_name NOT IN ('updated_at') -- exclude columns that don't need history
--   EXCEPT
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'beaches_history'
--   AND column_name NOT IN ('history_id', 'changed_at', 'changed_by', 'change_type')
-- ) as missing_columns;
-- -- Should return 0 if fully synced
