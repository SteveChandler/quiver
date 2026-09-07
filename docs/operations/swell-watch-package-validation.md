# Swell Watch no-send package validation

## Current-main integration — September 6

Worktree: `/Users/stevenchandler/Desktop/dev/.worktrees/phase-26/no-send-current`
Branch: `orch/phase-26-no-send-current`
Base: `8813c02df5b43744106fd0eab8e50c48685f57c5`
Status: local source integration applied; broader gates in progress, not release approval.

Transferred the no-send implementation and tests without the older package's
editorial changes or redundant discovery-fixture repair. Preserved upstream
source-selection metadata, nullable Open-Meteo response arrays, confidence cap,
matching quality score, and associated tests. The initial process-substitution
merge attempt did not preserve upstream additions; diff review caught it before
testing. Reapplied the original local hunks onto current-main versions and
manually reconciled the additive raw-forecast types. Reviewed the corrected diff.

Copied the 18 missing installed-history migration files and two frozen approval
plans byte-for-byte from the old package. No migration was executed. Generated
database types were transferred unchanged, not manually edited. Package manifest
and lockfile match the original; dependencies were locally APFS-cloned with
`cp -cR` rather than installed or symlinked to another worktree.

Verification on this current base:

- Focused Jest: PASS, 13 suites / 246 tests, 3.286 seconds. Covers both the
  upstream source-disagreement regression and five secondary-missingness cases,
  discovery, surf-call overloads, community-photo overloads, acquisition and
  evaluation routes, receipts, attestation, persistence and shadow evaluation.
- Scoped ESLint on transferred runtime and test files: PASS (`--max-warnings=0`).
- `git diff --check`: PASS after reconciliation.
- First `yarn typecheck`: FAIL, nine nullable-secondary errors in the newer
  `lib/services/noaa-wavewatch/source-selection.ts`. Added explicit null guards
  without changing its existing rejection of incomplete source bundles, plus
  three parameterized tests (missing height, period, direction) asserting both
  rejection when alone and uncontaminated NOAA fallback. Second typecheck FAIL:
  three property-narrowing errors remained through the aliased boolean. Changed
  that expression into a direct guarded return. Final `yarn typecheck` PASS,
  session 98351, 8.35 seconds. Scoped source-selection ESLint PASS.
- Final focused rerun `yarn test:unit --runInBand --silent --runTestsByPath
  __tests__/lib/services/noaa-wavewatch/source-selection.test.ts
  __tests__/lib/services/forecast/forecast-builder.test.ts`: PASS, 2 suites / 46
  tests, 1.018 seconds. This rerun is after the direct-guard correction.
- Full `yarn test:unit --runInBand --silent --bail=0`: PASS, session 66324,
  1,407 suites / 18,021 tests / 4 snapshots, 254.752 seconds. Existing 16 skipped
  suites, 195 skipped tests and 1 todo are not counted as verified. The run began
  before the source-selection null-guard repair; the final 46-test focused rerun
  above and final typecheck separately validate that last correction.
- Current-base `yarn build`: PASS, 134.42 seconds (session 94464), before the
  cache-header correction below. Local public anon key only; invalid service-role
  placeholder caused expected restricted forecast/water-quality query warnings.
  This is compilation/prerender evidence, not production-data safety evidence or
  a deployable artifact (localhost configuration).
- Compiled HTTP smoke: FAIL (session 29662). The first unauthorized acquisition
  request correctly returned 401, but Next's blanket API rule replaced the
  handler's no-store with `private, max-age=60, stale-while-revalidate=120`.
  Remaining assertions did not run. Local server stopped in finally; port 3100
  verified unused afterward. This was not a passing E2E check.
- Fixed root cause with exact-route header exceptions in `next.config.mjs` for
  acquisition and evaluation. Added two effective-header assertions using the
  existing Next route matcher in `__tests__/next-config-experiment-cache.test.ts`.
- `yarn test:unit --runInBand --silent --runTestsByPath
  __tests__/next-config-experiment-cache.test.ts
  __tests__/api/cron/swell-watch-acquire.test.ts
  __tests__/api/cron/swell-watch-evaluate.test.ts`: PASS, 3 suites / 33 tests.
- `node_modules/.bin/eslint --max-warnings=0 next.config.mjs
  __tests__/next-config-experiment-cache.test.ts` and `git diff --check`: PASS.
