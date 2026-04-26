-- Rollback: remove wind_direction_deg from enhanced_forecasts
--
-- HISTORY: This file was committed in error in commit b98b26d2 (Dec 12 2025)
-- alongside the forward migration that adds wind_direction_deg. Because
-- Supabase plays migrations in timestamp order, the rollback ran immediately
-- after the forward, dropping the column — and every later migration that
-- references wind_direction_deg (notably 20260315120000_fix_hrrr_numeric_wind_direction.sql)
-- then failed on local `supabase db reset`.
--
-- The forward migration's existence in production confirms the column is
-- present; the rollback was never intended to run automatically. Neutralized
-- to a no-op rather than deleted so the filename remains traceable in git
-- history. If a real rollback is ever needed, run the original ALTER TABLE
-- ... DROP COLUMN statement manually under the PLAN -> APPROVAL protocol
-- per docs/MIGRATION_SAFETY.md.

BEGIN;

-- Intentionally no-op. See header for context.
SELECT 1;

COMMIT;
