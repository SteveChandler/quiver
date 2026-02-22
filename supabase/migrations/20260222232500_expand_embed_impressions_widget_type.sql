-- Expand widget_type CHECK constraint to include surf-terminal and ticker.
-- These widget types were added to the API + hook but the DB constraint was
-- never updated, causing 500s on every surf-terminal/ticker impression.

BEGIN;

ALTER TABLE public.embed_impressions
  DROP CONSTRAINT IF EXISTS embed_impressions_widget_type_check;

ALTER TABLE public.embed_impressions
  ADD CONSTRAINT embed_impressions_widget_type_check
  CHECK (widget_type IN ('tides', 'conditions', 'surf-terminal', 'ticker'));

COMMIT;
