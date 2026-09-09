# Marine cache recovery — 2026-09-09

Latest local follow-up: [bounded preflight repair and operator handoff](#bounded-preflight-repair-and-operator-handoff). Earlier sections are historical release evidence.

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


## Bounded preflight repair and operator handoff

**Local patch verified; production recovery is still incomplete.** Branch `orch/marine-preflight-repair-20260909`, base/main `ec9fce6bb2a58f4ae7268c2e2fc3f9878610af61`, worktree `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/marine-preflight-repair-20260909`. Production branch remains `0bb186cb3f5614b23899a0bf85c168647f3e7e3f`. Implementation used this Codex session's inherited model/reasoning; no model override or subagents. No commit, push, deployment, manual cron, migration, or production write was performed. Primary checkout dirty work was inspected and preserved.

Seaside was inspected read-only at `/Users/stevenchandler/Desktop/dev/.worktrees/seaside-ops-release-20260909`, branch `orch/ops-release-20260909`, HEAD `b41687b5ad96b4436da383a2e6010c134a1a1b96`. Its two existing untracked post-promotion evidence files remain untouched. Its active Docker entrypoint remains `cron_api:app`; this patch changes only Web runtime code. The active marine Web entrypoint remains `GET /api/cron/forecasts/refresh?source=marine&maxBeaches=130`, hourly at `0 * * * *`.

Changed files in this follow-up:

- Runtime: `app/api/cron/forecasts/refresh/route.ts`, `lib/cron/observability.ts`.
- Tests: `__tests__/app/api/cron/forecasts-refresh.marine.test.ts`, `__tests__/lib/cron/observability.test.ts`, `__tests__/api/cron/swell-watch-evaluate.test.ts`.
- Handoff/evidence: `docs/FORECAST_MARINE_RECOVERY.md`, `docs/forecast-marine-preflight-evidence-20260909.json`.

### Verified findings and behavior

1. Replayed the original query at **18:35 UTC September 9**: full inventory read failed again with PostgreSQL `57014` after **8.061s**. Cursor read succeeded. The patched query restricts every page to **25 beach IDs**, orders by beach/time/id using the existing beach/time index, and bounds each request to the smaller of **8s** or the remaining cron budget. Every batch is attempted once; subsequent scheduled runs retry unavailable coverage. No index or dependency was added.
2. The shared response and value wrappers omitted the live schema's required `cron_runs.job` field. Both now write `job: route`. A common local helper checks returned errors and thrown failures for inserts, completion updates and stale-run sweeps. It preserves the original handler result/error and logs only job, run ID if acknowledged, operation, attempt, timestamp and a validated error code. An unacknowledged insert is not blindly retried. The sweep message now reports an absent completion without asserting that Vercel killed the process.
3. A failed/malformed/timed-out freshness batch no longer aborts usable work in other batches. `marineCoverage.freshnessCoverage` adds expected/checked beach counts plus failed scopes, timestamps, attempts and safe codes. Failed or unexamined coverage is never counted fresh. Incomplete inventory reads return **503**, retain successful wave writes and cursor evidence, and cannot become a legitimate zero-output success. Source freshness, three-hour refresh eligibility, twelve-hour wave usability, numerical values, existing provider statuses and source-selection rules are unchanged.

Read-only current inventory replay: **495/495 beaches**, **20 requests**, **2.113s total**, zero qualifying current wave rows. A separate populated historical characterization at source reference **2026-09-07T16:30:01Z** also covered **495/495**, reading **54 rows in 2.075s**. That historical result is a performance check, not current freshness. The original wide query and the bounded query were both tested against the same production database without writes.

The mocked real-Supabase transport regression covers all 495 beaches and asserts every timeout and batch predicate. With the first 25-beach read failing, the other **470** are checked, two selected beaches still persist usable waves, and the response/outcome is degraded. Existing stale-cache, valid-zero wave, valid-empty, malformed point, partial provider, pagination, failed wave write, failed cursor write and zero-budget cursor tests remain in the gate.

### Remaining operational conditions

At **18:33 UTC**, readiness remained **503**: RTMA **382/382**, HRRR **422/442**, trusted sources **34/36**, official hazard scopes **145/180**, derived **0/163**. All timestamps are a provisional September 9 snapshot in America/Los_Angeles; comparison window September 8, latest complete date September 8.

- HRRR run **`2222a06b-b6fb-460e-afd0-a38dbfbd8c4c`**, 18:15:00–18:15:05 UTC, acknowledged **442/442** slots from the 16:00 model run. At inspection all 442 rows existed; **20** carried `wind_source=NWS`, the earlier HRRR model timestamp, and **18:30–18:31** update timestamps. This establishes a later source change, not missing destination rows. The enhanced forecast builder sets NWS wind fields and its storage service upserts the same `(beach_id,forecast_at)` key. Attribution to a particular invocation still needs writer logs. Preserving HRRR over NWS would alter source-selection behavior and needs a separate explicit contract decision; this patch does not change it or weaken readiness.
- Trusted run **`8e8768fa-ad3b-4fd3-be33-ef34e8da1b2f`** completed at 12:10:10 UTC. The two uncovered enabled sources have expired latest issues: `nws_pqr_srf` valid through September 9 **01:00Z**, and `surf_institute_pnw` through **07:00Z**. Successful ingestion is not proof of currently valid coverage. Five sources explicitly report `skipped_disabled`; they are not counted as those two failures. No source flag was changed.
- Official hazard readiness still records **35 unavailable mapped scopes** and **103 valid-empty scopes** separately. No new upstream HTTP trace was performed for each scope, so their individual causes remain unresolved. Derived coverage cannot recover until usable marine inputs and the other required inputs are persisted by natural jobs. Absent hazard data remains unknown.

Forecast diagnosis layers: upstream availability **UNKNOWN** (no new per-provider HTTP trace); parser/normalizer **PASS in mocked regressions**; current database coverage **FAIL**; numerical transform/scoring **unchanged, no new live validation**; UI/display **UNKNOWN** (not exercised). These statuses do not substitute for the shared runtime source-status contract.

A later read at **18:40:58 UTC** still returned readiness 503 and the prior hazard run ID; its currently valid official coverage had aged down to **70/180** while derived stayed **0/163**. The new natural hazard run was not yet represented by a completed result. This is time-dependent source evidence, not a new patch regression.

### Exact verification

Web commands ran in the isolated worktree above with `PATH=/opt/homebrew/opt/node@22/bin:$PATH`. Jest used `NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-key`; no real test transport was enabled.

| Command | Result |
| --- | --- |
| `yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts __tests__/app/api/cron/forecasts-refresh.marine.test.ts` before runtime edits | Expected regression failure: **6 failed, 41 passed** |
| `yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts __tests__/app/api/cron/forecasts-refresh.marine.test.ts __tests__/app/api/cron/forecasts-refresh.tides.test.ts __tests__/lib/cron/outcome.test.ts __tests__/api/cron/swell-watch-evaluate.test.ts` | Final **150 passed**, zero skips |
| `yarn test:unit --bail=0 --maxWorkers=2` | Final **18,173 passed**, 195 existing skips, one todo; 1,411 suites passed, 16 skipped; four snapshots passed |
| `yarn typecheck` | PASS; earlier runs caught and corrected an unreachable source comparison and two new test callback signatures |
| `yarn eslint --max-warnings=0 app/api/cron/forecasts/refresh/route.ts lib/cron/observability.ts __tests__/app/api/cron/forecasts-refresh.marine.test.ts __tests__/lib/cron/observability.test.ts __tests__/api/cron/swell-watch-evaluate.test.ts` | PASS; an intermediate conditional-matcher warning was fixed |
| `VERCEL_ENV=preview yarn build` via `/tmp/quiver-release-build.py` | PASS; final completed runtime diff **106.67s** (earlier build 109.50s); existing public build values only |
| `git diff --check` | PASS |
| `git diff --no-ext-diff \| gitleaks stdin --redact --no-banner --config .gitleaks.toml` and `gitleaks stdin --redact --no-banner --config .gitleaks.toml < docs/forecast-marine-preflight-evidence-20260909.json` | PASS, no leaks in tracked diff or new evidence |
| `gh run list --limit 3 --json workflowName,headSha,conclusion` | Read succeeded; previous main/prod gates green. This uncommitted patch has not run in hosted CI |

The first broad Jest run found one consumer test expecting the old insert payload. Updated only its exact payload assertion to require `job`; the final full suite passed. The final focused run additionally validates the strengthened timeout and warning assertions. No tests were weakened or skipped to obtain a green result.

Read-only diagnostic commands used Python `/Users/stevenchandler/Desktop/dev/.worktrees/seaside-ops-reliability-20260908/.venv/bin/python` through `/tmp/seaside-release-run.py`, which passes existing credentials only to the child process:

- `python /tmp/seaside-release-run.py python /tmp/validate-marine-preflight.py`: old full scan **FAIL 57014**; cursor and bounded sample PASS.
- `python /tmp/seaside-release-run.py python /tmp/validate-marine-bounded.py`: complete current inventory PASS.
- `python /tmp/seaside-release-run.py python /tmp/validate-marine-historical.py`: complete historical inventory PASS.
- `python /tmp/seaside-release-run.py python /tmp/trace-hrrr-slots.py`: PASS as a read-only evidence fetch, confirms incomplete current HRRR coverage.
- `python /tmp/seaside-release-run.py python /tmp/trace-trusted-gaps.py`: PASS as a read-only evidence fetch, confirms expired validities.

The replay queries exactly mirror the route's projection, observed/source predicates, twelve-hour timestamp range, ordering and 1,000-row pagination. They enumerate all coordinate-bearing beach IDs, then add `beach_id IN (...)` per group of 25. HTTP request hooks reject every method except GET. No arbitrary SQL execution, RPC or production cron invocation is used. Safe aggregate outputs are retained in [the evidence packet](forecast-marine-preflight-evidence-20260909.json).

Clean Seaside smoke check (macOS, **not** a new Linux CI run), in the unchanged release worktree:

```sh
/Users/stevenchandler/Desktop/dev/.worktrees/seaside-ops-reliability-20260908/.venv/bin/python -m venv /tmp/seaside-preflight-clean-20260909
/tmp/seaside-preflight-clean-20260909/bin/python -m pip install -r requirements-smoke.txt
/tmp/seaside-preflight-clean-20260909/bin/python -m pytest tests/test_deploy_smoke_offline.py -v --tb=short
/tmp/seaside-preflight-clean-20260909/bin/python -c "import importlib.util; assert all(importlib.util.find_spec(m) is None for m in ['xgboost','sklearn','pandas']); print('Legacy ML stack absent')"
```

All four commands PASS. Smoke **4 passed, zero skipped**, **3.88s**. Tests execute the deployed smoke functions with fixture credentials, real SDK clients and mocked HTTP; sockets are blocked. No legacy XGBoost/sklearn/pandas packages were installed. Existing Operational Gate still includes both this clean dependency gate and the offline operational suite; no CI/deploy configuration changed.

Browser E2E guide and Prod Gate smoke configuration were reviewed; no browser specs were changed or executed because this patch changes only cron/database behavior. No device/simulator checks, screenshots or recordings apply. Existing Jest tide and swell-watch route consumers were reviewed and executed. Web dependencies were reused locally; the Web build is not represented as a fresh dependency installation.

### Compatibility, recovery and rollback

No migration is necessary. Existing `totals`, cursor, route keys, health endpoints and source-status values remain compatible. `freshnessCoverage` is additive diagnostic JSON; consumers must continue to respect HTTP 503. `job: route` matches the existing schema and outcome convention. General cron telemetry failures remain best effort; marine cursor-write failure retains its stricter degraded-response contract.

After reviewed release authorization, use the existing main → prod path. Verify natural hourly marine runs produce an acknowledged job/run row, advancing cursor and usable waves with original source timestamps. A full inventory traversal and the next natural hazard run are needed to measure recovery of **0/163**. For a failed freshness batch, inspect its safe code, affected beach IDs, expected/actual counts and attempt timestamp; restore read access/latency and verify the next scheduled attempt. For a failed ledger insert, the run ID is explicitly unavailable; correlate the job/timestamp with Vercel's request ID rather than inventing an acknowledged run. Restore schema/access/transport, then require an actual durable run record. Do not blindly replay unacknowledged ledger inserts.

A reviewed code revert of the two runtime files is the rollback path; additive JSON can remain. That rollback restores the known wide-scan timeout and missing-job defects, so it is not a recovery recommendation. No new infrastructure, flags, numerical methods, source preference changes or remediation agent were introduced. Review iterations fixed the bounded query, shared-wrapper/schema handling, impacted consumer assertion, type errors and lint warning; no remaining actionable finding was identified in this bounded diff. Live source recovery and the separate source-writer contract remain unresolved.


## Cancellation regression review resolution

Resolved the review finding that the timeout tests returned errors immediately and only asserted signal construction. Two new cases in `__tests__/app/api/cron/forecasts-refresh.marine.test.ts` hold the real Supabase client's mocked HTTP request open until **the signal passed to transport** aborts. A real AbortController is driven by Jest's virtual clock because native `AbortSignal.timeout` uses Node's internal clock. Each case asserts the request remains pending one millisecond before cancellation.

- With a 20-second budget, the request aborts after eight seconds, the remaining batch persists usable waves, and response/outcome stay degraded.
- With two seconds remaining, cancellation is clipped to that deadline, no later inventory/provider work starts, no waves are written, the previous cursor is preserved, and unavailable coverage cannot become a legitimate no-op.

Negative controls confirmed the assertions are effective. Temporarily connecting a different, never-aborted signal caused **both tests to fail at the missing transport-abort assertion**, despite still constructing the expected timeout. Temporarily removing deadline clipping caused the two-second case to fail. Each mutation was restored in `finally`, with byte-for-byte restoration verified. Neither mutation remains in the runtime diff.

Only the marine test, this handoff, and `docs/forecast-marine-preflight-evidence-20260909.json` changed during this review resolution; the earlier runtime patch is unchanged. Same isolated branch/base as above; no commit, push or deployment.

Commands ran in the Web worktree with Node 22 and the same fixture environment documented above:

| Command | Result |
| --- | --- |
| `yarn test:unit --runInBand __tests__/app/api/cron/forecasts-refresh.marine.test.ts` | PASS: 30 tests |
| `yarn test:unit --runInBand __tests__/app/api/cron/forecasts-refresh.marine.test.ts -t 'cancels stalled HTTP'` with disconnected-signal mutation | Expected FAIL: 2 failed, 28 excluded by name filter |
| `yarn test:unit --runInBand __tests__/app/api/cron/forecasts-refresh.marine.test.ts -t 'remaining 2000 ms budget'` with deadline-clipping mutation | Expected FAIL: 1 failed, 29 excluded by name filter |
| `yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts __tests__/app/api/cron/forecasts-refresh.marine.test.ts __tests__/app/api/cron/forecasts-refresh.tides.test.ts __tests__/lib/cron/outcome.test.ts __tests__/api/cron/swell-watch-evaluate.test.ts` after restoration | PASS: **152 tests**, zero skips |
| `yarn typecheck` | PASS |
| `yarn eslint --max-warnings=0 __tests__/app/api/cron/forecasts-refresh.marine.test.ts` | PASS |
| `git diff --check` | PASS |

Final review checked signal wiring, deadline boundaries, preservation of partial writes/cursor, false-positive assertions, fixture isolation and pending timer cleanup. No further actionable finding identified. Full-suite/build results above precede these two additional tests; they were not rerun for this test-only resolution. Browser E2E/device/simulator checks and live production checks were not rerun. Numerical behavior, compatibility/rollback requirements and previously documented production recovery gaps remain unchanged.


## Release authorization — September 9

The operator explicitly authorized committing, pushing and making this reviewed patch live. Release preparation uses feature → main (squash PR) → prod (regular merge PR), with active Main Gate and Prod Gate required before integration. This supersedes earlier statements that release authorization was pending. The seven-file patch is the reviewed scope; no Seaside runtime, migration, production flag or numerical method change is included. Final commit, gate and deployment receipts are recorded on the release pull requests. Scheduled marine recovery must be validated on the production deployment; a Ready preview alone is insufficient.

Final pre-push revalidation: `yarn test:unit --bail=0 --maxWorkers=2` **18,175 passed**, 195 existing skips, one todo, 1,411 suites passed in 108.282s; `yarn typecheck` PASS. This full run includes both cancellation regressions.
