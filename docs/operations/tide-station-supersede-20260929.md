# Tide station supersede correction (2026-09-29)

**Status: RUN 2026-09-29 16:36 UTC.** A production mutation, approved under
`docs/MIGRATION_SAFETY.md` as
`APPROVE: 831392b6033318587bd5221f278e54953e4ca4e30ba423395067a48d2d031f3b`
(sha256 of the `.sql` file, which is unchanged since approval).

- Backup taken first: `db-backups/tide-forecasts-pre-station-supersede-20260929.dump`
  (workspace root, 33.5 MB, `pg_dump -Fc -t public.tide_forecasts`).
- Preflight matched the reviewed targets: 384, 553 and 648 rows.
- Result: `backed up 1585, remaining 0`.
- Verification: no rows from a non-current station remain. Shipwrecks' next
  25 hours are 25 `noaa` 9410170 rows. No beach has more than one source in
  the next 25 hours. The backup table has no grants to `PUBLIC`, `anon` or
  `authenticated`.
- Drop `private.tide_forecasts_station_supersede_backup_20260929` on or after
  2026-10-29 in a separate, approved step.

- Correction: `docs/operations/tide-station-supersede-20260929.sql`
- Rollback: `docs/operations/tide-station-supersede-20260929-rollback.sql`

## What went wrong

The 2026-09-27 finding named beach `5e8d07ff-786c-4b7e-ab19-53d2b3774e23` as
Bay Head Beach NJ. That id is **Shipwrecks, Coronado CA**
(`shipwrecks-coronado-ca`). Bay Head (`b9627a2a-493e-467f-9521-9081b47512cc`)
has one clean series from station 8532715.

San Diego station 9410170 is correct for Coronado. The fault is that Shipwrecks
holds two station series at the same hours:

| Station | Source | Written | Hours covered |
| --- | --- | --- | --- |
| TWC0405 Point Loma (subordinate) | `noaa_hilo_interpolated` | 2026-09-02 | through 2026-10-02 04:00 |
| 9410170 San Diego, Broadway | `noaa` | 2026-09-16 | 2026-09-16 05:00 – 2026-10-16 04:00 |

Why:

1. The forecasts-refresh cron re-resolves each beach's nearest NOAA station on
   every run (`getNearestTideStation`, 120 km).
2. The Shipwrecks coordinates changed between the 2026-08-30 backup
   (32.6763, −117.1896) and the 2026-09-16 run (now 32.674156, −117.172814).
   No migration and no `admin_audit_log` entry records the change. At the old
   pin TWC0405 was nearest (4.23 km against 4.53 km). At the new pin 9410170 is
   nearest (4.62 km against 5.73 km).
3. The upsert key is `(beach_id, ts, source)`. The new `noaa` rows did not
   replace the old `noaa_hilo_interpolated` rows, so both remain until the old
   rows age out.
4. The tide readers selected by beach and time only, so the series alternated
   between stations every hour.

The same station change happened, without anyone noticing, at two other
beaches. Their overlap is now entirely in the past:

- **La Push, Second Beach WA:** 9442396 changed to 9442388. Stale `noaa` rows
  outlived the change, and the old per-hour "noaa first" rule preferred them
  to the current station.
- **Malibu First Point:** TWC0445 changed to 9410840.

No logged session falls inside any of the three overlap windows. Checked
2026-09-29.

## Contract, shipped in code

`selectTideSeries` in `lib/services/tide-forecast-selection.ts` sets the
contract: **one station per beach per read**.

- The station is the one on the most recently written row.
- Within that station, each UTC hour keeps one row, and direct `noaa` still
  beats `noaa_hilo_interpolated`. Hourly fetch failures fall back to hilo for
  the same station; 30 stations in production have done this.

These readers use it:

- `getTideMetaData`
- sitemap tide coverage
- `fetchCachedHourlyTidePredictions`
- `NOAACOOPSService.fetchCachedTides`
- the intent-page hourly chart
- the daily-call tide samples
- `/api/v1/recommendations`
- the current tide on `/api/forecasts/current`

The SQL readers are not covered: `compute_session_tide_snapshot` (session
insert trigger) and `get_best_times`. They still read every row. That is why
rows must also be clean in the table itself, which is what this correction
does now and the follow-up below would do going forward.

## The correction

**Rule.** For each beach, remove rows whose `station_id` is non-null and
differs from the current station, but only from the first hour the current
station covers onward. History from before the change stays.

**Reviewed targets.** Read-only preflight, 2026-09-29 12:28 UTC.

| Beach | Old → current station | Rows |
| --- | --- | ---: |
| shipwrecks-coronado-ca | TWC0405 → 9410170 | 384 |
| la-push-second-beach-la-push-wa | 9442396 → 9442388 | 553 |
| malibu-first-point-surfrider | TWC0445 → 9410840 | 648 |
| **Total** | | **1,585** |

**Guards built into the script:**

