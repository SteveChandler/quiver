# CEDEN ingestion diagnosis

Date: 2026-08-13 (live queries completed 2026-08-14 UTC)

Scope: diagnosis only. No production writes, migrations, commits, or changes to `quiver-native/` were made.

## Executive conclusion

CEDEN is not returning an empty result, and the cron is not failing to write its normal batches. The pipeline currently has three downstream defects:

1. `syncWQSamples` reads `wq_monitoring_stations` with an unpaginated Supabase select. The production table has 5,853 rows, but the live API returns only 1,000 for that query. The latest recorded sample run therefore matched 3,550 of 9,089 CEDEN rows instead of having the full station map available.
2. The stored sample table contains seven future-dated rows for `2026-10-02`, inserted on March 31/April 3. `evaluateWaterQuality` anchors its 30-day window to the maximum stored date, with no `sample_date <= today` guard. On the latest run it therefore evaluated `2026-09-02` onward, saw only those seven rows, and produced 1 `good` beach plus 168 `unknown` beaches.
3. The station query intentionally has no coastal/geographic filter. Of 1,705 valid unique CEDEN stations, only 929 are within the configured 5 km beach radius; 776 are dropped from beach linkage. This is a real coverage limitation, but it is not the reason the table is nearly all `unknown`: the source has thousands of samples and the sample rows are being written.

The immediate cause of the observed “192 rows but almost no usable coverage” is the future-date evaluation anchor. The unpaginated station lookup is a separate high-impact loss in the ingestion funnel and keeps coverage below the catalog size even after the date problem is removed.

## 1. Cron execution and success classification

### Configuration

`vercel.json` schedules all three phases:

| Phase | Schedule | Purpose |
|---|---:|---|
| `stations` | `0 8 1 * *` | Monthly station discovery and matching |
| `samples` | `0 12 * * 2,5` | Tuesday/Friday sample fetch |
| `evaluate` | `30 12 * * 2,5` | Tuesday/Friday beach evaluation |

The route requires a `phase` query parameter and returns HTTP 400 when it is missing. The current route is [water-quality-sync/route.ts:80-89](/Users/stevenchandler/codex-worktrees/qv-redeem/app/api/cron/water-quality-sync/route.ts:80).

### `cron_runs` evidence

There are 124 production `cron_runs` rows for `/api/cron/water-quality-sync`:

| Invocation class | Count | Status | Date range | Evidence |
|---|---:|---|---|---|
| Valid `stations` phase | 3 | 3 `ok` | 2026-06-01 through 2026-08-01 | Latest: 2,175 parsed, 1,157 matched, 2,175 upserted, `errors: []` |
| Valid `samples` phase | 29 | 29 `ok` | 2026-05-05 through 2026-08-11 | Latest: 9,089 parsed, 3,550 matched, 3,543 upserted, `errors: []` |
| Valid `evaluate` phase | 29 | 29 `ok` | 2026-05-05 through 2026-08-11 | Latest: 169 evaluated, 1 good, 168 unknown, `errors: []` |
| Missing/invalid phase | 63 | 63 `error` | 2026-05-07 through 2026-06-03 | All say `Invalid phase: Query param "phase" must be "stations", "samples", or "evaluate"` |

This distinguishes the cases:

- **Never ran:** false. Valid phase rows exist on the expected schedules.
- **Ran and errored:** true for 63 old calls that omitted/invalidated `phase`; false for all 61 valid phase invocations in the observed period.
- **Ran and found nothing:** false for CEDEN. The latest sample run found 9,089 rows and matched 3,550 into the service’s in-memory batch.
- **Ran, found data, failed to write:** not supported by the recent evidence. The latest sample run has no write errors and reports 3,543 successful upserts; the latest evaluation updated 169 rows and has no errors.

There is, however, an observability weakness. The route always returns a success response when the service returns a result, even when `result.errors` is non-empty ([route.ts:95-131](/Users/stevenchandler/codex-worktrees/qv-redeem/app/api/cron/water-quality-sync/route.ts:95)). `withObservedCron` stores `ok` from `Response.ok`, not from the nested result errors ([observability.ts:155-167](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/cron/observability.ts:155)). This is demonstrated by the 2026-06-01 station run: it was `status=ok` despite `errors: ["PacIOOS station fetch error: fetch failed"]`. The error is visible in `summary`, but a dashboard looking only at status would call it healthy.

