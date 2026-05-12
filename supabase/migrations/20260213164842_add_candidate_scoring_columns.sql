-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER TABLE ml_predictions_log
  ADD COLUMN IF NOT EXISTS candidate_corrected_m NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS candidate_model_version TEXT;

COMMENT ON COLUMN ml_predictions_log.candidate_corrected_m IS
  'Corrected wave height from the candidate model during shadow scoring. NULL when no candidate is active.';

COMMENT ON COLUMN ml_predictions_log.candidate_model_version IS
  'Version string of the candidate model that produced candidate_corrected_m. NULL when no candidate is active.';

CREATE INDEX IF NOT EXISTS idx_ml_predictions_candidate_version
  ON ml_predictions_log(candidate_model_version)
  WHERE candidate_model_version IS NOT NULL;
