# Signed-in homepage performance — September 9, 2026

Implementation evidence recorded before release. On September 9 the operator explicitly authorized committing, integrating into main, and validating dev; production promotion remains outside this request. Branch `orch/signed-in-home-performance-20260909`, based on Web main `8ba2c0939782fed281cedeb6665ca690ae2102b7`; production at inspection was `2fd33c8e4fbe304a67411be0fd9d72dc50810df9` with the same source tree. Worktree: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/signed-in-home-performance-20260909`. The primary checkout (`fix/seo-outreach-digest-contact-guard`, `df58a77eb6c71a7888568956b8bd1b367908df03`) contains unrelated dirty files and was preserved. No delegation or cross-repository edits.

## Verified findings and patch

The active Web flow is `app/page.tsx` → `AuthAwareLandingWrapper` → `OracleHomeScreen` → `useOracleData` → `useSurfDiscovery` → `/api/surf/discover` → discovery orchestration and Pro similarity scoring.

1. Production desktop Chromium measurements took **8,515 ms** and **8,132 ms** to show the surf call. The latter had a 31 ms document TTFB and 252 ms first contentful paint. Two identical discovery requests started 301 ms apart and took 6,206 / 6,302 ms. These are individual observations, not percentiles.
2. On first profile resolution, discovery becomes enabled while coordinates/skill change. `useDataFetcher` starts the correct request, but the hook's options effect invalidates it and schedules another. The patch suppresses only that first-enable duplicate. Later location changes, returning to an established query, manual refresh, decision expiry and tab-resume policy checks retain their existing revalidation behavior.
3. A local production build using the approved test account sent **50 simultaneous** `compute_user_match_score_batch` RPCs for one Pro discovery. The RPC phase took 1,714 ms in the traced run. A native JavaScript iterator now feeds at most ten workers per discovery request. A completed worker admits the next beach immediately, so a slow RPC cannot hold back an entire group. Every beach/window is still scored; output ordering, score values, entitlement checks and per-beach error fallback are unchanged.
4. The existing performance probe keyed requests by URL/method and silently overwrote duplicates. It now keys by Playwright Request identity, includes server actions, reports the discovery count, and omits query parameters/profile IDs. It registers only with `RUN_PERF_PROBE=1` and uses the existing runtime error detection helpers.

No recommendation cache, freshness extension, candidate-pool reduction, numerical change, database migration or production configuration change was introduced. Only the hook and similarity layer are production code changes.

## Regression and review evidence

- Original hook: two new first-enable cases failed with **two requests instead of one**. Final tests also ensure the original response is consumed and a later location change discards older in-flight data.
- Original unbounded similarity layer: regression failed with **23 concurrent RPCs**, exceeding ten. The test covers all 23 outputs, exact physical scores, one returned RPC error and one thrown transport error.
- An intermediate fixed-group limit blocked queued beaches behind one slow request. The new straggler regression failed there and passes with continuously draining workers.
- Review found that broadly suppressing all re-enable resets could retain a previous location's recommendation. The explicit re-enable regression reproduced this; suppression is now restricted to first enable.
- An intermediate local repeat observed HTTP 504 after 12,613 ms during broader database latency: the preferences read took 1,781 ms and match RPCs reached 2,118 ms. The existing 12-second discovery deadline was retained. This failure is recorded, not counted as successful validation. Final measurements are listed below; deployment and production tail-latency improvement remain unverified.

The initial RPC regression invocation lacked fixture environment values and failed before loading tests. It was rerun with fixture values against the original implementation and produced the expected concurrency assertion failure. The first local browser launch found the separately started server on its port; no browser test ran in that invocation. The corrected local probe configuration inherits the repository configuration and only disables automatic server startup for the already-running task-owned server.

## Commands and verification

Commands ran in the isolated worktree with Node 22/Yarn 1. Unit commands used `NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-key`; no production transport is used by the Jest suites.

```sh
yarn test:unit --runInBand __tests__/hooks/use-surf-discovery.test.tsx -t 'profile options become ready together'
yarn test:unit --runInBand __tests__/lib/services/discovery/similarity-layer.test.ts -t 'bounds RPC concurrency'
yarn test:unit --runInBand __tests__/lib/services/discovery/similarity-layer.test.ts -t 'starts queued beaches'
yarn test:unit --runInBand __tests__/hooks/use-surf-discovery.test.tsx -t 'established query is re-enabled'
```

Each regression was observed failing on the corresponding prior implementation. Temporary baseline source replacement was limited to the task-owned file and restored in `finally`; no baseline mutation remains.

```sh
yarn test:unit --runInBand __tests__/hooks/use-surf-discovery.test.tsx __tests__/hooks/use-surf-discovery-hold.test.tsx __tests__/hooks/use-surf-discovery.resume-revalidation.test.tsx __tests__/lib/services/discovery/similarity-layer.test.ts
yarn test:unit --bail=0 --maxWorkers=2
yarn typecheck
yarn eslint --max-warnings=0 hooks/use-surf-discovery.ts lib/services/discovery/similarity-layer.ts __tests__/hooks/use-surf-discovery.test.tsx __tests__/lib/services/discovery/similarity-layer.test.ts e2e/home-perf-probe.spec.ts
VERCEL_ENV=preview yarn build
git diff --check
```

Final source verification:

- Focused hook, hazard/resume and similarity regressions: **4 suites, 58 tests passed**.
- Full Jest gate: **1,411 suites, 18,181 tests and four snapshots passed** in 176.435 seconds. **16 suites / 195 tests skipped and one todo** remain excluded by the existing suite; they are not counted as passed. This final run started after the last source/test edit.
- `yarn typecheck`: **passed**, 17.79 seconds.
- Scoped ESLint command above: **passed**, zero warnings, 17.75 seconds.
- Final production build: **passed**, 143.63 seconds, after the last runtime edit. Its missing server-key warning is expected: only public configuration was supplied to build; the local runtime receives the existing key separately.
- `git diff --check`: **passed**.

Final desktop Chromium probes against the final local production build: **both passed**, one test per invocation, with runtime error detection enabled.

| Measurement | Production baseline | Final local build | Final local repeat |
| --- | ---: | ---: | ---: |
| Surf call rendered | 8,132 ms | 4,374 ms | 3,929 ms |
| Discovery requests in measured navigation | 2 | 1 | 1 |
| Discovery duration | 6,206 / 6,302 ms | 3,170 ms | 3,073 ms |
| Document TTFB | 31 ms | 7 ms | 10 ms |

Local build and production have different hosting/network conditions, and the database is shared/live. These observations establish duplicate removal and a faster local sample, not a controlled production speedup or latency percentile. No unit/build processes were competing locally during the final browser probes.

The final server trace also confirmed ten maximum simultaneous scoring RPCs, with all 50 beaches requested on each of four discovery cycles across auth setup and the two measured navigations. Those RPC phases took 389–766 ms, versus the earlier unbounded local observation of 1,714 ms. The auth helper itself visits the page before the instrumented navigation; its setup requests are excluded from the probe's navigation request count.

Final browser commands (both exit 0):

```sh
node /tmp/signed-home-run.cjs probe http://127.0.0.1:3217 /tmp/signed-home-workers-probe.log
node /tmp/signed-home-run.cjs probe http://127.0.0.1:3217 /tmp/signed-home-workers-repeat.log
```

Safe timing summaries are reproduced above. Raw auth logs and automatic failure artifacts stay out of the handoff because they can contain account data. The earlier intermediate-version timeout remains an observed failure; two final passes do not prove database tail latency is resolved.

The existing browser probe was reviewed and executed with its required opt-in, approved account and read-only business-data mode:

```sh
RUN_PERF_PROBE=1 PLAYWRIGHT_PROD_READONLY=true SKIP_E2E_CLEANUP=true BASE_URL=https://www.quiversurf.app yarn playwright test e2e/home-perf-probe.spec.ts --project=auth --workers=1 --retries=0
```

Actual credential-safe launch commands were `node /tmp/signed-home-run.cjs build`, `SIGNED_HOME_TRACE=1 node /tmp/signed-home-run.cjs serve 3217 /tmp/signed-home-final-server.log`, and `node /tmp/signed-home-run.cjs probe <base-url> <log-path>`. Local probes use `/tmp/signed-home-playwright.config.ts`, inheriting the same setup/teardown, auth project and assertions with automatic webServer startup disabled. Build uses existing public configuration; runtime uses the existing server key only within the local server process. Secrets, raw auth logs and private data are not included here. Normal auth/page-view telemetry occurs, as documented by the existing production read-only suite; no forms or business-data mutations were exercised.

This is desktop Chromium and a locally served production build with live reads, not mocked browser transport, a simulator, or a clean dependency install. Jest transport is mocked. No UI layout changed, so no visual screenshot is claimed. CI has not run this uncommitted patch.

## Operator handoff and remaining limits

Changed files: `hooks/use-surf-discovery.ts`, `lib/services/discovery/similarity-layer.ts`, their existing unit test files listed in the commands above, `e2e/home-perf-probe.spec.ts`, and this handoff. Final diff review found no remaining actionable findings within this bounded patch. The task-owned local server was stopped after measurement; the reviewed patch is prepared for the authorized main integration from the isolated worktree.

Integrate through the normal feature → main gate, then validate the deployed commit on dev.quiversurf.app. At release preflight, main had advanced to `cb47afc7d090d8c1bea196092e302cd853d80e14`; preserve its two beach-preview commits. Production promotion requires separate authorization. No migration or flag change is required. Rollback is a code revert of the two runtime changes; no data repair is needed. Measure the released revision with the same probe and compare request counts, time to surf call and discovery latency under representative load. Do not treat local timings as production percentiles or relax fresh hazard checks to improve them.

The per-request limit is not a global database concurrency limit. A slow database can still exhaust the unchanged discovery deadline. This task does not claim that all server-side query cost or signed-in interaction latency has been eliminated. Production improvement remains to be measured after a separately authorized release.