## 2. Exact live CEDEN query

The query was run against the service’s configured CKAN endpoint and resource:

- Endpoint: `https://data.ca.gov/api/3/action/datastore_search_sql`
- Resource: `15a63495-8d9f-4a49-b43a-3092ef3106b9`
- Characteristics: `Enterococcus`, `Coliform, Fecal`
- Matrix: `samplewater`
- Sample lower bound at query time: `2026-05-16` (90 days)
- Sample limit: `32,000`
- Station limit: `10,000`

The service query text is [water-quality-sync-service.ts:588-595](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/services/water-quality/water-quality-sync-service.ts:588).

### Live source counts

| Exact service query | HTTP | Raw rows returned | Limit hit? |
|---|---:|---:|---|
| CEDEN stations | 200 | 1,706 records | No (`10,000`) |
| CEDEN samples | 200 | 9,266 records | No (`32,000`) |

The first current CEDEN sample row was dated `2026-08-11`; the source is returning current-period data. This rules out “CEDEN returned nothing” and “the sample limit truncated a large result” for the present query.

## 3. Station-to-beach matching

### Station discovery and distance matching

The station parser uses coordinates and exact station-code deduplication. It does not use station names. The relevant code is [water-quality-sync-service.ts:279-325](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/services/water-quality/water-quality-sync-service.ts:279).

Independent replay of the exact CEDEN station query produced:

| Stage | Count | Drop |
|---|---:|---:|
| Raw CEDEN station records | 1,706 | — |
| Valid unique station codes | 1,705 | 1 duplicate code |
| Missing station code | 0 | 0 |
| Invalid/missing parsed coordinates | 0 | 0 |
| Within 5 km of a CA Quiver beach | 929 | — |
| No CA beach within 5 km | 776 | 45.5% of valid stations |

The 167 CA catalog beaches all had coordinates in this replay. The distance threshold is the only material station-matching drop. The service still upserts unmatched stations with `nearest_beach_id = null`; it does not silently discard them at the station upsert stage ([water-quality-sync-service.ts:476-520](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/services/water-quality/water-quality-sync-service.ts:476)).

The high drop rate is explained by the source query: it selects all CEDEN `samplewater` stations with the two analytes, not only coastal/recreational stations. Examples of dropped candidates include `El Toro Park - Muirlands and Los Alisos` (11.7 km from the nearest catalog beach), a river station 255.3 km away, and Baja/Mexico or inland stations much farther away. There is no name-matching step and no state/county/coastal filter beyond assigning every CEDEN station `state_code = "CA"`.

### Current production station table

The live table contains 5,853 rows:

| Station family | Rows | Linked to a beach |
|---|---:|---:|
| `CEDEN-*` | 1,706 | 934 |
| `PACIOOS-*` | 473 | 227 |
| Other legacy source IDs | 3,674 | 2,003 |
| **Total** | **5,853** | **3,164** |

The current table therefore contains 215 distinct linked beach IDs, but it also retains old source rows from before the current CEDEN/PacIOOS implementation. The station sync only upserts; it does not remove or deactivate old source rows.

### The unpaginated lookup loss

`syncWQSamples` loads stations with `.select(...)` and no range/pagination ([water-quality-sync-service.ts:755-781](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/services/water-quality/water-quality-sync-service.ts:755)). Against the live Supabase REST API, that exact query returned 1,000 rows, not all 5,853.

Replaying the current CEDEN sample query against that exact 1,000-row lookup yielded:

| Sample stage | Count |
|---|---:|
| CEDEN raw rows | 9,266 |
| Exact `CEDEN-${StationCode}` matches using only the returned 1,000 stations | 3,614 |
| Match rate | 39.0% |
| Of those, rows whose selected station has `nearest_beach_id` | 3,123 |
| Unique rows after the service’s station/date/analyte dedupe | 3,607 |

For comparison, using the fully paginated 5,853-row station table matched 9,258 of 9,266 current CEDEN rows (99.9%) and produced 9,228 deduped rows. The latest recorded cron run’s `9,089 -> 3,550 -> 3,543` funnel is consistent with the 1,000-row station lookup, not with a source shortage.

The same default row cap affects `evaluateWaterQuality`: its linked-station select returns 1,000 of 3,164 linked station rows and 169 distinct beaches, while the full table contains 215 distinct linked beaches. This is why the latest evaluation reports 169 beaches even before applying the sample date window.

