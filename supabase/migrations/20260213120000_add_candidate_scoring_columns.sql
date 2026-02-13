-- Migration: Add candidate scoring columns to ml_predictions_log
-- Part of ML Shadow Scoring Pipeline (Phase 2)
--
-- Purpose:
-- - Enable shadow scoring by storing candidate model corrections alongside champion
-- - The ML service writes candidate_corrected_m when CANDIDATE_VERSION is set
-- - promote-candidate cron compares these against ground truth for promotion decisions
--
-- New columns:
-- 1. candidate_corrected_m - Candidate model's corrected wave height
-- 2. candidate_model_version - Version string of the candidate model that produced the correction

BEGIN;

ALTER TABLE ml_predictions_log
  ADD COLUMN IF NOT EXISTS candidate_corrected_m NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS candidate_model_version TEXT;

COMMENT ON COLUMN ml_predictions_log.candidate_corrected_m IS
  'Corrected wave height from the candidate model during shadow scoring. NULL when no candidate is active.';

COMMENT ON COLUMN ml_predictions_log.candidate_model_version IS
  'Version string of the candidate model that produced candidate_corrected_m. NULL when no candidate is active.';

-- Index for efficient candidate evaluation queries in promote-candidate cron
CREATE INDEX IF NOT EXISTS idx_ml_predictions_candidate_version
  ON ml_predictions_log(candidate_model_version)
  WHERE candidate_model_version IS NOT NULL;

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP INDEX IF EXISTS idx_ml_predictions_candidate_version;
-- ALTER TABLE ml_predictions_log DROP COLUMN IF EXISTS candidate_corrected_m;
-- ALTER TABLE ml_predictions_log DROP COLUMN IF EXISTS candidate_model_version;
-- COMMIT;
