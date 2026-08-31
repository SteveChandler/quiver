-- Restore `beach_sources.ndbc_buoy_ids`.
--
-- The forward migration refuses to run unless every row is empty, so the
-- restored column is faithful: an empty text[] on every row, which is exactly
-- what was dropped. Re-add the column before rolling back any deploy whose
-- sources endpoint still selects it.

BEGIN;

ALTER TABLE public.beach_sources
  ADD COLUMN IF NOT EXISTS ndbc_buoy_ids text[] NOT NULL DEFAULT '{}';

COMMIT;
