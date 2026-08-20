-- UNAPPLIED FORWARD MIGRATION (2026-08-20) -- requires maintainer approval before prod.
-- Depends on 20260820120000 having been applied first.
--
-- Close the mechanism that produced the 2026-08-20 timezone bug rather than only
-- its 9 symptoms.
--
-- MECHANISM
--
-- 20260113200000 created beaches.timezone as `TEXT DEFAULT 'America/Los_Angeles'`.
-- Every beach-insert migration since then that omits the column silently files
-- the beach in Pacific time. That is exactly how the 2 Long Island rows
-- (2026-05-26) and the 7 Texas rows (2026-08-03) broke, both after the
-- state-based repair in 20260202110000 had already run. One-shot data repairs
-- cannot hold while the default keeps re-creating the defect.
--
-- THREE GUARDS
--
-- 1. Drop the default. An insert that forgets `timezone` now writes NULL...
-- 2. ...and NOT NULL turns that NULL into an immediate, loud failure at insert
--    time instead of a wrong number in the app months later.
-- 3. A CHECK rejecting 'America/Los_Angeles' east of longitude -114. The
--    America/Los_Angeles zone's true eastern edge is the California/Arizona
--    border at roughly -114.13, so the bound cannot reject a legitimate row.
--    Every one of the 9 broken rows sat between -97.33 and -72.84 and would have
--    been rejected at insert time. The easternmost surviving Pacific beach is
--    K-40 (Puerto Nuevo, Baja California) at -116.91, leaving ~3 degrees of
--    headroom.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- It does not derive timezone from lat/lon in the database. Postgres cannot call
-- geo-tz, and the application helper that could
-- (`lib/utils/timezone-utils.server.ts::getTimezoneFromCoords`) imports
-- `geo-tz/now`, a dataset variant that merges zones sharing a current offset.
-- Verified on 2026-08-20 against the live table: it returns 'America/Caracas'
-- for all 19 Puerto Rico beaches and 'America/Los_Angeles' for all 8 Baja
-- California beaches. A backfill or constraint driven by that function would
-- overwrite correct data with the wrong IANA identifiers. Coordinate-derived
-- checking is done out-of-band instead, against the full geo-tz dataset, by
-- scripts/audit-beach-timezones.ts.
--
-- No data rows are modified by this migration.

BEGIN;

-- Fail early and legibly rather than through a bare constraint-violation error.
DO $preflight$
DECLARE
  v_null    int;
  v_pacific int;
BEGIN
  SELECT count(*) INTO v_null FROM public.beaches WHERE timezone IS NULL;
  IF v_null > 0 THEN
    RAISE EXCEPTION 'cannot enforce beaches.timezone NOT NULL: % row(s) are NULL', v_null;
  END IF;

  SELECT count(*) INTO v_pacific
  FROM public.beaches
  WHERE timezone = 'America/Los_Angeles' AND lon IS NOT NULL AND lon > -114;
  IF v_pacific > 0 THEN
    RAISE EXCEPTION
      'cannot add beaches_pacific_timezone_longitude_check: % row(s) still hold America/Los_Angeles east of -114; apply 20260820120000 first',
      v_pacific;
  END IF;
END
$preflight$;

ALTER TABLE public.beaches ALTER COLUMN timezone DROP DEFAULT;
ALTER TABLE public.beaches ALTER COLUMN timezone SET NOT NULL;

ALTER TABLE public.beaches
  ADD CONSTRAINT beaches_pacific_timezone_longitude_check
  CHECK (timezone <> 'America/Los_Angeles' OR lon IS NULL OR lon <= -114);

COMMENT ON COLUMN public.beaches.timezone IS
  'IANA timezone for this beach, required on insert. No default: a beach-insert migration that omits it must fail loudly rather than inherit Pacific time (see 20260820120100). Verify new values with `yarn tsx scripts/audit-beach-timezones.ts`.';

COMMIT;

-- ROLLBACK (run manually):
--
-- BEGIN;
-- ALTER TABLE public.beaches DROP CONSTRAINT IF EXISTS beaches_pacific_timezone_longitude_check;
-- ALTER TABLE public.beaches ALTER COLUMN timezone DROP NOT NULL;
-- ALTER TABLE public.beaches ALTER COLUMN timezone SET DEFAULT 'America/Los_Angeles';
-- COMMIT;