- Post-fix `yarn build`: PASS, session 63181, 144.03 seconds. Existing local
  restricted-data/dynamic-rendering warnings remain; no production-data claim.
- Post-fix compiled HTTP smoke: PASS, session 28380, all 8 requests/assertion
  groups, 1,883ms including server startup. Both routes returned 401 for missing
  and incorrect auth, 200 with exact disabled/zero-enqueue body for fixture auth,
  and 405 for the unsupported method. All handled responses had no-store.
  Server stopped in finally. This proves default-off HTTP wiring, not enabled
  acquisition, owner qualification, database persistence or provider delivery.
- Browser/UI E2E: not run on this base. Reviewed the existing comparison-page
  case but left it unchanged: editorial UI changes were deliberately not ported.
  HTTP smoke covers this backend-only slice, not full native/provider lifecycle.

HTTP smoke environment: `http://127.0.0.1:3100`, `next start --hostname
127.0.0.1 --port 3100`, preview mode, localhost Supabase, fixture-only runtime
keys/cron secret and all four Swell Watch flags false. Node assertions check
unauthorized and wrong-token 401, authorized disabled 200 with exact
`{skipped:true,reason:"disabled",enqueued:0}`, no-store on each handled response,
and wrong-method 405 for each endpoint. The public local anon key used for build
is read only from local studio container metadata, checked for role=anon, and not
printed or written to an env file. No real service-role key is used. The E2E
runner skill governs explicit environment, outcome, and server-cleanup evidence.

Jest uses only the same fixture environment described below: local Supabase URL,
fixture-only anonymous/service placeholders, localhost site URL. No production
credentials or runtime were accessed. No sends, OTA, deployment or study start.

## Historical verification of the older package

Current-base scheduling follow-up: added only the hourly minute-15 acquisition
entry in `vercel.json`; existing legacy schedule unchanged. Added an assertion
for exactly one acquisition schedule and no GET schedule for the evaluation POST
callback. `yarn test:unit --runInBand --silent --runTestsByPath
__tests__/api/cron/swell-watch-acquire.test.ts
__tests__/config/vercel-config.test.js __tests__/config/vercel-cron-auth.test.js`
PASS, 3 suites / 19 tests (1.082s), with the same fixture environment.
`node_modules/.bin/eslint --max-warnings=0
__tests__/api/cron/swell-watch-acquire.test.ts` and `git diff --check` PASS.
No deployment or live scheduler was created. Build/HTTP results above predate
this deployment-config/test-only change. Launch-review sequence and outstanding
owner/evidence requirements: `swell-watch-no-send-launch-review.md`.

Status: local integration incomplete; not deployment approval or study-start evidence.

Worktree: `/Users/stevenchandler/Desktop/dev/.worktrees/phase-26/no-send-package`
Branch: `orch/phase-26-no-send-package`
Base: `a69b0149faee074c1055bbeedeb271e0a798c849`

The original 21-file static dependency inventory is insufficient for a whole-app
release. It omits reverse consumers of changed shared types and the associated
tests. Do not treat that inventory as a complete release manifest. This worktree
is a local integration check, not permission to deploy an older application base
over newer production changes.

## Verified repair

Included the existing Phase 26 `app/api/surf/call/route.ts` repair unchanged:
preserve `typeof protectedGET` instead of extracting only its final overload with
`Parameters`. This restores the existing optional-context caller signature while
retaining the Next.js route signature. Request handling, authentication, response
shape, and no-store headers are unchanged. No native files were modified.

