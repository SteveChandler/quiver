# PLAN: Repair wrong `beaches.timezone` rows and close the mechanism (2026-08-20)

Per `docs/MIGRATION_SAFETY.md` Production Execution Protocol.

**Status: APPLIED to production 2026-08-20.** See the EXECUTED record at the
bottom of this file. Everything above it is the plan as approved.

## Finding

`beaches.timezone` disagreed with the stored coordinates on **11 of 346** rows,
in two directions, from one root cause.

**Reported (9 rows, `America/Los_Angeles` → correct zone):**

| beach | city, state | stored | correct | error |
|---|---|---|---|---|
| Galveston – 61st Street Pier | Galveston, TX | America/Los_Angeles | America/Chicago | −2h |
| Galveston – Pleasure Pier | Galveston, TX | America/Los_Angeles | America/Chicago | −2h |
| Crystal Beach | Crystal Beach, TX | America/Los_Angeles | America/Chicago | −2h |
| Packery Channel Jetties | Corpus Christi, TX | America/Los_Angeles | America/Chicago | −2h |
| Bob Hall Pier | Corpus Christi, TX | America/Los_Angeles | America/Chicago | −2h |
| Mustang Island State Park | Corpus Christi, TX | America/Los_Angeles | America/Chicago | −2h |
| Padre Island NS – South Beach | Corpus Christi, TX | America/Los_Angeles | America/Chicago | −2h |
| Robert Moses State Park | Babylon, NY | America/Los_Angeles | America/New_York | −3h |
| Smith Point County Park | Shirley, NY | America/Los_Angeles | America/New_York | −3h |

**Found while verifying, outside the reported scope (2 rows, opposite direction):**

| beach | city, state | stored | correct | error |
|---|---|---|---|---|
| Navarre Beach Pier | Navarre, FL | America/New_York | America/Chicago | +1h |
| Pensacola Pier | Pensacola Beach, FL | America/New_York | America/Chicago | +1h |

Both sit ~180 km west of the Apalachicola River, the Eastern/Central boundary in
Florida. They were collateral damage from the same blanket state-based repair
described below and have read an hour fast since 2026-02-02.

## Root cause

`20260113200000_add_beach_timezone.sql` created the column as
`TEXT DEFAULT 'America/Los_Angeles'`. Any beach-insert migration that omits
`timezone` silently files the beach in Pacific time.

`20260202110000_fix_east_coast_timezones.sql` repaired the rows that existed on
2026-02-02 by matching on `state` — a one-shot repair against a standing default,
and it over-applied `America/New_York` to the whole of Florida.

Both later insert migrations omit the column entirely (`grep -c timezone` → 0):

- `20260526194000_add_long_island_beginner_beaches.sql` → the 2 NY rows (created 2026-05-26)
- `20260803120919_add_texas_beaches.sql` → the 7 TX rows (created 2026-08-03)

Confirmed against `beaches.created_at`: every TX/NY beach created **before**
2026-02-02 is correct; every one created **after** is wrong. This will recur on
the next batch of beaches unless the default is removed.

## Exact SQL

Three files, applied in timestamp order. Each carries its own `BEGIN;`/`COMMIT;`,
its own preconditions, and its own rollback statement. No `DELETE`, `TRUNCATE`,
or `DROP` of any user table anywhere.

1. `supabase/migrations/20260820120000_fix_gulf_and_long_island_beach_timezones.sql`
   — the reported 9 rows. Keyed on `beaches.id`; names carried only as an
   assertion that each id still resolves to the audited beach. Aborts if any id
   is missing, renamed, or holds an unexpected value. Prior values captured in
   `public._backup_beach_timezones_20260820` (first-capture-wins, so a re-run
   cannot erase the rollback source).
2. `supabase/migrations/20260820120100_guard_beach_timezone_default.sql`
   — schema guard, no data rows modified: `DROP DEFAULT`, `SET NOT NULL`, and
   `CHECK (timezone <> 'America/Los_Angeles' OR lon IS NULL OR lon <= -114)`.
   Preflight aborts with a readable message if 120000 has not been applied.
