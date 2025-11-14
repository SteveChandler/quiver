-- Add metadata columns to user_surf_preferences table
-- These columns track user validation and manual overrides of learned preferences

BEGIN;

-- Add validated_at column to track when user confirmed preferences
ALTER TABLE user_surf_preferences
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- Add manual_override flag to indicate user has manually edited preferences
ALTER TABLE user_surf_preferences
  ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE;

-- Add comment explaining the columns
COMMENT ON COLUMN user_surf_preferences.validated_at IS 'Timestamp when user confirmed their learned preferences match their style';
COMMENT ON COLUMN user_surf_preferences.manual_override IS 'Flag indicating user has manually overridden learned preference values';

COMMIT;
