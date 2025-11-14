-- Rollback migration for preference metadata columns
-- This removes the validated_at and manual_override columns

BEGIN;

-- Remove metadata columns
ALTER TABLE user_surf_preferences
  DROP COLUMN IF EXISTS validated_at,
  DROP COLUMN IF EXISTS manual_override;

COMMIT;