3. `supabase/migrations/20260820120200_fix_florida_panhandle_beach_timezones.sql`
   — **outside the reported scope.** The 2 Florida Panhandle rows, isolated in
   their own file so they can be approved, deferred, or deleted independently.

### Why `-114`

The `America/Los_Angeles` zone's true eastern edge is the California/Arizona
border at roughly −114.13, so the bound cannot reject a legitimate row. All 9
broken rows sat between −97.33 and −72.84 and would have been rejected at insert
time. The easternmost surviving Pacific beach is K-40 (Puerto Nuevo, Baja
California) at −116.91 — about 3° of headroom.

## Rejected: deriving `timezone` from lat/lon in the database or via `getTimezoneFromCoords`

`lib/utils/timezone-utils.server.ts` imports **`geo-tz/now`**, a dataset variant
that merges IANA zones sharing a current offset. Verified against the live table
on 2026-08-20:

| coordinate | `geo-tz/now` (what `getTimezoneFromCoords` returns) | full `geo-tz` | stored |
|---|---|---|---|
| Crash Boat, PR | `America/Caracas` | `America/Puerto_Rico` | `America/Puerto_Rico` |
| Alfonsos, Baja | `America/Los_Angeles` | `America/Tijuana` | `America/Los_Angeles` |

A backfill or constraint driven by `getTimezoneFromCoords` would rewrite all 19
Puerto Rico rows to `America/Caracas` — correct offset, wrong zone identity — and
could never produce `America/Tijuana`. It is right for runtime local-time math
and wrong as a source of persisted truth. Postgres cannot call geo-tz at all, so
a coordinate-derived `CHECK` is not available either.

Coordinate checking is therefore done out-of-band, against the **full** geo-tz
dataset, by `scripts/audit-beach-timezones.ts` (read-only; `--fail-on-mismatch`
exits 1, suitable for a scheduled or pre-merge check). It separates real defects
from harmless aliases by comparing actual local time across a 400-day window:

- `MISMATCH` — the two zones report different local times. Real bug.
- `ALIAS` — different name, identical local time throughout. Cosmetic today.

## Target connection / role

Production Supabase project `vawdnbbgawichorsjiwe` (the shared prod/dev DB), via
the owner connection string `POSTGRES_URL` from `.env.production.local`, executed
with `psql -v ON_ERROR_STOP=1 -f <file>` per file, plus a tracking row per file
in `supabase_migrations.schema_migrations`.

## Objects affected

- `public.beaches` — `timezone` UPDATEs on 9 rows (+2 if 120200 is approved);
  column default dropped, `NOT NULL` set, one `CHECK` added.
- `public._backup_beach_timezones_20260820` — created; 9 audit rows.
- `public._backup_beach_timezones_fl_20260820` — created; 2 audit rows (120200 only).
- `supabase_migrations.schema_migrations` — two or three tracking rows.

## Backup artifact

Before any mutation:

```
pg_dump "$POSTGRES_URL" --table=public.beaches -F c \
  -f ~/Desktop/dev/db-backups/beaches-pre-timezone-repair-20260820.dump
```

## Pre-apply verification (read-only, run against prod first)

```sql
-- 1. The 9 reported rows are still exactly as audited. Expect 9 rows, all America/Los_Angeles.
SELECT id, name, city, state, lat, lon, timezone
FROM public.beaches
WHERE id IN (
  '13ba376d-efd5-4e4e-af12-85bfeb2c17bc','cc0b9ee8-0efc-4f78-9049-48a99e0d2c52',
  'a3f9b33e-6b29-4b41-8024-3f7cf1eb66c8','55c7c5dd-1979-410a-bf39-ce3c52e29166',
  '04940f92-f611-448d-acd3-a6456ca8b6de','d85492b8-31ed-4dd8-af53-4284e9456be9',
  '14907560-8c92-4d2e-997b-9661e97b0751','22696f11-3897-4fa6-b266-2f52dae4d5ac',
  '144b902f-4766-4bfa-a0ed-db41ade6a704'
)
ORDER BY state, name;

-- 2. Nothing BEYOND the 9 would trip the new CHECK. Expect exactly those 9 rows.
SELECT id, name, state, lon, timezone
FROM public.beaches
WHERE timezone = 'America/Los_Angeles' AND lon IS NOT NULL AND lon > -114;

-- 3. NOT NULL is satisfiable. Expect 0.
SELECT count(*) FROM public.beaches WHERE timezone IS NULL;

-- 4. Baseline distribution. Expect LA 213, NY 69, HI 41, PR 19, Chicago 4 (346 total).
SELECT timezone, count(*) FROM public.beaches GROUP BY 1 ORDER BY 2 DESC;
```