- It needs the session setting
  `app.tide_station_supersede_approved = '2026-09-29-tide-station-supersede-approved'`.
- It refuses to run twice, because the backup table must not already exist.
- It takes `SHARE ROW EXCLUSIVE` on `tide_forecasts`, with a 5 s lock
  timeout. Reads continue while it runs.
- If the per-beach target counts differ in any way from the table above, it
  aborts.
- It copies every target row into
  `private.tide_forecasts_station_supersede_backup_20260929` (access revoked
  from `PUBLIC`, `anon` and `authenticated`), then deletes by id.
- After the delete, it requires exactly 1,585 rows backed up and none left in
  the table.

**Validated 2026-09-29 on a throwaway local Postgres, never production.** The
synthetic data was shaped like the three beaches plus Bay Head as a control:

- Without approval: refused.
- Approved: removed 1,585 rows. Bay Head untouched. Shipwrecks' future is
  9410170 only.
- Rerun: refused.
- Rollback without approval: refused.
- Rollback approved: restored all rows.
- Drifted targets: aborted with no writes.

## Run steps (after approval)

1. **Timing.** Run outside the tide cron (Sun and Wed, 04:00 UTC) and the
   retention prune (daily, 05:00 UTC).
2. **Backup.** Take a fresh backup within 24 h, as `MIGRATION_SAFETY.md`
   requires:
   `pg_dump -Fc -t public.tide_forecasts -f db-backups/tide-forecasts-pre-station-supersede-20260929.dump`
   using the owner connection (`.env.production.local`
   `POSTGRES_URL_NON_POOLING`, psql@15).
3. **Preflight.** Re-run the read-only preflight in
   [Verification](#verification). If the counts moved, stop and re-review. The
   script will abort anyway.
4. **Run the correction:**
   `psql "$URL" -v ON_ERROR_STOP=1 -c "SET app.tide_station_supersede_approved = '2026-09-29-tide-station-supersede-approved'" -f docs/operations/tide-station-supersede-20260929.sql`
5. **Confirm.** Look for the notice `backed up 1585, remaining 0`, then run
   the verification queries.

## Verification

Preflight, and afterwards: every beach should report zero rows from another
station.

```sql
WITH current_station AS (
  SELECT DISTINCT ON (beach_id) beach_id, station_id
  FROM tide_forecasts WHERE station_id IS NOT NULL
  ORDER BY beach_id, created_at DESC, id DESC
), current_span AS (
  SELECT t.beach_id, c.station_id, MIN(t.ts) AS current_from
  FROM tide_forecasts t JOIN current_station c
    ON c.beach_id = t.beach_id AND c.station_id = t.station_id
  GROUP BY 1, 2
)
SELECT t.beach_id, t.station_id, COUNT(*)
FROM tide_forecasts t JOIN current_span s ON s.beach_id = t.beach_id
WHERE t.station_id IS NOT NULL AND t.station_id <> s.station_id AND t.ts >= s.current_from
GROUP BY 1, 2;
```

Afterwards, Shipwrecks' next 25 hours should come from one station only:

```sql
SELECT source, station_id, COUNT(*) FROM tide_forecasts
WHERE beach_id = '5e8d07ff-786c-4b7e-ab19-53d2b3774e23'
  AND ts BETWEEN now() - interval '1 hour' AND now() + interval '24 hours'
GROUP BY 1, 2;
```

## Rollback

This needs separate approval.

`psql "$URL" -v ON_ERROR_STOP=1 -c "SET app.tide_station_supersede_rollback_approved = '2026-09-29-tide-station-supersede-rollback-approved'" -f docs/operations/tide-station-supersede-20260929-rollback.sql`

- It aborts if a later refresh has already written any of the same
  `(beach_id, ts, source)` slots. Those need manual reconciliation.
- It keeps the backup table. Dropping it is a separate approved step once
  the restore is verified. Otherwise drop it 30 days after a successful
  correction.

## Risk

- **Low.** The rows are deterministic NOAA predictions and can be re-fetched.
- No foreign keys reference `tide_forecasts`.
- The code readers already ignore these rows. The correction only changes
  what the two SQL readers see: Shipwrecks until 2026-10-02, and anyone
  backfilling a session at La Push or Malibu inside the old overlap windows.
- Without the correction, Shipwrecks' stale rows age out on 2026-10-02 anyway.

## Follow-up (not applied): supersede at ingestion

This correction is one-off. The next station change at any beach will
recreate the overlap. The code readers handle that, but the SQL readers will
not.

The proposed fix is in the forecasts-refresh cron. After a station group's
rows for a beach are all upserted, delete that beach's rows where
`station_id <> <station>` over the `ts` span just written. That span is
bounded by beach, time and station, and matches zero rows unless a beach's
station changed.

This session's permission policy blocked the edit, because it adds a delete
to a production write path. It needs an explicit go-ahead before anyone
implements it.