Checks run on 2026-09-06 in this worktree:

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent --runTestsByPath __tests__/app/api/surf-call-route.test.ts`: PASS, 1 suite / 17 tests. Existing tests only; no assertions weakened or removed.
- `yarn typecheck`: FAIL after the surf-call repair with 25 diagnostics. After the community-photo repair below, only 8 forecast-builder nullable-component diagnostics remain.
- `node_modules/.bin/eslint --max-warnings=0 app/api/surf/call/route.ts`: PASS.
- `git diff --check`: PASS.

## Next integration work

1. Completed locally: preserve shared handler overloads through community-photo
   observability. See the validation below. Carry this fix and its test into the
   final reviewed integration; the original Phase 26 worktree is unchanged.
2. Completed locally: nullable-component handling in forecast-builder and five
   regression cases. Missing direction remains null; complete 0-degree north
   remains valid. See the forecast validation below.
3. Include the no-send route, provider, and policy tests in the package, then run
   clean typecheck, focused/full unit gates and the complete application build.
4. Reconcile the release base with current production before preparing the
   consolidated production approval package.

No complete build result is available from the earlier build process; its handle
is no longer available. No build PASS is claimed. E2E was not reviewed or run in
this increment; final E2E status remains unverified. No production writes,
credentials, commits, pushes, deployment, sends, activation or OTA publication.
The 30-day study has not started based on the last verified operational inventory.

## Community-photo wrapper compatibility repair

Changed production source: `lib/community-photos/observability.ts` (type-only
overloads and a type-only import). Changed test:
`__tests__/lib/community-photos/observability.test.ts` (one regression verifying
the overloaded type and exact request/context/response forwarding for omitted,
plain and promised context). No test exclusions or existing assertion changes.

Review caught an initial overload-selection regression for argumentless throwing
handlers. The final signatures preserve that existing generic use case too.
The subsequent complete typecheck has no community-photo diagnostics.

Final checks in this worktree:

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent --runTestsByPath __tests__/lib/community-photos/observability.test.ts __tests__/api/admin-community-photo-hidden-image.test.ts __tests__/api/community-photo-mutation-routes.test.ts __tests__/api/community-photo-owner-recovery.test.ts __tests__/api/community-photos-gallery-route.test.ts __tests__/api/community-photos-upload-route.test.ts __tests__/api/community-photo-observability-coverage.test.ts __tests__/api/community-photo-retention.test.ts __tests__/app/api/surf-call-route.test.ts`: PASS, 9 suites / 72 tests.
- `node_modules/.bin/eslint --max-warnings=0 lib/community-photos/observability.ts __tests__/lib/community-photos/observability.test.ts`: PASS.
- `git diff --check`: PASS.
- `yarn typecheck`: FAIL, only the 8 already identified forecast-builder diagnostics remain. This is not a full package pass.
- TypeScript `transpileModule` comparison against `git show HEAD:lib/community-photos/observability.ts`, using ES2022/ESNext with comments removed: PASS, emitted JavaScript identical. This checks unchanged runtime code, not full application build compatibility.

E2E not reviewed or run for this type-only increment; release E2E remains
unverified. Diff self-review found no remaining actionable wrapper finding.

## Forecast nullable-component repair

