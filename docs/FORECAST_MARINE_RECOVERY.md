# Marine cache recovery — 2026-09-09

Local patch on `orch/marine-cache-recovery-20260909`, based on `abd266af7dcbd9b6c03864262b01d67424ac3bcb`. Paired with Seaside `orch/ops-recovery-20260909` (base `bb2c480e515a3c0de89fcf7294c2d4b3fdd69501`). No deployment, production writes, migrations, schedules, or flags changed.

## Verified failure and bounded fix

Production's existing `/api/cron/forecasts/refresh?source=marine&maxBeaches=130` runs hourly. Read-only inspection found 495 coordinate-bearing beaches: 107 had no marine-cache entry, 388 had stale entries, none were fresh. The route always selected missing entries before stale entries and stopped at its time budget. Repeated no-data beaches could monopolize the next invocation. The new mocked route regression reproduces that behavior against the original source.

The existing `cron_runs` outcome now carries additive `marineCoverage` evidence. The next run resumes after `summary.result.marineCoverage.lastAttemptedBeachId` in a stable beach-ID order, and skips only fresh, usable NDBC/CDIP observations. The wind-capable latest-row view is not used as proof of wave freshness; timestamp-bounded, paginated reads validate the actual wave fields and source time. Only attempted beaches advance the cursor; zero-time-budget runs preserve it. The outcome helper reports failed persistence to this route, which returns 503 with `cursor_write_failed` and retained wave totals. Other callers retain best-effort telemetry by default. Cursor reads ignore rows without a saved cursor. No new table or scheduler exists. A hard process kill before outcome persistence can replay a batch, but cannot make it healthy.

Marine observations must have finite wave height/period and source timestamps within 12 hours, matching the hazard consumer's freshness horizon. Observations and persistence projections retain observation time in the cache `created_at` field, so retries cannot renew stale wave evidence. Wind-only rows retain their existing write timestamp. Wave units, the persistence projection formula, distance limit, and hazard calculations are unchanged. This timestamp behavior is an explicit compatibility correction for wave-cache freshness, not a new model issuance field.

CDIP fallback consumes the existing `fetchBuoyDataWithDiagnostics`/`CDIPSkipReason` contract. It tries at most one alternate station within the existing 80 km radius, excluding the first station. Invalid/empty points do not stop the alternate attempt, and malformed points do not discard valid points from the same station. `providerOutcomes` records the existing safe outcome labels, never raw provider messages. Existing adapter-level transport retries/circuit breaking remain in force.

Valid writes survive another beach/provider/write failure. `totals` remains compatible; `marineCoverage` adds expected/actual/attempted beach counts, cursor, rejection counts and provider outcomes. An incomplete selected batch now returns HTTP 503 with the retained totals instead of a misleading HTTP 200. Fully fresh/no-work marine invocations remain successful. Tide/sun behavior is unchanged.

## Evidence and limitations

Vercel production request `pt4qt-1788951608347-02d4e7617dc8` selected 130 beaches and returned 200. Its bounded log excerpt had 40 messages containing 404 (28 labeled CDIP, 12 referencing api.weather.gov); these are log-message counts, not independent failed-source counts. The NDBC station index returned HTTP 200 with 1,945 records, 1,045 marked realtime-enabled. These observations establish neither a universal provider outage nor that every unmapped beach has an eligible nearby wave station.

Seaside's read-only follow-up still found derived coverage 0/163 (161 missing marine inputs, two stale) and HRRR 418/442. No live recovery is claimed. Tide gaps and existing rejected NWS office/zone scopes remain separate recovery conditions.

## Operator recovery and rollback

After review and separate release authorization, promote the web patch through the normal main → prod flow and deploy the paired Seaside patch using its existing scripts. No migration is required. Observe natural hourly marine runs: cursor progress, attempted count, positive wave coverage, bounded CDIP retry outcomes, and retained totals. Allow a full inventory traversal; inspect missing/stale/tide rejection counts at the next natural six-hour hazard run. Do not mark absent risk as low or relax freshness to turn readiness green.

If batches do not advance, inspect the existing cron outcome write/read path. If a station remains unavailable, inspect its safe diagnostic status and existing station mapping; do not bulk fabricate/cache empty waves or expand the distance threshold. A reviewed code rollback is possible independently in each repo; leave the additive JSON evidence in place. Rolling back the wave producer reinstates its old freshness behavior, so continue to treat source readiness as unverified until new usable evidence arrives.

## Validation

See the paired Seaside `reports/operational-reliability-20260908/RECOVERY.md` for exact command results, clean Python smoke evidence, skips, build setup failures and the final release limitations. Reviewed the existing tide-route unit test and cron outcome/observability tests; no browser UI or device behavior changed, so no browser E2E or simulator tests were added.


## Follow-up review fixes

Four reproduced findings are fixed: wind-only freshness, unacknowledged cursor persistence, malformed CDIP fallback, and the paired Seaside producer's duplicate Sentry event. Tests now execute the real outcome helper; two cases also execute the real Supabase/PostgREST client with mocked HTTP. The cursor insert is attempted once: an ambiguous or failed acknowledgement degrades this invocation, and the next natural run resumes from the last acknowledged cursor. Successful wave upserts remain intact. Do not retry non-idempotent ledger inserts blindly.

No schema or numerical forecast changes were needed. The freshness scan uses observed NDBC/CDIP rows from the last 12 hours, a stable ID order and 1,000-row pages; it does not rely on cache-write time. The existing three-hour refresh window still determines eligibility. Current-revision offline verification and remaining production validation are recorded in the paired recovery note.

## Release verification

The operator authorized committing/pushing to main and preparing the main-to-prod PR on 2026-09-09. Existing release PR #709 also includes earlier pending changes; this task does not merge that PR. Seaside is paired through its recovery PR and authorized deployment.

Final `VERCEL_ENV=preview yarn build` passed on Node 22 (84.31s), using only existing public build configuration in the child environment. Live NDBC validation at 12:39:01Z executed the current parser and route usability guard: stations 46254 (0.8 m / 7 s) and 46225 (1.6 m / 10 s) retained identical numerical values and their 10:56Z/11:56Z source timestamps. No forecast or user data was written by the trace. Production cron behavior changes only after the pending main-to-prod promotion; a Ready preview is not evidence of recovered production hazard coverage.
