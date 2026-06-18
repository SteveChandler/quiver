# Parallel-Safe E2E Proof Report

Date: 2026-06-17

## Verdict

PROVEN parallel-safe for the authenticated suite at 3 and 8 workers on the local stack.

The required proof block completed:

- 3 workers x2 runs: green, clean teardown both times.
- 8 workers x2 runs: green, clean teardown both times.
- Only documented `test.fixme` / `test.skip` cases remained.
- Global teardown swept the pool every run and the pool footprint assertion passed every run.

## Setup Readiness

Setup was not rerun because the local stack was already up on canonical ports.

| Check | Result |
| --- | --- |
| Supabase REST, `http://127.0.0.1:54321/rest/v1/` | `200` |
| Local DB, `127.0.0.1:54322` | reachable |
| Beaches | `324` |
| Enhanced forecasts | `25440` |
| Worker profiles before run | `8` |
| Forecast snapshot after rebase | `25440` fresh rows, max `forecast_at` `2026-06-18 05:59:57.546337+00` |

## Iteration Log

| Cycle | Failure / symptom | Category | Fix |
| --- | --- | --- | --- |
| 1 | Cached `e2e/.auth/worker-*.json` state survived pool reseeds and could bind a worker to a deleted Supabase user. | Fixture/test-data contamination | `e2e/fixtures/auth-fixture.ts` now validates cached worker storage against `/api/auth/check-session` before reuse and regenerates stale state. `e2e/global-teardown.ts` removes all local auth-state files after pool cleanup. |
| 2 | `forecast-regional.spec.ts` failed under repeat runs because the snapshot aged out of "fresh" windows. | Seed/snapshot gap | `e2e/global-setup.ts` now rebases local `enhanced_forecasts` timestamps in a local-only transaction before seeding worker users. |
| 3 | Home activation expected `Today's Windows`, but the run crossed the app's day/window boundary and rendered `Tomorrow's Windows`. | Fixture/test-data mismatch | `e2e/home.spec.ts` now asserts the correct time-dependent heading with `/^(Today\|Tomorrow)'s Windows$/`. |
| 4 | `beach-detail.spec.ts` gallery path failed when `/api/intel` returned 500 from a transient Supabase RPC upstream error. | Real product bug | `app/api/intel/route.ts` now treats the exact transient upstream error like an optional enrichment miss and returns an empty intel payload instead of failing the page. Other RPC errors still surface. |
| 5 | `map.spec.ts` list/detail forecast carryover failed when the list was still in a skeleton/loading state under 8 workers. | Harness/test timing | `e2e/map.spec.ts` now waits for the beach list to be non-busy, a real card heading to exist, and expanded-card forecast loading text to clear before parsing height. |

One invalid command was excluded from proof: a targeted `beach-detail` run was accidentally started while another Playwright webServer was active and failed with `Another next build process is already running`. It was rerun sequentially and passed.

## Blocker Disposition

| Spec / surface | Category | Disposition |
| --- | --- | --- |
| `e2e/api/gamification.spec.ts`, profile/progression consumers | Real product bug | FIXED with additive `ensure_user_xp` RPC migration plus service/API bootstrap changes. This preserves RLS while allowing a legitimate authenticated user to initialize/read their XP status. |
| `e2e/forecast-regional.spec.ts` | Seed/snapshot gap | FIXED by local-only timestamp rebase in `e2e/global-setup.ts`; targeted 8-worker rerun passed. |
| `e2e/home.spec.ts` | Fixture/test-data mismatch | FIXED by accepting the real time-dependent `Today`/`Tomorrow` heading. Targeted rerun passed. |
| `e2e/beach-detail.spec.ts` | Real product bug | FIXED by exact transient Supabase upstream fallback in `/api/intel`; targeted rerun passed. |
| `e2e/map.spec.ts` | Harness/test timing | FIXED by waiting for stable list/expanded forecast UI before asserting carryover. Targeted rerun passed. |
| Auth fixture / pool state | Fixture/test-data contamination | FIXED by server-validating cached worker state and sweeping auth-state files during teardown. Covered by all four proof runs. |

No blockers were quarantined. No new `test.fixme` or `test.skip` entries were added.

## Product Bugs For Human Review

| Surface | Files | Disposition | Security / behavior implication |
| --- | --- | --- | --- |
| XP status bootstrap | `supabase/migrations/20260617090000_add_ensure_user_xp_rpc.sql`, `lib/gamification/xp-service.ts`, `app/api/gamification/xp-status/route.ts` | Fixed additively | Avoids client-side RLS insert failures for legitimate users without weakening table policies. The RPC is scoped to the authenticated user and should be reviewed before production migration application. |
| Intel optional enrichment | `app/api/intel/route.ts` | Fixed additively | A transient Supabase upstream RPC failure no longer 500s beach pages. It returns an empty intel list only for the exact known transient message or missing PostGIS geography; other errors still fail. |

