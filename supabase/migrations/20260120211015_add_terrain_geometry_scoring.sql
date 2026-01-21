-- Migration: Add terrain-aware geometry scoring columns to beaches table
-- Created: 2026-01-20
--
-- Purpose: Enable fine-grained directional scoring for wind exposure and swell access
-- based on terrain analysis. Supports 5° binned directional factors (72 values covering 0-355°).
--
-- Key Features:
-- - Wind exposure factors: Measures how exposed/sheltered the beach is to wind from each direction
-- - Swell access factors: Measures swell accessibility including direct + wrap-around effects
-- - Method versioning: Tracks terrain analysis method and parameters for reproducibility
-- - Granular status tracking: Individual timestamps for wind/swell analysis completion
-- - Staged rollout: Per-beach enablement flag for controlled deployment
-- - Debug capability: Optional JSONB field for visualization and troubleshooting

-- Add terrain-aware geometry scoring columns
ALTER TABLE beaches
  -- Directional factor arrays (72 values: 0°, 5°, 10°... 355°)
  -- Semantics: 1.0 = fully exposed/accessible, 0.0 = fully sheltered/blocked
  ADD COLUMN wind_exposure_factors real[] DEFAULT NULL,
  ADD COLUMN swell_access_factors real[] DEFAULT NULL,

  -- Analysis method versioning (for reproducibility and cache invalidation)
  ADD COLUMN terrain_method text DEFAULT NULL,
  ADD COLUMN terrain_params jsonb DEFAULT NULL,
  ADD COLUMN terrain_params_hash text DEFAULT NULL,
  ADD COLUMN terrain_analyzed_at timestamptz DEFAULT NULL,

  -- Granular completion tracking
  ADD COLUMN wind_analyzed_at timestamptz DEFAULT NULL,
  ADD COLUMN swell_analyzed_at timestamptz DEFAULT NULL,
  ADD COLUMN terrain_status text DEFAULT NULL,

  -- Per-beach enablement for staged rollout
  ADD COLUMN terrain_enabled boolean DEFAULT false NOT NULL,

  -- Optional debug/visualization data (not used in query hot path)
  ADD COLUMN terrain_analysis_debug jsonb DEFAULT NULL;

-- Add constraints to validate array lengths
ALTER TABLE beaches
  ADD CONSTRAINT wind_exposure_len
    CHECK (wind_exposure_factors IS NULL OR array_length(wind_exposure_factors, 1) = 72),
  ADD CONSTRAINT swell_access_len
    CHECK (swell_access_factors IS NULL OR array_length(swell_access_factors, 1) = 72);

-- Add constraint to validate terrain_status enum values
ALTER TABLE beaches
  ADD CONSTRAINT terrain_status_valid
    CHECK (terrain_status IS NULL OR terrain_status IN ('ok', 'wind_only', 'failed'));

-- Add comments for documentation
COMMENT ON COLUMN beaches.wind_exposure_factors IS
  'Directional wind exposure factors as 72-element array (5° bins: 0°, 5°, 10°... 355°). 1.0 = fully exposed, 0.0 = fully sheltered.';

COMMENT ON COLUMN beaches.swell_access_factors IS
  'Directional swell access factors as 72-element array (5° bins). Includes direct + wrap-around effects. 1.0 = fully accessible, 0.0 = fully blocked.';

COMMENT ON COLUMN beaches.terrain_method IS
  'Terrain analysis method identifier (e.g., ''dem_horizon_v1'') for cache invalidation and reproducibility.';

COMMENT ON COLUMN beaches.terrain_params IS
  'Analysis parameters as JSONB (e.g., {radius_km: 50, step_m: 100, dem_source: "SRTM", resolution_m: 30}).';

COMMENT ON COLUMN beaches.terrain_params_hash IS
  'SHA256 hash of canonical terrain_params JSON for fast cache validation without full JSON comparison.';

COMMENT ON COLUMN beaches.terrain_analyzed_at IS
  'Timestamp when terrain analysis was completed (covers both wind and swell if terrain_status = ''ok'').';

COMMENT ON COLUMN beaches.wind_analyzed_at IS
  'Timestamp when wind exposure analysis specifically completed.';

COMMENT ON COLUMN beaches.swell_analyzed_at IS
  'Timestamp when swell access analysis specifically completed.';

COMMENT ON COLUMN beaches.terrain_status IS
  'Analysis completion status: ''ok'' (both complete), ''wind_only'' (swell pending/failed), ''failed'' (analysis failed).';

COMMENT ON COLUMN beaches.terrain_enabled IS
  'Feature flag for staged rollout. When true, terrain factors are used in scoring calculations.';

COMMENT ON COLUMN beaches.terrain_analysis_debug IS
  'Optional debug data (horizon angles, headland detection, etc.) for visualization and troubleshooting. Not used in query hot path.';

-- Create indexes for common query patterns
-- Note: Array columns (wind_exposure_factors, swell_access_factors) do not benefit from standard B-tree indexes

-- Index for finding beaches with completed terrain analysis
CREATE INDEX idx_beaches_terrain_enabled
  ON beaches(terrain_enabled)
  WHERE terrain_enabled = true;

-- Index for finding beaches needing terrain analysis
CREATE INDEX idx_beaches_terrain_status
  ON beaches(terrain_status, terrain_analyzed_at)
  WHERE terrain_status IS NOT NULL;

-- Index for cache validation queries (by method + params hash)
CREATE INDEX idx_beaches_terrain_method_hash
  ON beaches(terrain_method, terrain_params_hash)
  WHERE terrain_method IS NOT NULL;

-- Composite index for staged rollout queries
CREATE INDEX idx_beaches_terrain_rollout
  ON beaches(terrain_enabled, terrain_status, terrain_analyzed_at);
