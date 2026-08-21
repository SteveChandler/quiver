-- UNAPPLIED FORWARD MIGRATION (2026-08-20) -- requires maintainer approval before prod.
--
-- Repair 9 beaches.timezone rows that hold 'America/Los_Angeles' but sit on the
-- Gulf Coast (TX) or Long Island (NY).
--
-- WHY THESE 9 ESCAPED THE EARLIER REPAIRS
--
-- 20260202110000_fix_east_coast_timezones.sql repaired every TX/NY beach that
-- existed on 2026-02-02 by matching on `state`. These 9 rows were inserted
-- AFTER that migration ran:
--   - 2026-05-26  20260526194000_add_long_island_beginner_beaches.sql  (2 NY rows)
--   - 2026-08-03  20260803120919_add_texas_beaches.sql                 (7 TX rows)
-- Neither insert lists `timezone` in its column list, so each row silently took
-- the column default `'America/Los_Angeles'` set by 20260113200000. The
-- state-based repair is a one-shot; the default re-creates the bug on every new
-- batch of beaches. 20260820120100 removes that default so the next omission
-- fails loudly instead of shipping Pacific time to the Gulf of Mexico.
--
-- IMPACT
--
-- Every per-beach local-time computation is wrong for these 9 spots: day
-- bucketing, dawn/dusk windows, tide labels, and alert send windows read 2h
-- (TX) or 3h (NY) behind local. `lib/utils/regional-forecast-utils.ts` currently
-- resolves a region's timezone by majority vote across its beaches specifically
-- to tolerate rows like these; that workaround can be revisited once the data is
-- correct, but it is deliberately left in place here.
--
-- VERIFICATION SOURCE
--
-- Each id below was read from production on 2026-08-20 (read-only SELECT) and
-- its stored lat/lon independently re-derived through the FULL `geo-tz` dataset
-- (v8.1.5). Note: `lib/utils/timezone-utils.server.ts::getTimezoneFromCoords`
-- imports `geo-tz/now`, which merges zones that currently share an offset -- it
-- returns 'America/Caracas' for Puerto Rico and 'America/Los_Angeles' for Baja
-- California. It must NOT be used to derive persisted timezone identity. See
-- scripts/audit-beach-timezones.ts.
--
-- Keyed on beaches.id. Names are carried only as an assertion that each id still
-- resolves to the beach that was audited; the UPDATE never matches on name.
--
-- Reversible: prior values are captured in _backup_beach_timezones_20260820
-- before the UPDATE. Rollback statement at the bottom of this file.
-- Re-runnable: the UPDATE is guarded on the current value, so a second run is a
-- no-op rather than an error.

BEGIN;

CREATE TEMP TABLE _tz_fix (
  beach_id      uuid PRIMARY KEY,
  expected_name text NOT NULL,
  old_timezone  text NOT NULL,
  new_timezone  text NOT NULL
) ON COMMIT DROP;

INSERT INTO _tz_fix (beach_id, expected_name, old_timezone, new_timezone) VALUES
  -- Texas Gulf Coast -> Central
  ('13ba376d-efd5-4e4e-af12-85bfeb2c17bc'::uuid, 'Galveston – 61st Street Pier',                  'America/Los_Angeles', 'America/Chicago'),
  ('cc0b9ee8-0efc-4f78-9049-48a99e0d2c52'::uuid, 'Galveston – Pleasure Pier',                     'America/Los_Angeles', 'America/Chicago'),
  ('a3f9b33e-6b29-4b41-8024-3f7cf1eb66c8'::uuid, 'Crystal Beach',                                 'America/Los_Angeles', 'America/Chicago'),
  ('55c7c5dd-1979-410a-bf39-ce3c52e29166'::uuid, 'Packery Channel Jetties',                       'America/Los_Angeles', 'America/Chicago'),
  ('04940f92-f611-448d-acd3-a6456ca8b6de'::uuid, 'Bob Hall Pier',                                 'America/Los_Angeles', 'America/Chicago'),
  ('d85492b8-31ed-4dd8-af53-4284e9456be9'::uuid, 'Mustang Island State Park',                     'America/Los_Angeles', 'America/Chicago'),
  ('14907560-8c92-4d2e-997b-9661e97b0751'::uuid, 'Padre Island National Seashore – South Beach',  'America/Los_Angeles', 'America/Chicago'),
  -- Long Island -> Eastern
  ('22696f11-3897-4fa6-b266-2f52dae4d5ac'::uuid, 'Robert Moses State Park',                       'America/Los_Angeles', 'America/New_York'),
  ('144b902f-4766-4bfa-a0ed-db41ade6a704'::uuid, 'Smith Point County Park',                       'America/Los_Angeles', 'America/New_York');

