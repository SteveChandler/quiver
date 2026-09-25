-- Drop four profile preference columns that nothing reads or writes.
--
-- Added by 20260617043620_add_profile_surfer_preferences.sql for a
-- "learned-me calibration" that never shipped. Audit 2026-09-24 found no
-- reader or writer in web (app/, lib/, components/, actions/, hooks/,
-- scripts/), native (quiver-native origin/main src/), other workspace repos,
-- or SQL (no function, view, policy, trigger, or index references them in
-- supabase/migrations or supabase/snapshots/schema.sql). The only code
-- reference was their presence in PROFILE_PUBLIC_FIELDS, removed alongside.
--
-- Pre-apply check (production, read-only):
--   SELECT count(*) FILTER (WHERE preferred_wave_size IS NOT NULL) AS wave,
--          count(*) FILTER (WHERE crowd_tolerance IS NOT NULL)     AS crowd,
--          count(*) FILTER (WHERE tide_comfort IS NOT NULL)        AS tide,
--          count(*) FILTER (WHERE wind_comfort IS NOT NULL)        AS wind
--   FROM public.profiles;
--   SELECT p.proname FROM pg_proc p
--   WHERE p.prosrc ~ '(preferred_wave_size|crowd_tolerance|tide_comfort|wind_comfort)';
-- DROP COLUMN (without CASCADE) fails if a view or constraint outside this
-- table still depends on a column; plpgsql bodies are not tracked, hence the
-- pg_proc check.
--
-- Rollback (schema only; dropped values are not recoverable):
--   ALTER TABLE public.profiles
--     ADD COLUMN IF NOT EXISTS preferred_wave_size text,
--     ADD COLUMN IF NOT EXISTS crowd_tolerance text,
--     ADD COLUMN IF NOT EXISTS tide_comfort text,
--     ADD COLUMN IF NOT EXISTS wind_comfort text;
--   then re-apply the CHECK constraints from 20260617043620 and re-grant
--   column SELECT to anon, authenticated as in 20260718142000.

BEGIN;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS preferred_wave_size;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS crowd_tolerance;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS tide_comfort;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS wind_comfort;

COMMIT;