Changed `lib/services/forecast/forecast-builder.ts` and
`__tests__/lib/services/forecast/forecast-builder.test.ts` only for this increment.
Incomplete secondary tuples cannot win dominant period/direction selection.
The height transform retains a null direction rather than inventing north.
Positive complete secondary tuples, including actual north (0 degrees), remain
eligible. Existing shared partition picker and formatters are reused.

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent --runTestsByPath __tests__/lib/services/forecast/forecast-builder.test.ts __tests__/lib/services/forecast/forecast-builder-cdip-semantics.test.ts __tests__/lib/services/forecast/forecast-builder-nowcast-anchor.test.ts`: PASS, 3 suites / 66 tests, including five new missing-field/north cases.
- `node_modules/.bin/eslint --max-warnings=0 lib/services/forecast/forecast-builder.ts __tests__/lib/services/forecast/forecast-builder.test.ts`: PASS.
- `yarn regression:shoaling --no-e2e`: PASS blocking fixture gates A-D and F. External-comparison gate E was SKIPPED, despite the script's PASS label.
- `yarn typecheck`: PASS (67.95 seconds); supersedes the earlier 8-error result.
- `git diff --check`: PASS. Diff self-review found no remaining actionable finding in this increment.

Forecast QA scope: local missingness compatibility, not a live beach diagnosis.

| Layer | Status | Evidence / remaining validation |
|---|---|---|
| Upstream provider | UNKNOWN | No live provider request in this increment |
| Parser/normalizer | UNKNOWN | Parser not changed or independently exercised here |
| Database row | UNKNOWN | No database read/write or regeneration; tests inspect builder output only |
| Transform/scoring | PASS (fixtures only) | Builder component-boundary assertions and shoaling fixture gates |
| UI/display | UNKNOWN | Formatted builder fields asserted; no rendered UI check |
| External comparison | UNKNOWN | Deliberately skipped |

Overall live forecast verdict: UNKNOWN. No fixture or typecheck result qualifies
a study day. No E2E reviewed or run in this increment. Full application build
was run with fixture-only localhost configuration; see the result below.

## Independent no-send tests and build retry

Added existing Phase 26 tests for acquisition, provider-run-store, shadow-evaluation,
attested-run, persisted-history, provider-impact-ingestion, the evaluate cron route,
and their provisional policy fixture to this worktree. Assertions were retained.
The route's forbidden-send mock now targets the existing `lib/notifications/enqueue`
boundary instead of `enqueue-candidates`, which is absent from this no-send package.
An initial virtual mock of that absent aliased module failed Jest resolution; the
final test setup uses the real existing enqueue module and throws if called.

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent --runTestsByPath __tests__/lib/alerts/swell-watch/acquisition.test.ts __tests__/lib/alerts/swell-watch/provider-run-store.test.ts __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/lib/alerts/swell-watch/attested-run.test.ts __tests__/lib/alerts/swell-watch/persisted-history.test.ts __tests__/lib/alerts/swell-watch/provider-impact-ingestion.test.ts __tests__/api/cron/swell-watch-evaluate.test.ts`: final PASS, 7 suites / 97 tests (initially 6 suites / 79 tests passed, one setup failure).
- `node_modules/.bin/eslint --max-warnings=0 __tests__/lib/alerts/swell-watch/acquisition.test.ts __tests__/lib/alerts/swell-watch/provider-run-store.test.ts __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/lib/alerts/swell-watch/attested-run.test.ts __tests__/lib/alerts/swell-watch/persisted-history.test.ts __tests__/lib/alerts/swell-watch/provider-impact-ingestion.test.ts __tests__/api/cron/swell-watch-evaluate.test.ts`: PASS. Route-only lint was repeated after correcting the mock.
- `VERCEL_ENV=preview NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn build`: FAIL twice. First, Turbopack rejected the shared node_modules symlink. After replacing it with a local copy, compilation PASSED (23.1 seconds) and build TypeScript PASSED (72 seconds), but static page generation FAILED with PGRST301 invalid fixture JWT errors. No complete release build PASS.

Dependency setup: verified matching yarn.lock SHA256
`c6b007503d8d7e9fb3b750b5198fea6fd5d893af1d510d5b3b268d1285740879`, then
`mv node_modules .next/node_modules-shared-link` and
`cp -cR /Users/stevenchandler/Desktop/dev/quiver/node_modules /Users/stevenchandler/Desktop/dev/.worktrees/phase-26/no-send-package/node_modules`
both succeeded. The old symlink was retained, not its target deleted. No build
configuration was weakened. No production source files changed in this increment.

Remaining: finish broader package verification and review, then prepare the
consolidated no-send launch approval. The local prerender setup was resolved
below without production credentials. E2E not reviewed/run here.
No deployment, activation, sends, policy installation, study start, or OTA.

## Local anonymous build and full-unit follow-up

Verified the listener on port 54321 belongs to the existing local Supabase Docker
stack. Did not restart/reset it or run `db:local` (that script stops the shared
stack). Read only `SUPABASE_ANON_KEY` from `supabase_studio_quiver`, validated its
JWT role is `anon`, and kept its value out of logs/files. A HEAD request to
`http://127.0.0.1:54321/rest/v1/beaches?select=id&limit=1` with that public local
anonymous key returned 200. No service-role credential was read.

Ran `yarn build` through a Node child process with:

- `VERCEL_ENV=preview`
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in memory to that verified local public key
- `SUPABASE_SERVICE_ROLE_KEY=fixture-only`
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- `SWELL_WATCH_ENABLED`, `SWELL_WATCH_PUSH_ENABLED`,
  `SWELL_WATCH_ACQUISITION_ENABLED`, and `SWELL_WATCH_SHADOW_EVALUATION_ENABLED`
  all explicitly `false`

Result: PASS, exit 0, 113.47 seconds; compilation, TypeScript, page generation and
route output completed. Privileged forecast/water-quality reads still emitted
PGRST301 warnings because the service credential was deliberately invalid.
This is a successful local build with restricted-data fallbacks, NOT a clean
production-data integration check or evidence of safe production recommendations.
It is not an artifact to deploy (it contains localhost build configuration).

