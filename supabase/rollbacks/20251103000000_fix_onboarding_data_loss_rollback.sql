-- Rollback Migration: Fix Onboarding Data Loss
-- Description: Rollback for 20250103000000_fix_onboarding_data_loss.sql
-- Warning: This will delete all display_name and surf_styles data

-- Drop indexes first
DROP INDEX IF EXISTS idx_profiles_surf_styles;
DROP INDEX IF EXISTS idx_profiles_display_name;

-- Drop columns
ALTER TABLE profiles DROP COLUMN IF EXISTS surf_styles;
ALTER TABLE profiles DROP COLUMN IF EXISTS display_name;
