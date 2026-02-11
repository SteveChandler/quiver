-- Rollback Migration: Remove terrain-aware geometry scoring columns
-- Created: 2026-01-20
--
-- Purpose: Safely rollback the terrain geometry scoring feature migration.
-- This script removes all terrain-related columns, constraints, and indexes.
--
-- WARNING: This will permanently delete all terrain analysis data.
-- Ensure you have backups if needed before running this rollback.

-- Drop indexes first (must be done before dropping columns)
DROP INDEX IF EXISTS idx_beaches_terrain_rollout;
DROP INDEX IF EXISTS idx_beaches_terrain_method_hash;
DROP INDEX IF EXISTS idx_beaches_terrain_status;
DROP INDEX IF EXISTS idx_beaches_terrain_enabled;

-- Drop constraints (must be done before dropping columns)
ALTER TABLE beaches
  DROP CONSTRAINT IF EXISTS terrain_status_valid,
  DROP CONSTRAINT IF EXISTS swell_access_len,
  DROP CONSTRAINT IF EXISTS wind_exposure_len;

-- Drop all terrain-related columns
ALTER TABLE beaches
  DROP COLUMN IF EXISTS terrain_analysis_debug,
  DROP COLUMN IF EXISTS terrain_enabled,
  DROP COLUMN IF EXISTS terrain_status,
  DROP COLUMN IF EXISTS swell_analyzed_at,
  DROP COLUMN IF EXISTS wind_analyzed_at,
  DROP COLUMN IF EXISTS terrain_analyzed_at,
  DROP COLUMN IF EXISTS terrain_params_hash,
  DROP COLUMN IF EXISTS terrain_params,
  DROP COLUMN IF EXISTS terrain_method,
  DROP COLUMN IF EXISTS swell_access_factors,
  DROP COLUMN IF EXISTS wind_exposure_factors;

-- Comments are automatically dropped with columns, no explicit cleanup needed