Started `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent --bail=0`.
The first full run remains pending. It encountered a stale fixture date in
`__tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`:
June sessions were no longer recent in September. Applied the existing Phase 26
relative-date repair unchanged; retained the recent-history assertion and all
production logic. Focused rerun with the same fixture environment and
`yarn test:unit --runInBand --silent --runTestsByPath __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`
PASSED (1 suite / 59 tests). Scoped lint
`node_modules/.bin/eslint --max-warnings=0 __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`
and `git diff --check` also PASSED. Full run 13929 subsequently FAILED (242.036s):
1390 suites passed, 2 failed, 16 skipped; 17776 tests passed, 2 failed, 195 skipped,
1 todo; all 4 snapshots passed. Failures were the stale session fixture and the
comparison-page source freshness guard. No full-suite pass is claimed.

No production source changed in this increment. E2E not reviewed or run; no study
day, send, activation, deployment or OTA is claimed by these checks.

## Acquisition-route coverage and full-suite repair

Added `__tests__/api/cron/swell-watch-acquire.test.ts`: uses the real cron wrapper,
configuration schema and authentication check with a mocked collector. Covers
auth before default-off, caller-query rejection, malformed/empty/duplicate/over-cap
configuration, exact server cohort, unqualified receipt labeling, busy leases,
sanitized failures and no-store headers. The notification enqueue boundary throws
if called. This is mocked route coverage, not real provider acquisition evidence.

- Same fixture environment as above, `yarn test:unit --runInBand --silent --runTestsByPath __tests__/api/cron/swell-watch-acquire.test.ts __tests__/api/cron/swell-watch-evaluate.test.ts __tests__/lib/alerts/swell-watch/acquisition.test.ts`: PASS, 3 suites / 36 tests.
- `node_modules/.bin/eslint --max-warnings=0 __tests__/api/cron/swell-watch-acquire.test.ts`: PASS.

Reused the existing September 6 comparison-source review from the original web
worktree's `docs/operations/swell-watch-shadow-collection.md` (completed review
section). Transferred its exact three-file diff:
`app/best-surf-forecast-app/comparison-sources.ts`,
`app/best-surf-forecast-app/page.tsx`, and
`__tests__/app/best-surf-forecast-app-metadata.test.ts`. This is an existing
editorial correction required by the full-unit gate, not new comparison research
or a blind review-date bump. The freshness guard and threshold remain unchanged.

- Same fixture environment, `yarn test:unit --runInBand --silent --runTestsByPath __tests__/app/best-surf-forecast-app-freshness.test.ts __tests__/app/best-surf-forecast-app-metadata.test.ts __tests__/app/ahrefs-structured-data-regressions.test.ts`: PASS, 3 suites / 11 tests.
- `node_modules/.bin/eslint --max-warnings=0 app/best-surf-forecast-app/page.tsx app/best-surf-forecast-app/comparison-sources.ts __tests__/app/best-surf-forecast-app-metadata.test.ts`: PASS.
- `git diff --check`: PASS.

Full-unit rerun with the same fixture environment and
`yarn test:unit --runInBand --silent --bail=0` PASSED: 1393 suites and 17791 tests,
4 snapshots, 280.593 seconds. Existing 16 skipped suites, 195 skipped tests and
1 todo remain; this does not count those checks as verified.
The current-package local build also PASSED (153.56 seconds), with the same local
anonymous configuration, invalid service-role placeholder, and restricted-data
warnings documented above. Comparison-page browser verification and the full
Swell Watch release checks remain outstanding. No production changes.

## Focused browser check in progress

Reviewed the existing comparison-page case, error-detection helpers, Playwright
configuration, auth-setup skip and cleanup skip paths. Transferred the existing
one-line title assertion correction in `e2e/guest-seo-updated-surfaces.spec.ts` to
match the real page metadata. No heading/link/error assertion was removed.
`node_modules/.bin/eslint --max-warnings=0 e2e/guest-seo-updated-surfaces.spec.ts`
and `git diff --check` PASSED.