Also run `yarn tsx scripts/audit-beach-timezones.ts` — expect 11 MISMATCH, 8 ALIAS.

## Post-apply verification

```sql
-- 1. Expect 0 rows.
SELECT id, name, state, timezone
FROM public.beaches
WHERE timezone = 'America/Los_Angeles' AND lon > -114;

-- 2. Expect Chicago 11 (13 with 120200), New_York 71 (69 with 120200),
--    Los_Angeles 204, Honolulu 41, Puerto_Rico 19; 346 total.
SELECT timezone, count(*) FROM public.beaches GROUP BY 1 ORDER BY 2 DESC;

-- 3. Rollback source is populated. Expect 9 (and 2).
SELECT count(*) FROM public._backup_beach_timezones_20260820;
SELECT count(*) FROM public._backup_beach_timezones_fl_20260820;

-- 4. Guards are live. Expect no default, is_nullable = NO, and the constraint present.
SELECT column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'beaches' AND column_name = 'timezone';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.beaches'::regclass
  AND conname = 'beaches_pacific_timezone_longitude_check';

-- 5. Tracking rows present.
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version LIKE '202608201%' ORDER BY version;
```

Then `yarn tsx scripts/audit-beach-timezones.ts --fail-on-mismatch` — expect
**0 MISMATCH**, 8 ALIAS, exit 0 (2 MISMATCH if 120200 is not applied).

## Rollback

Each migration embeds its own rollback block. Order matters: `20260820120100`'s
`CHECK` forbids `America/Los_Angeles` east of −114, so it must be dropped before
`20260820120000`'s rollback UPDATE can run. Verified: without that step the
rollback is rejected by the constraint.

## Evidence: tested against a real Postgres

All three files were applied to a throwaway `postgres:15` container seeded with
the 14 relevant production rows plus one row inheriting the column default. The
local dev database and production were not touched.

| check | result |
|---|---|
| 120000 applies; 9 rows land on the correct zone | pass |
| 120000 re-run is a no-op **and preserves the 9 backup rows** | pass (first version of this migration failed here and was fixed) |
| 120100 aborts with a readable message while a default-inheriting TX row exists | pass |
| 120100 applies once the data is clean | pass |
| new TX beach with `timezone` omitted — the exact 2026-08-03 bug | rejected by `NOT NULL` |
| new TX beach explicitly set to `America/Los_Angeles` | rejected by the `CHECK` |
| new TX beach with `America/Chicago` | accepted |
| new Baja beach (−116.9) and new CA beach (−117.2) on `America/Los_Angeles` | accepted |
| 120200 applies, re-runs clean, preserves its 2 backup rows | pass |
| documented rollback restores the 9 prior values | pass |
| rollback attempted without dropping the `CHECK` first | rejected, as documented |

`yarn typecheck` passes with `scripts/audit-beach-timezones.ts` added.

## Not addressed here

- **8 Baja California rows carry `America/Los_Angeles` where the canonical zone
  is `America/Tijuana`.** Identical offset and identical DST rules today (the
  northern Mexican border municipalities kept US DST after Mexico's 2022
  abolition), so no user-visible time is wrong. The audit reports them as ALIAS.
  Worth a follow-up, not worth a production write today — and it would diverge
  into a real bug only if Mexico changes those rules.
- **A `CHECK` for the Florida Eastern/Central boundary** (`state = 'FL' AND
  lon < -85 ⇒ America/Chicago`) was considered and left out. The generic
  longitude guard cannot catch it, but a wider Eastern-zone bound would
  false-positive on a future Great Lakes spot (Michigan is Eastern at −86.4).
  `scripts/audit-beach-timezones.ts` covers this case generically instead.
