-- UNAPPLIED FORWARD MIGRATION (2026-08-20) -- requires maintainer approval before prod.
--
-- OUTSIDE THE ORIGINALLY REPORTED SCOPE. The 2026-08-20 report covered 9 rows
-- wrongly set to 'America/Los_Angeles'. Re-deriving all 346 beaches from their
-- stored coordinates surfaced 2 more wrong rows in the opposite direction, from
-- the same root cause. They are isolated in their own file so this fix can be
-- approved, deferred, or deleted independently of 20260820120000.
--
-- THE DEFECT
--
-- 20260202110000_fix_east_coast_timezones.sql set `timezone = 'America/New_York'`
-- for every beach with `state IN (... 'FL' ...)`. Florida straddles the
-- Eastern/Central boundary: everything west of the Apalachicola River is Central
-- time. The blanket state-based UPDATE filed two Panhandle beaches an hour
-- ahead of their actual local time, and they have read wrong since 2026-02-02.
--
--   Navarre Beach Pier   30.3767,  -86.865    Santa Rosa County, FL   -> Central
--   Pensacola Pier       30.33008, -87.14253  Escambia County, FL     -> Central
--
-- Both are ~180km west of the Apalachicola River boundary, so this is not a
-- borderline call. Confirmed by re-deriving each stored coordinate through the
-- full geo-tz dataset (v8.1.5); both return 'America/Chicago'.
--
-- After this repair the westernmost 'America/New_York' beach is Jacksonville
-- Beach Pier at -81.388, comfortably east of the boundary.
--
-- Same conventions as 20260820120000: keyed on beaches.id, name carried only as
-- an assertion, guarded on the current value so a re-run is a no-op, prior
-- values captured for rollback.

BEGIN;

CREATE TEMP TABLE _fl_tz_fix (
  beach_id      uuid PRIMARY KEY,
  expected_name text NOT NULL,
  old_timezone  text NOT NULL,
  new_timezone  text NOT NULL
) ON COMMIT DROP;

INSERT INTO _fl_tz_fix (beach_id, expected_name, old_timezone, new_timezone) VALUES
  ('3b948da8-26a0-43f6-8ad3-e99e9cc5174b'::uuid, 'Navarre Beach Pier', 'America/New_York', 'America/Chicago'),
  ('3433ea8e-6528-4c18-8b16-c830bf642568'::uuid, 'Pensacola Pier',     'America/New_York', 'America/Chicago');

DO $guard$
DECLARE
  v_missing    int;
  v_renamed    int;
  v_unexpected int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM _fl_tz_fix f
  LEFT JOIN public.beaches b ON b.id = f.beach_id
  WHERE b.id IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'FL panhandle timezone repair aborted: % of 2 beach ids no longer exist', v_missing;
  END IF;

  SELECT count(*) INTO v_renamed
  FROM _fl_tz_fix f
  JOIN public.beaches b ON b.id = f.beach_id
  WHERE b.name IS DISTINCT FROM f.expected_name;
  IF v_renamed > 0 THEN
    RAISE EXCEPTION 'FL panhandle timezone repair aborted: % id(s) no longer resolve to the audited beach name', v_renamed;
  END IF;

  SELECT count(*) INTO v_unexpected
  FROM _fl_tz_fix f
  JOIN public.beaches b ON b.id = f.beach_id
  WHERE b.timezone NOT IN (f.old_timezone, f.new_timezone);
  IF v_unexpected > 0 THEN
    RAISE EXCEPTION 'FL panhandle timezone repair aborted: % row(s) hold an unexpected timezone; re-audit before applying', v_unexpected;
  END IF;
END
$guard$;

-- Rollback source. Created once and never overwritten: a re-run must not be able
-- to erase the original pre-repair values.
CREATE TABLE IF NOT EXISTS public._backup_beach_timezones_fl_20260820 (
  id           uuid PRIMARY KEY,
  name         text,
  city         text,
  state        text,
  lat          double precision,
  lon          double precision,
  old_timezone text NOT NULL,
  captured_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public._backup_beach_timezones_fl_20260820 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public._backup_beach_timezones_fl_20260820 FROM anon, authenticated;

COMMENT ON TABLE public._backup_beach_timezones_fl_20260820 IS
  'Rollback source for the 2026-08-20 Florida Panhandle beaches.timezone repair. First-capture wins, so a re-run cannot erase it. Safe to drop once the fix is validated in production.';

INSERT INTO public._backup_beach_timezones_fl_20260820 (id, name, city, state, lat, lon, old_timezone)
SELECT b.id, b.name, b.city, b.state, b.lat, b.lon, b.timezone
FROM public.beaches b
JOIN _fl_tz_fix f ON f.beach_id = b.id
WHERE b.timezone = f.old_timezone
ON CONFLICT (id) DO NOTHING;

UPDATE public.beaches b
SET timezone = f.new_timezone
FROM _fl_tz_fix f
WHERE b.id = f.beach_id
  AND b.timezone = f.old_timezone;

DO $verify$
DECLARE
  v_wrong int;
BEGIN
  SELECT count(*) INTO v_wrong
  FROM _fl_tz_fix f
  JOIN public.beaches b ON b.id = f.beach_id
  WHERE b.timezone IS DISTINCT FROM f.new_timezone;
  IF v_wrong > 0 THEN
    RAISE EXCEPTION 'FL panhandle timezone repair failed: % of 2 rows did not land on America/Chicago', v_wrong;
  END IF;
END
$verify$;

COMMIT;

-- ROLLBACK (run manually if this repair needs to be undone):
--
-- BEGIN;
-- UPDATE public.beaches b
-- SET timezone = bk.old_timezone
-- FROM public._backup_beach_timezones_fl_20260820 bk
-- WHERE bk.id = b.id;
-- DROP TABLE public._backup_beach_timezones_fl_20260820;
-- COMMIT;