## 4. Filters and windows

### CEDEN filters and limits

The source filters are not over-tight for the current data:

- Two analytes only: `Enterococcus` and `Coliform, Fecal`.
- `MatrixName = 'samplewater'`.
- Samples: lower bound of 90 days, ordered newest first, `LIMIT 32,000`.
- Stations: `TargetLatitude IS NOT NULL`, `LIMIT 10,000`.
- The current exact sample result is 9,266, so the 32,000 limit is not active.

The sample fetch has no upper date bound ([water-quality-sync-service.ts:588-596](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/services/water-quality/water-quality-sync-service.ts:588)). That matters because future-dated rows are accepted and retained.

### Future sample poisoning evaluation

The live `wq_samples` table has 19,637 rows. Seven rows have `sample_date = 2026-10-02`, even though the diagnosis date is August 2026. They were created on March 31 or April 3 and belong to four CEDEN stations (`B-5`, `B-7`, `B-8`, `B-56`), all linked to the Quiver beach `72nd Place`.

The evaluation code selects the maximum stored `sample_date` and subtracts 30 days ([water-quality-sync-service.ts:944-963](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/services/water-quality/water-quality-sync-service.ts:944)). It does not cap the anchor at the current date. Therefore the latest evaluation used:

```text
anchor:  2026-10-02
cutoff:  2026-09-02
```

The seven future rows are the only rows in that window. After deduplication, the one beach with those rows became `good`; the other 168 evaluated beaches had zero samples and became `unknown`. The latest run wrote 169 evaluation rows: 168 `unknown`, 1 `good`. The table has 192 rows because 23 older rows were not touched by that run.

This explains the apparent contradiction: CEDEN currently returns thousands, the sample table contains thousands, the evaluation cron returns `ok`, and the beach table still has 191 unknown rows.

As a date-only counterfactual, using the latest non-future stored sample (`2026-08-06`) would produce a `2026-07-07` to `2026-08-06` window containing 1,581 stored samples, 1,320 linked sample rows, and 96 distinct linked beaches before accounting for the separate pagination problem. This is not a fix or a claim that all 96 are valid beach-posting signals; it isolates the effect of the future anchor.

### Cleanup does not remove future rows

The database cleanup job only deletes samples older than one year ([20260225042354_wq_samples_cleanup_cron.sql:10-14](/Users/stevenchandler/codex-worktrees/qv-redeem/supabase/migrations/20260225042354_wq_samples_cleanup_cron.sql:10)). It does not reject or remove dates after the current date. The exact actor that inserted the seven future rows cannot be proven from the available schema: `wq_samples` has `created_at`, but no ingestion-run ID or source-payload audit column. Their timestamps predate the first valid `cron_runs` sample run on 2026-05-05, so they came from an earlier/unobserved write path or run.

## 5. Writes and error handling

### Evidence of successful writes

- Latest valid sample run: `samplesMatched = 3,550`, `samplesUpserted = 3,543`, `errors = []`.
- The seven-row difference is consistent with the service’s documented dedupe by `(station_id, sample_date, characteristic)`; the current replay also produced a seven-row difference (`3,614 -> 3,607`). It is not evidence of seven rejected inserts.
- Latest evaluation: 169 rows were updated around `2026-08-11T12:30:47Z`; `errors = []`.
- Live RLS/schema grants allow `service_role` insert and update on all three water-quality tables ([water-quality tables migration:114-129](/Users/stevenchandler/codex-worktrees/qv-redeem/supabase/migrations/20260225042342_create_water_quality_tables.sql:114)).

### Error paths

The service does append batch upsert errors to its result ([sample upserts:842-855](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/services/water-quality/water-quality-sync-service.ts:842)). Evaluation does the same for evaluation upserts ([evaluation upserts:1156-1177](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/services/water-quality/water-quality-sync-service.ts:1156)). Those errors are not thrown, and the route still returns HTTP 200. Consequently, a future write failure would be visible in `cron_runs.summary.result.errors` if the summary is inspected, but would still be recorded as `cron_runs.status = 'ok'`.

I found no current evidence of constraint rejection, RLS rejection, or upsert conflict failure. Upsert conflicts are expected behavior: samples use `onConflict = station_id,sample_date,characteristic`; beach evaluations use `onConflict = beach_id`.

## 6. Why the table is 192 rows, not 346