- **`lib/utils/regional-forecast-utils.ts` majority-vote timezone resolution**
  (`resolveRegionTimezone`, landed in 43ad0b37d) is deliberately left in place.
  It is a reasonable defence regardless of this data fix; revisiting it is a
  separate change. Its `if (!beach.timezone) continue;` guard becomes dead once
  `NOT NULL` is enforced, but is harmless.

---

## APPROVAL

Approved by Steven in session on 2026-08-20: "APPROVE — apply all three to
production". Plan text sha256 at approval time: `4ef48c8768a5`.

---

## EXECUTED 2026-08-20 06:02-06:14 PT

Applied to production `vawdnbbgawichorsjiwe` via
`psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f <file>` (session pooler,
port 5432 — the transaction pooler on 6543 is unsuitable for DDL).

| step | result |
|---|---|
| `pg_dump --table=public.beaches -F c` (pg_dump 15.14 vs server 15.8) | `beaches-pre-timezone-repair-20260820.dump`, 368K, archive listing verified |
| Pre-apply verification | matched baseline exactly: LA 213 / NY 69 / HI 41 / PR 19 / Chicago 4, 0 NULL, 0 tracking rows, neither backup table present |
| `20260820120000` | `UPDATE 9`, backup captured 9, postcondition passed |
| `20260820120100` | default dropped, `NOT NULL` set, CHECK added |
| `20260820120200` | `UPDATE 2`, backup captured 2, postcondition passed |
| Tracking rows | 3 inserted into `supabase_migrations.schema_migrations` with full file text in `statements[]` |
| Post-apply verification | 0 Pacific rows east of −114; LA 204 / NY 69 / HI 41 / PR 19 / Chicago 13; 346 total; backups 9 and 2; `column_default` empty, `is_nullable = NO`, constraint present |
| `scripts/audit-beach-timezones.ts --fail-on-mismatch` | **0 MISMATCH**, 8 ALIAS, exit 0 |

### Code changes the NOT NULL forced

Regenerating types surfaced two live beach-insert paths that the pre-apply
survey missed — the original grep for `from("beaches")` with `insert` on the
same line does not match multi-line call chains. Both omitted `timezone` and had
been silently creating Pacific-time beaches; after `NOT NULL` they would have
failed at runtime:

- `app/api/beaches/route.ts` POST (admin-only) — beach creation
- `actions/admin/beaches.ts` `createBeach` — admin beach creation

Both now derive the zone from the supplied coordinates via a new
`findCanonicalTimezoneFromCoords` in `lib/utils/timezone-utils.server.ts`, which
uses the **full** geo-tz dataset rather than `geo-tz/now`, and reject the write
if the coordinate cannot be resolved rather than defaulting. Also updated:
`lib/utils/beach-defaults.ts` (`timezone: null` → `DEFAULT_TIMEZONE`) and six
test files whose beach fixtures omitted the column.

Confirmed there are no other writers: no DB function inserts into `beaches`, no
user triggers on the table, and neither `seaside` nor `quiver-native` writes it.

### Verification of the code changes

- `yarn typecheck` — clean
- `yarn test:unit` — 1344 suites passed, 0 failures (17,119 tests)
- `npx jest __tests__/lib/utils/timezone-utils.test.ts` — 64 passed, including 4
  new cases covering the canonical-vs-merged distinction and the repaired beaches
- `eslint` on all four changed source files — clean

### Types regeneration carries pre-existing drift

`types/database.generated.ts` grew by 497 lines. Only part of that is this work
(`timezone: string | null` → `string`, plus the two backup tables). The rest is
drift from migrations already applied to prod whose types were never
regenerated: `beach_traffic_weights`, `county_beach_advisories`,
`county_beach_advisory_ingest_state`, `county_beach_advisory_runs`,
`water_quality_held_beaches`, `zz_luna_test`, and the
`try_insert_system_feed_post` function. The file now matches production.

`zz_luna_test` existing on production is worth a look separately.

---

## POST-APPLY REVIEW (2026-08-20, five passes)