-- Preconditions: abort rather than touch a row that is not the one we audited.
DO $guard$
DECLARE
  v_missing   int;
  v_renamed   int;
  v_unexpected int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM _tz_fix f
  LEFT JOIN public.beaches b ON b.id = f.beach_id
  WHERE b.id IS NULL;

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'beach timezone repair aborted: % of 9 beach ids no longer exist', v_missing;
  END IF;

  SELECT count(*) INTO v_renamed
  FROM _tz_fix f
  JOIN public.beaches b ON b.id = f.beach_id
  WHERE b.name IS DISTINCT FROM f.expected_name;

  IF v_renamed > 0 THEN
    RAISE EXCEPTION 'beach timezone repair aborted: % id(s) no longer resolve to the audited beach name', v_renamed;
  END IF;

  -- Tolerates a re-run (row already holds new_timezone); rejects anything else.
  SELECT count(*) INTO v_unexpected
  FROM _tz_fix f
  JOIN public.beaches b ON b.id = f.beach_id
  WHERE b.timezone NOT IN (f.old_timezone, f.new_timezone);

  IF v_unexpected > 0 THEN
    RAISE EXCEPTION 'beach timezone repair aborted: % row(s) hold an unexpected timezone; re-audit before applying', v_unexpected;
  END IF;
END
$guard$;

-- Rollback source. Created once and never overwritten: a re-run must not be able
-- to erase the original pre-repair values.
CREATE TABLE IF NOT EXISTS public._backup_beach_timezones_20260820 (
  id           uuid PRIMARY KEY,
  name         text,
  city         text,
  state        text,
  lat          double precision,
  lon          double precision,
  old_timezone text NOT NULL,
  captured_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public._backup_beach_timezones_20260820 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public._backup_beach_timezones_20260820 FROM anon, authenticated;

COMMENT ON TABLE public._backup_beach_timezones_20260820 IS
  'Rollback source for the 2026-08-20 Gulf/Long Island beaches.timezone repair. First-capture wins, so a re-run cannot erase it. Safe to drop once the fix is validated in production.';

INSERT INTO public._backup_beach_timezones_20260820 (id, name, city, state, lat, lon, old_timezone)
SELECT b.id, b.name, b.city, b.state, b.lat, b.lon, b.timezone
FROM public.beaches b
JOIN _tz_fix f ON f.beach_id = b.id
WHERE b.timezone = f.old_timezone
ON CONFLICT (id) DO NOTHING;

UPDATE public.beaches b
SET timezone = f.new_timezone
FROM _tz_fix f
WHERE b.id = f.beach_id
  AND b.timezone = f.old_timezone;

-- Postcondition: all 9 rows now hold their correct zone.
DO $verify$
DECLARE
  v_wrong int;
BEGIN
  SELECT count(*) INTO v_wrong
  FROM _tz_fix f
  JOIN public.beaches b ON b.id = f.beach_id
  WHERE b.timezone IS DISTINCT FROM f.new_timezone;

  IF v_wrong > 0 THEN
    RAISE EXCEPTION 'beach timezone repair failed: % of 9 rows did not land on the expected timezone', v_wrong;
  END IF;
END
$verify$;

COMMIT;

-- ROLLBACK (run manually if this repair needs to be undone):
--
-- BEGIN;
-- UPDATE public.beaches b
-- SET timezone = bk.old_timezone
-- FROM public._backup_beach_timezones_20260820 bk
-- WHERE bk.id = b.id;
-- DROP TABLE public._backup_beach_timezones_20260820;
-- COMMIT;
--
-- NOTE: 20260820120100 adds a CHECK that forbids 'America/Los_Angeles' east of
-- lon -114. Drop that constraint before rolling this migration back, or the
-- rollback UPDATE will be rejected.
