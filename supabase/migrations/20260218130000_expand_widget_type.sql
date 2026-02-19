-- Expand embed_impressions widget_type CHECK constraint to include surf-terminal and ticker
BEGIN;

-- Drop old inline constraint (auto-named by Postgres from the CREATE TABLE definition)
ALTER TABLE embed_impressions
  DROP CONSTRAINT IF EXISTS embed_impressions_widget_type_check;

-- Add updated constraint with all four widget types
ALTER TABLE embed_impressions
  ADD CONSTRAINT embed_impressions_widget_type_check
  CHECK (widget_type IN ('tides', 'conditions', 'surf-terminal', 'ticker'));

COMMIT;