Started `yarn test:e2e e2e/guest-seo-updated-surfaces.spec.ts --project=guest --grep '/best-surf-forecast-app renders' --workers=1 --retries=0`
through a Node child process with the verified local public anonymous key and:
`BASE_URL=http://localhost:3100`, `CRON_SECRET=fixture-only`,
`SKIP_AUTH_SETUP=true`, `SKIP_E2E_CLEANUP=true`,
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`,
`SUPABASE_SERVICE_ROLE_KEY=fixture-only`,
`NEXT_PUBLIC_SITE_URL=http://localhost:3100`, and all four Swell Watch flags false.
The standard Playwright webServer starts its own clean preview build/server;
port 3100 was unused before launch. No server reuse or shared database reset.
Test handle 6431 completed successfully: 1 test PASSED (731ms), total command
120.64 seconds including clean build/server setup. Auth setup and data cleanup
were explicitly skipped. The standard browser error checks passed. Report:
`playwright-report/index.html`; run status: `test-results/.last-run.json`.
Post-run port check found no listener on 3100: Playwright stopped its server.
Used the E2E dev runner skill for environment/result/cleanup evidence tracking.

## Current-base integration review — September 6

Read-only `git ls-remote origin refs/heads/main refs/heads/prod` succeeded and
confirmed the local remote-tracking refs match live heads:

- main: `8813c02df5b43744106fd0eab8e50c48685f57c5`
- prod: `b087d1ac0ebb41f96ea14c5e1b65bb486e8b75ac`
- Both tree objects: `432fa4e496910828f866d91ba8a4bc58906b4960`.

The histories differ, but current main and prod have identical tracked contents.
The package HEAD has 8 unique commits versus 157 on main / 167 on prod; these
counts are not 167 independent missing features. Actual source overlap, not
commit counts, determines the integration work. Do not deploy the old checkout
or merge prod backward into main.

Compared every tracked package modification and untracked package file against
HEAD and origin/main using `git diff --name-only`, `git ls-files --others
--exclude-standard`, and byte comparisons to `git show origin/main:<path>`.
Seven existing paths overlap upstream changes:

1. `lib/services/noaa-wavewatch/types.ts`: preserve upstream inferred-input,
   reported-height, period-basis and source-selection metadata, plus nullable
   provider response arrays. Add the package's field-lineage types and nullable
   secondary tuple without replacing the upstream file wholesale.
2. `types/forecast.ts`: retain `wave_source_selection` in both raw-forecast
   interfaces while adding `offshore_swell_field_sources`; keep nullable S2.
3. `lib/services/forecast/forecast-builder.ts`: retain upstream disagreement
   confidence cap (40), matching persisted quality score, and source-selection
   metadata while applying the package's missing-secondary-component guards.
4. `__tests__/lib/services/forecast/forecast-builder.test.ts`: retain the upstream
   disagreement/quality-score assertion and add the five package missingness
   cases. Neither test set substitutes for the other.
5. `__tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`:
   upstream already fixes the stale arrival date and adds a concurrency test.
   Use upstream unchanged; the package's date-only repair is redundant.
6. `app/best-surf-forecast-app/comparison-sources.ts`.
7. `app/best-surf-forecast-app/page.tsx`.

For the last two, upstream already has a September 6 source review and refreshed
prices. Start from upstream, validate its existing freshness/metadata/browser
assertions, and do not overwrite current editorial changes merely because the
older package needed a freshness repair. Related package-only metadata/E2E
expectation changes require reevaluation against that current page.

`git diff --name-status origin/main HEAD -- supabase/migrations` found 18 files
present only in package HEAD: the 16 previously installed Swell Watch migrations
plus restored Humboldt editorial and email-contact-policy history files. This
is source-history reconciliation, not authorization to reapply migrations.
Other restored history files are already upstream. Preserve installed migration
history and the frozen approval plans; no new schema execution is requested.

Execution plan after this review:

1. Preserve this green package as the original verification baseline; use a
   clean isolated feature worktree from the pinned current-main commit.
2. Transfer only the no-send implementation/test closure and required installed
   migration history. Apply local diffs for existing files, resolving the seven
   overlaps as above. Do not replay old map commits or replace whole forecast
   files. Reevaluate editorial repairs rather than automatically carrying them.
3. Inspect current dependency callers and run focused acquisition/evaluation,
   provenance, source-selection, forecast-builder, discovery and wrapper tests;
   then typecheck, full unit gate, build and relevant browser checks.
4. Review the resulting current-base diff and prepare the consolidated no-send
   production launch plan. Integration checks are not yet run and prior package
   passes do not establish that the current-base result passes.

This review changed documentation only. No runtime, schema, branch contents,
production flags, deployment, sends or OTA were changed. The study has no
verified qualifying start. Remaining real-evidence/full-goal gates still apply.