## Final Runs

| Run | Command | Actual workers | Passed | Failed | Flaky | Skipped | Wall time | Teardown clean | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| 3-worker #1 | `E2E_PORT=3100 yarn test:e2e --project=auth --workers=3 --reporter=line` | 3 (`Running 1040 tests using 3 workers`) | 1026 | 0 | 0 | 14 | `790.80s` / `13.2m` | yes | PASSED |
| 3-worker #2 | `E2E_PORT=3100 yarn test:e2e --project=auth --workers=3 --reporter=line` | 3 (`Running 1040 tests using 3 workers`) | 1026 | 0 | 0 | 14 | `809.95s` / `13.5m` | yes | PASSED |
| 8-worker #1 | `E2E_PORT=3100 yarn test:e2e --project=auth --workers=8 --reporter=line` | 8 (`Running 1040 tests using 8 workers`) | 1025 | 0 | 0 | 15 | `470.31s` / `7.8m` | yes | PASSED |
| 8-worker #2 | `E2E_PORT=3100 yarn test:e2e --project=auth --workers=8 --reporter=line` | 8 (`Running 1040 tests using 8 workers`) | 1026 | 0 | 0 | 14 | `476.58s` / `7.9m` | yes | PASSED |

Teardown evidence appeared on every final proof run:

```text
[Global Teardown] Cleaning up test data...
[Cleanup] No ephemeral smoke users found
[Global Teardown] ✓ Pool cleanup assertion passed
[Global Teardown] Teardown complete
```

## Validation Commands

| Command | Result |
| --- | --- |
| `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:54321/rest/v1/` | Passed, returned `200` |
| `npx eslint --max-warnings=0 e2e/fixtures/auth-fixture.ts e2e/global-teardown.ts` | Passed |
| `E2E_PORT=3100 npx playwright test --project=auth --list e2e/home.spec.ts` | Passed, listed 51 tests |
| `E2E_PORT=3100 yarn test:e2e --project=auth --workers=3 --reporter=line e2e/home.spec.ts` | Passed, `49 passed`, `2 skipped` |
| `npx eslint --max-warnings=0 e2e/global-setup.ts` | Passed |
| `E2E_PORT=3100 yarn test:e2e --project=auth --workers=8 --reporter=line e2e/forecast-regional.spec.ts` | Passed, `22 passed` |
| Local DB forecast freshness query | Passed, `enhanced_forecasts_rebased=25440`, `fresh_12h=25440` |
| `npx eslint --max-warnings=0 e2e/global-setup.ts e2e/home.spec.ts` | Failed on pre-existing warnings in `e2e/home.spec.ts`; 0 errors |
| `E2E_PORT=3100 yarn test:e2e --project=auth --workers=3 --reporter=line e2e/home.spec.ts --grep "session intelligence"` | Passed, `1 passed` |
| `npx eslint --max-warnings=0 app/api/intel/route.ts e2e/map.spec.ts` | Failed on pre-existing Playwright lint warnings in `e2e/map.spec.ts`; 0 errors |
| `npx eslint --quiet app/api/intel/route.ts e2e/map.spec.ts` | Passed |
| `E2E_PORT=3100 npx playwright test --project=auth --list e2e/map.spec.ts --grep "preserve forecast height"` | Passed, listed 1 test |
| `E2E_PORT=3100 yarn test:e2e --project=auth --workers=8 --reporter=line e2e/map.spec.ts --grep "preserve forecast height"` | Passed, `1 passed` |
| `E2E_PORT=3100 yarn test:e2e --project=auth --workers=8 --reporter=line e2e/beach-detail.spec.ts --grep "should display beach photos or gallery"` | Passed, `1 passed` |
| `yarn typecheck` | Passed |
| Final 3-worker #1 | Passed, clean teardown |
| Final 3-worker #2 | Passed, clean teardown |
| Final 8-worker #1 | Passed, clean teardown |
| Final 8-worker #2 | Passed, clean teardown |

## Remaining Risks

- The local proof depends on the canonical local Supabase stack and the local-only forecast timestamp rebase in global setup.
- The XP bootstrap migration and `/api/intel` fallback are additive production-code fixes and should be reviewed separately before any production migration/application.
- Pre-existing lint warnings remain in broad Playwright specs such as `e2e/home.spec.ts` and `e2e/map.spec.ts`; scoped `--quiet` lint passed for the touched product/test files.
