-- Phase 5 Workpath 5.1: User Surf Preferences (Learned from Session History)
-- Purpose: Store learned preferences from session_forecast_snapshots analysis
-- References: docs/features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md Phase 5
-- Agent: backend-developer
-- Date: 2025-11-03

-- ============================================================================
-- Table: user_surf_preferences
-- ============================================================================
-- Stores learned user preferences from analyzing session history with
-- captured forecast conditions. Updated nightly by preference learning service.
--
-- Algorithm: Analyzes sessions with rating >= 3 (good experiences)
-- - Wave height/period: 10th-90th percentile of good sessions
-- - Wind: 90th percentile for max tolerance
-- - Wind directions: Mode detection (most common cardinal directions)
-- - Tide statuses: Mode detection (most common tide states)
-- - Confidence: Sigmoid based on sample size (5 sessions = 0.5, 20+ = 0.95)
-- ============================================================================

CREATE TABLE user_surf_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Wave preferences (learned from rated sessions)
  wave_min_ft numeric(3,1) CHECK (wave_min_ft >= 0),
  wave_max_ft numeric(3,1) CHECK (wave_max_ft >= wave_min_ft),
  wave_period_min_s numeric(3,1) CHECK (wave_period_min_s >= 0),
  wave_period_max_s numeric(3,1) CHECK (wave_period_max_s >= wave_period_min_s),

  -- Wind preferences
  max_wind_mph numeric(4,1) CHECK (max_wind_mph >= 0),
  preferred_wind_directions int[] CHECK (
    array_length(preferred_wind_directions, 1) IS NULL OR
    array_length(preferred_wind_directions, 1) <= 8
  ),

  -- Tide preferences
  preferred_tide_statuses text[] CHECK (
    array_length(preferred_tide_statuses, 1) IS NULL OR
    array_length(preferred_tide_statuses, 1) <= 6
  ),

  -- Metadata
  confidence numeric(3,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  sample_size int NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  last_computed_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Primary lookup by user
CREATE INDEX idx_user_surf_preferences_user ON user_surf_preferences(user_id);

-- Find users with high-confidence preferences for recommendations
CREATE INDEX idx_user_surf_preferences_confidence ON user_surf_preferences(confidence DESC);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE user_surf_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their own preferences"
  ON user_surf_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own preferences (manual preference tuning in future)
CREATE POLICY "Users can update their own preferences"
  ON user_surf_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can compute preferences for all users (nightly cron job)
CREATE POLICY "Service role can manage all preferences"
  ON user_surf_preferences FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Documentation Comments
-- ============================================================================

COMMENT ON TABLE user_surf_preferences IS
  'Learned surf preferences from user session history. Updated by preference learning service (Workpath 5.2). Requires minimum 5 rated sessions (rating >= 3).';

COMMENT ON COLUMN user_surf_preferences.wave_min_ft IS
  'Minimum preferred wave height in feet (10th percentile of good sessions)';

COMMENT ON COLUMN user_surf_preferences.wave_max_ft IS
  'Maximum preferred wave height in feet (90th percentile of good sessions)';

COMMENT ON COLUMN user_surf_preferences.wave_period_min_s IS
  'Minimum preferred wave period in seconds (10th percentile)';

COMMENT ON COLUMN user_surf_preferences.wave_period_max_s IS
  'Maximum preferred wave period in seconds (90th percentile)';

COMMENT ON COLUMN user_surf_preferences.max_wind_mph IS
  'Maximum tolerable wind speed in mph (90th percentile)';

COMMENT ON COLUMN user_surf_preferences.preferred_wind_directions IS
  'Array of preferred wind directions in degrees (0-360). Up to 8 cardinal directions (N, NE, E, SE, S, SW, W, NW). Computed via mode detection with 15% frequency threshold.';

COMMENT ON COLUMN user_surf_preferences.preferred_tide_statuses IS
  'Preferred tide statuses (e.g., ["rising", "high"]) from good sessions. Computed via mode detection with 20% frequency threshold.';

COMMENT ON COLUMN user_surf_preferences.confidence IS
  'Confidence score (0-1) based on sample size using sigmoid function: 1 / (1 + exp(-0.3 * (n - 10))). Examples: 5 sessions = 0.5 confidence, 20+ sessions = 0.95 confidence.';

COMMENT ON COLUMN user_surf_preferences.sample_size IS
  'Number of rated sessions (rating >= 3) used to compute preferences. Minimum 5 required for preference computation.';

COMMENT ON COLUMN user_surf_preferences.last_computed_at IS
  'Timestamp of last preference computation. Updated nightly by preference learning cron job (Workpath 5.3).';