Reviewed the shipped work in five passes with different lenses. Three real
defects found and fixed, all in the code written during this change, none in the
applied SQL. Production data was re-verified and is correct.

### Fixed

**1. Both admin UPDATE paths wrote new coordinates without recomputing the
timezone.** `actions/admin/beaches.ts::updateBeach` and the `if (id)` branch of
`app/api/beaches/route.ts` set `lat`/`lon` and left the stored zone behind — the
same defect class this whole change exists to repair. An admin nudging a beach
across a boundary would have silently stranded it, exactly as the Aug-16
coordinate wave moved 121 beaches. Both now resolve from the coordinates being
written. `updateBeach` also handles a partial lat-only or lon-only edit by
combining the submitted value with the stored one, and refuses if neither
resolves.

**2. `beach-defaults.ts` fabricated a timezone for partially-selected rows.**
Making the column `NOT NULL` forced `getBeachDefaults()` from `timezone: null` to
`timezone: DEFAULT_TIMEZONE`. `components/map-view.tsx::resolveViewedMapTimezone`
gates on timezone *presence* (`isTimeZone(beach.timezone)`), so a fabricated
value would be trusted as real and beat the device-timezone fallback.
`actions/beach/beach-state-actions.ts` (the `/beaches/usa/[state]` map) did not
select the column; it now does, so the real value flows.

*Severity, stated accurately:* latent, not live. `StateMapView` does not reach
`resolveViewedMapTimezone`, and `rankBeaches` does not read `timezone`, so no
user saw a wrong value. The fix is still correct — an object typed as carrying
real data should not carry an invented default — but nothing was broken in
production. An earlier draft of this note overstated it.

**3. Audit script could under-report and could fail CI on dead rows.** Sampling
stepped 6 hours, wide enough to miss two zones that share a DST date but shift at
different local times — that pair would score as ALIAS instead of MISMATCH. Now
hourly (still ~1.2s for 346 beaches). It also read soft-deleted beaches; it now
filters `deleted_at IS NULL` so `--fail-on-mismatch` cannot be tripped by a row
no surface reads.

### Checked and found clean

- **Migration replay.** Both upstream insert migrations
  (`20260526194000`, `20260803120919`) use explicit UUIDs with
  `ON CONFLICT (id) DO NOTHING`, so `20260820120000`'s id/name guards are
  satisfied on a fresh `db reset` and will not abort a replay.
- **Seed scripts.** `scripts/seed_beaches_from_csv.mjs` inserts beaches, but
  writes `latitude`/`longitude`/`location` — columns that do not exist on
  `beaches`. It was already broken before this change; `NOT NULL` did not break
  it. Left alone as out of scope.
- **Other writers.** No DB function inserts into `beaches`, no user triggers on
  the table, and neither `seaside` nor `quiver-native` writes it.
- **Live docs.** No non-archive doc asserts the old default or nullability.
- **Production data.** Re-verified: 346 beaches, 0 with `America/Los_Angeles`
  east of −114, 0 NULL, 0 soft-deleted, audit exit 0.

### Known, not fixed

`yarn test:unit` prints "A worker process has failed to exit gracefully" once the
admin beaches suite grows by ~3 tests. Isolated: replacing the new tests with
three trivial `await import("@/actions/admin/beaches")` probes reproduces it, so
it is a pre-existing leak in that module graph amplified by `jest.resetModules()`
plus dynamic re-imports, not the test content. The suite passes either way
(1344 suites, 17,122 tests, 0 failures). Filed as a separate task.

Considered and rejected: a `CHECK (length(timezone) > 0)` to bar an empty-string
zone. Real failure mode for `AT TIME ZONE`, but no row has one, only a script
explicitly writing `''` could create one, and it would mean another approved
production DDL for negligible gain.

### Verification of the review fixes

- `yarn typecheck` — clean
- `yarn test:unit` — 1344 suites, 17,122 tests, 0 failures
- 3 new write-path regression tests in `__tests__/actions/admin/beaches.test.ts`,
  confirmed to FAIL when the update-path fix is reverted and pass when restored
- `eslint` on all six changed files — clean
- `scripts/audit-beach-timezones.ts --fail-on-mismatch` against prod — exit 0
