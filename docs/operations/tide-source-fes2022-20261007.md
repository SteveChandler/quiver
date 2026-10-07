# Allow `fes2022` in `tide_forecasts.source` (2026-10-07)

## Why

FES2022 model tides shipped to prod in #953 (`a2778c8b7`). The tide cron writes
`source = 'fes2022'`, `station_id = 'FES2022'` for the 50 Baja beaches with no NOAA
station. Prod's `tide_forecasts_source_check` (added in `20251220133000`) only allows
`open-meteo`, `noaa` and `noaa_hilo_interpolated`. As a result, the 2026-10-07 04:00 UTC run:

- rejected every FES2022 upsert;
- recorded `upsert_failed` for station `FES2022`, 50 times;
- failed with `tide coverage under 7 days for 50 beaches` (`cron_runs` id
  `4d80c16b-35fc-4365-a8d9-fefb9ec236b4`).

NOAA beaches refreshed normally (152,019 rows). The Baja tide pages stay `noindex`
until FES rows exist.

No other database object blocks FES rows:
- `v_tide_forecast_latest`, `get_best_times` and `prune_forecasts_retention` do not
  filter on source.
- `compute_session_tide_snapshot` labels only `noaa`/`open-meteo` provenance, so Baja
  sessions get a NULL `tide_data_source`. That is a follow-up, not part of this change.

## Plan

**Target:** production, owner connection `POSTGRES_URL_NON_POOLING` from
`.env.production.local`, using `psql@15` (server is 15.8).

**Objects affected:** one constraint, `public.tide_forecasts.tide_forecasts_source_check`.
No rows are written, updated or deleted.

**SQL:** the two migration files, applied in order:

1. `supabase/migrations/20261007050000_allow_fes2022_tide_source.sql`
   - drops the constraint and re-adds it as `NOT VALID`, with `fes2022` added;
   - needs a momentary ACCESS EXCLUSIVE lock and no table scan;
   - `lock_timeout = 5s`.
2. `supabase/migrations/20261007050100_validate_tide_source_check.sql`
   - `VALIDATE CONSTRAINT` in its own transaction;
   - takes SHARE UPDATE EXCLUSIVE, so reads and writes continue;
   - scans about 1.18M rows / 1.2 GB.

**Why psql and not `supabase db push`:** prod has three tracked versions with no local
file (`20260917191609`, `20260917201732`, `20260929162811`), and the CLI refuses to push
until that drift is repaired. That repair is separate work. Since 2026-08-01, these two
files are the only local migrations prod lacks (checked read-only on 2026-10-07).

**Commands** (from the repo root, on `main` after this PR merges):

```bash
URL=$(grep '^POSTGRES_URL_NON_POOLING=' .env.production.local | head -1 | cut -d= -f2- | tr -d '"')
PSQL=/opt/homebrew/opt/postgresql@15/bin/psql
for f in 20261007050000_allow_fes2022_tide_source 20261007050100_validate_tide_source_check; do
  "$PSQL" "$URL" -X -v ON_ERROR_STOP=1 -f "supabase/migrations/$f.sql" || break
  "$PSQL" "$URL" -X -v ON_ERROR_STOP=1 \
    -v version="${f%%_*}" -v name="${f#*_}" -v body="$(cat "supabase/migrations/$f.sql")" <<'SQL'
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (:'version', :'name', ARRAY[:'body']) ON CONFLICT (version) DO NOTHING;
SQL
done
```

The tracking insert reads from stdin because psql does not interpolate `:'var'` in a
`-c` string. This loop was not run on the scratch database: the auto-mode classifier
blocked it. Only the two migration files and both rollback branches were exercised
there.

**Timing:** any time except the tide cron (Sun/Wed 04:00 UTC). If the first file hits
the 5 s lock timeout, it changes nothing; rerun it.

**Backup artifact:** `~/data/backups/tide_forecasts-schema-20261007.sql`, a schema-only
`pg_dump -t public.tide_forecasts` taken 2026-10-07 05:13 UTC. Its sha256 is
`686aca33e5efedda02c2279c47a27eeb06e3e41277aa46ea3e5d5c8a4d318b25`, and it records the
current three-value constraint. No data changes, so no data backup is needed. The
repo's `database-backup.yml` has not succeeded since 2025-11-03.

**Rollback:** `docs/operations/tide-source-fes2022-20261007-rollback.sql`.
- Branch A (default) restores the three-value list as `NOT VALID` and keeps any
  `fes2022` rows.
- Branch B deletes the `fes2022` rows first, then restores the validated constraint.
  It is destructive and needs its own approval.
- After either branch, remove the two tracking rows.

**Tested** on scratch PostgreSQL 15 (50,000 legacy rows):
- `fes2022` is rejected before the migration;
- file 1 leaves the constraint `convalidated = false`, and file 2 makes it `true`;
- after both files, `fes2022` inserts succeed and other values are still rejected;
- rerunning both files is clean;
- Branch A keeps the FES rows and blocks new ones;
- Branch B removes the FES rows and restores the validated three-value constraint.

## Verify after apply (read-only)

```sql
SELECT convalidated, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conname = 'tide_forecasts_source_check';
-- expect: true, CHECK (... 'fes2022'::text ...)

SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version IN ('20261007050000', '20261007050100');
-- expect: 2 rows
```

The next tide cron run (manual, or Sun 2026-10-11 04:00 UTC) should then write
`fes2022` rows for all 50 Baja beaches, and the run should finish `ok`.