The evaluator does not create one row for every beach. It only evaluates beaches represented by the linked-station query ([water-quality-sync-service.ts:909-942](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/services/water-quality/water-quality-sync-service.ts:909)). The current unpaginated query sees 169 distinct linked beaches; the full current station table has 215 distinct linked beaches; the catalog has 346 beaches total, including 167 CA and 41 HI.

The 192 `beach_water_quality` rows are a historical union of prior evaluation outputs, not a current catalog-wide coverage set. On the latest evaluation, 169 rows were refreshed and 23 older rows remained untouched. Current status counts are 191 `unknown`, 1 `good`, 0 `advisory`, and 0 `closure`.

The five hardcoded chronic-impact IDs are in [water-quality.ts:10-17](/Users/stevenchandler/codex-worktrees/qv-redeem/lib/recommendations/major-event-hold/water-quality.ts:10). The companion `water_quality_held_beaches` table is not present in the live database (`42P01` on read), so the migration in this worktree remains unapplied as expected for this diagnosis.

## 7. City of San Diego Ocean Monitoring alternative

Sources inspected:

- [Official dataset page](https://data.sandiego.gov/datasets/monitoring-ocean-water-quality/)
- [Direct 2020-2029 CSV](https://seshat.datasd.org/monitoring_ocean_water_quality/water_quality_2020_2029_datasd.csv)
- [Companion station coordinates](https://seshat.datasd.org/monitoring_ocean_water_quality/reference_stations_water_quality.csv)
- [2022-2023 receiving-waters report](https://www.sandiego.gov/sites/default/files/2024-12/compressed_2022-2023-biennial-receiving-waters-monitoring-and-assessment-report-for-ploo-and-sboo.pdf)

### Dataset shape and freshness

The direct CSV is public and required no authentication. The downloaded file had 196,579 rows, 42,103 unique sample IDs, and 105 unique station codes. The companion file has 157 coordinate rows; all 105 station codes present in the 2020-2029 data have coordinates.

| Measure | Count/value |
|---|---:|
| Projects | SBOO 93,272; PLOO 103,307 |
| FIB rows (`ENTERO`, `FECAL`, `TOTAL`) | 73,347 |
| FIB rows with non-empty values | 73,265 |
| FIB numeric values | 73,249 |
| FIB units | All non-empty rows: `CFU/100 mL` |
| Data date range | 2020-01-01 through 2025-12-30 |
| HTTP `Last-Modified` | 2026-08-11 |

The file was refreshed at the transport layer on August 11, but its latest sample is December 30, 2025—approximately 7.5 months stale for a current beach-posting signal as of this diagnosis.

### Shoreline versus offshore

This is a mixed receiving-waters dataset, not a pure swim-zone feed. The official description says the Ocean Monitoring Program measures the effects of treated wastewater effluent across a large area extending from the shoreline to approximately 10 miles offshore and depths over 500 m. The official receiving-waters report distinguishes weekly shoreline surf-zone stations from kelp and offshore stations.

For the station codes in this CSV:

| Category | Stations/rows |
|---|---:|
| All data station codes | 105 |
| Recognizable shoreline codes (`S*`/`D*` set) | 21 stations; 20,524 FIB rows |
| Non-shoreline/kelp/offshore FIB rows | 52,823 |
| SBOO shoreline stations (`S4,S5,S6,S8,S9,S10,S11,S12`) | 8 stations; 9,343 FIB rows |
| SBOO non-shoreline/kelp/offshore FIB rows | 28,285 |

Thus only about 28.0% of all FIB rows are from the recognizable shoreline station set, and only about 24.8% of SBOO FIB rows are from the eight California-side SBOO shoreline stations. The remaining values are relevant to receiving-water/outfall monitoring but should not be presented as direct beach postings.

### Geolocation and Quiver matching

Matching the 105 data stations to the 167 CA Quiver beaches by nearest haversine distance produced:

| Match stage | Count |
|---|---:|
| Data stations with coordinates | 105/105 |
| Within 5 km of a CA Quiver beach | 47/105 (44.8%) |
| Recognizable shoreline stations within 5 km | 18/21 |
| SBOO shoreline stations within 5 km | 8/8 |

The held-beach region is directly represented, but not uniformly:

| City station | Nearest Quiver beach | Distance |
|---|---|---:|
| S12 | Imperial Beach | 0.796 km |
| S6 | Imperial Beach Pier | 1.429 km |
| S8 | Silver Strand State Beach | 1.149 km |
| S9 | Hotel Del Coronado | 0.435 km |

S4, S5, S10, and S11 are also within 5 km, but the current Quiver catalog’s nearest-beach result for them is Tijuana Sloughs. The data therefore has useful spatial proximity for four of the five hardcoded held-beach names, while `Coronado North Jetty` does not have a direct nearest-station result in this simple 5 km match.

### Viability assessment

**Viable as a supplemental historical/regional source; not viable as a direct replacement for current beach postings.**

Why it is useful:

- Public, direct CSV, no auth, and an explicit station-coordinate companion file.
- The FIB parameters and units align conceptually with the CEDEN pipeline.
- SBOO shoreline stations are directly relevant to Imperial Beach, Silver Strand, and Coronado-area holds.

Why it is not equivalent to beach postings:

- The current file stops at 2025-12-30.
- Most rows are kelp/offshore/outfall receiving-water samples, not surf-zone samples.
- Station sampling is weekly/monthly/quarterly by station type, not a uniform daily beach-status feed.
- Qualifiers (`<`, `>`, `e`, `LA`, `ND`, `NS`) carry meaning and would need to be preserved; treating blank or qualified values as ordinary numeric samples would distort criteria evaluation.
- A station-to-beach distance proxy does not establish that a sample is a current county/state recreational beach posting.

## Ranked fixes

This is a diagnosis ranking, not an implementation plan or authorization to change production.

1. **Reject future samples and bound evaluation by real time.** Add an upper bound at ingestion and ensure evaluation uses `min(max(sample_date), current_date)` or otherwise excludes future dates. Remove/quarantine the seven `2026-10-02` rows only through an approved data-cleanup procedure; no cleanup was performed here. This is the immediate cause of the 191-unknown result.
2. **Paginate or otherwise scope every station read.** `syncWQSamples` and `evaluateWaterQuality` must not rely on the Supabase default 1,000-row response. The current table is 5,853 rows, with 3,164 linked rows. Also decide whether the 3,674 legacy source rows should be excluded/deactivated; their presence makes an arbitrary 1,000-row cap materially worse.
3. **Make evaluation’s sample reads complete and bounded.** The evaluator batches station IDs, but each `.in(...)` read still needs a response-size/pagination strategy and an explicit upper date bound. A direct local replay of the current 500-ID `.in` request produced a 19,706-character request and `HeadersOverflowError`; historical cron summaries did not record this error, so runtime-specific behavior remains unresolved and should be verified before implementation.
4. **Separate coastal recreational stations from broad CEDEN station discovery.** The current query returns inland, river, lagoon, Baja, and other non-posting monitoring sites. Keep them if needed for provenance, but do not count them as beach coverage. The 5 km match currently links 929/1,705 stations and is a proxy, not a posting relationship.
5. **Make cron health reflect nested result errors.** Return a non-2xx response or use `statusForResult` when `errors.length > 0`; otherwise `cron_runs.status = ok` can coexist with a partial source or write failure. Preserve the full phase counters in a durable summary.
6. **Use the San Diego CSV selectively, if desired.** Ingest only identified shoreline/surf-zone station codes, preserve qualifiers, record station/project/depth provenance, and label it as receiving-water context. Do not combine offshore values with beach-posting status without a separate policy and validation.

## What could not be determined

- The exact actor or job that inserted the seven future `2026-10-02` rows cannot be identified from the current schema. Their `created_at` values predate the first valid `cron_runs` sample record, but there is no ingestion-run/audit foreign key.
- The 63 invalid-phase cron calls’ original caller/configuration cannot be identified from `cron_runs`; the route captured the error and query-free summary, not Vercel deployment/request metadata.
- The 500-ID `.in` header overflow reproduced from the local Node/Supabase client, but the historical `evaluate` summaries did not show it. The difference between that replay and the recorded runtime is unresolved.
- The City dataset’s station file provides coordinates but not a machine-readable shoreline/kelp/offshore type field. The station classification above uses the official report’s station-code descriptions plus the dataset’s codes; it should be encoded explicitly before production use.

## Validation

The data-correctness verifier was run on the live evidence snapshot. Verdict: `WATCH`, because the live UTC window includes a partial current day; source counts and reconciliations passed. No unit or E2E tests were changed or run because this was diagnosis only.
