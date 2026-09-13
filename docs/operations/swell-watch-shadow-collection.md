---
schema_version: swell-watch-shadow-collection.v2
status: acquisition_route_implemented_local_only
scheduler_status: receipt_acquisition_not_deployed
release_evidence_status: ineligible
---

# Swell Watch Shadow Snapshot Collection

## Provider decision — free API retained, 2026-09-06

The operator explicitly selected continued free Open-Meteo use. No subscription,
API key, customer endpoint or purchase is requested. Current receipt code already
uses `https://single-runs-api.open-meteo.com/v1/forecast`; paid access is not a
technical prerequisite. [Pricing](https://open-meteo.com/en/pricing), checked
September 6, lists Single Runs on Free and invites evaluation/prototyping.
[Hosted-service terms](https://open-meteo.com/en/terms) separately restrict
commercial use, including private commercial research; no-send mode does not
establish permission. Do not represent that unresolved usage restriction as
missing credentials or as verified commercial entitlement.

Next technical gate: independently review exact request/run binding, full-cohort
coverage and completion evidence before owner attestation. Public access, a
successful response, metadata timestamps and hashes alone do not qualify runs.
Then prepare the consolidated no-send runtime/cohort/policy/scheduling scope for
approval; the consumed schema approval did not authorize runtime launch. No
30-day qualifying clock, sends, activation or OTA publication has started.

## Approved evaluation schema installed — 2026-09-06

The maintainer supplied exact approval `6851f70b837c5dfdf8329ef33da6d76f8747259625880cc3b29a5359b63a0104`.
Scoped commit `a69b0149faee074c1055bbeedeb271e0a798c849` contains only the plan
and three approved migrations. All three applied to the linked production DB;
full catalog/body/grant and empty-table postflight passed at 18:49 UTC. Final
dry run reports no pending migrations. Control and historical delivery baseline
are unchanged. See `docs/runbooks/evidence/swell-watch-evaluation-install-20260906.md`.
Earlier pending-installation notes below are superseded. No runtime deployment,
configuration, acquisition, policy/attestation, sends, activation, push or OTA.
The real 30-day qualifying observation has not started.

## Full web regression result — 2026-09-06

FINAL full-suite rerun: PASS, exit zero, 1,414 suites and 17,999 tests passed;
16 suites / 195 tests skipped and one todo remain, four snapshots passed.
Jest duration 222.023s; Yarn elapsed 224.00s. Exact full-suite command is recorded
below. This supersedes the earlier failed result and running checkpoints, not
the unresolved release-build/E2E or real-provider evidence gates. No additional
production-source change was needed after the source-review correction.

E2E follow-up: corrected only the stale document-title expectation in
`e2e/guest-seo-updated-surfaces.spec.ts`; H1 and error-detection assertions remain
unchanged. Reviewed the existing spec, README, configuration, relevant setup/
teardown guards and error-capture helper. PASS scoped ESLint for that spec and
`git diff --check`. PASS discovery (one test, 1.60s), not browser execution:

```sh
CRON_SECRET=fixture-only NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only BASE_URL=http://localhost:3100 SKIP_AUTH_SETUP=true SKIP_E2E_CLEANUP=true yarn test:e2e e2e/guest-seo-updated-surfaces.spec.ts --project=guest --grep '/best-surf-forecast-app renders' --list
node_modules/.bin/eslint --max-warnings=0 e2e/guest-seo-updated-surfaces.spec.ts
```

Target is localhost:3100, guest project, fixture configuration. No server was
started or reused; no browser test, auth setup or cleanup ran. Existing local
release-build prerender failure with fixture JWT remains the browser-run setup
gap; it was not bypassed by weakening the test. Full unit rerun remains live at
this checkpoint. No production source changed in this E2E correction increment.

Latest follow-up: completed the source review and advanced `lastVerified` to
September 6, attributed to Codex rather than claiming editorial-team sign-off.
The freshness guard is unchanged and now passes. Surfline's upgrade page and
support article were verified in a browser despite automated HTTP 403 responses:
Premium $119.99/year and Premium+ $149.99/year, live cams, expert reports and
16-day forecasts. No trial or subscription was started. Removed the stale,
unverified Surfline App Store rating from the comparison. Surf Captain's FAQ
confirms $19.99/year and free five-day versus paid 16-day forecasts.
[Windy.app's guide](https://media.windy.app/guide-ios) confirms free GFS wind maps
and paid additional models/HD/offline; removed the unsupported free-swell-map
claim and disambiguated the app name. Quiver limits were checked against
`lib/alerts/entitlements.ts`, the alert-rules response, and native free-tier gates:
standard limits and growth-rollout access differ. Copy now acknowledges that
instead of promising a uniform paid-only boundary; no entitlement code changed.
Removed the unnecessary unverified beach-count claim. Earlier unfinished-review
notes below are historical and superseded by this completed review.

PASS: the focused command below with
`__tests__/app/best-surf-forecast-app-freshness.test.ts` additionally selected
(11 tests / three suites); scoped ESLint; `yarn typecheck`; `git diff --check`.
`yarn check:comparison-sources` exited zero for ten links (eight HTTP 200 and
the two browser-verified Surfline warnings). A full Jest rerun is in progress;
do not count the focused result as a full-suite pass.

Reviewed the comparison case in `e2e/guest-seo-updated-surfaces.spec.ts`:
its document-title assertion still expects the old title, unlike current page
metadata. That pre-existing E2E assertion needs correction and a local browser
run; neither is complete in this increment. No E2E pass is claimed.

Follow-up source correction: `app/best-surf-forecast-app/page.tsx` now reflects
[LazySurfer's advertised free tier and Pro pricing](https://lazysurfer.app/compare/quiver.html),
[Surf-Forecast's paid 16-day/hourly access](https://www.surf-forecast.com/subscribe),
and [Quiver's seven App Store ratings](https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320).
Added the Premium source to `comparison-sources.ts` and one regression check in
`best-surf-forecast-app-metadata.test.ts`, reusing the existing source assertions.
No layout, dependency or freshness-guard changes. The overall review date remains
unchanged: the remaining claims still need complete review, so the full-suite
freshness failure is NOT resolved or waived.

PASS (10 tests, two suites):

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent --runTestsByPath __tests__/app/best-surf-forecast-app-metadata.test.ts __tests__/app/ahrefs-structured-data-regressions.test.ts
node_modules/.bin/eslint --max-warnings=0 app/best-surf-forecast-app/page.tsx app/best-surf-forecast-app/comparison-sources.ts __tests__/app/best-surf-forecast-app-metadata.test.ts
yarn check:comparison-sources
git diff --check
```

The link checker now covers nine sources: seven HTTP 200, two Surfline bot-wall
warnings. No E2E run or full-suite rerun after these copy corrections; no native
changes, production mutation, commit, deployment, sends or OTA. Reviewed the
scoped diff for duplicate claims and preserved the existing page structure.

The previously running full Jest process finished, exit 1, in 201.014s:
1,413 suites passed, one failed, 16 skipped; 17,997 tests passed, one failed,
195 skipped, one todo; four snapshots passed. Exact command:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent --bail=0
```

The sole failure is `__tests__/app/best-surf-forecast-app-freshness.test.ts`:
the comparison review dated July 8 reached its 60-day expiry. This is an
editorial freshness failure, not evidence of a Swell Watch regression. Do not
advance its date or weaken its assertion without actually reviewing the claims.
`yarn check:comparison-sources` exited zero: six HTTP 200 sources and two
Surfline HTTP 403 warnings requiring manual verification. Link reachability
does not verify comparison claims. Initial official App Store inspection also
found seven ratings versus the page's four-rating structured data; full claim
review and correction remain unfinished.

Only this evidence document changed in this increment; no production source or
test changes, no E2E reviewed/run, no commit, production mutation, deployment,
send or OTA. Full release E2E remains incomplete. The pending installation
proposal is unchanged; real qualifying observation has not started.

## No-send schema batch prepared — 2026-09-06

Follow-up: the separate plan now consolidates the explicitly scoped four-file local
commit and three-file production schema installation into one exact approval token.
Read-only production preflight at 18:26 UTC passed with exactly three pending files,
four absent tables, disabled epoch-zero control and unchanged no-send baseline.
The existing backup hash/readability was revalidated and explicitly selected until
its `2026-09-07T05:01:34.986Z` expiry. No commit or installation has occurred. The
older draft-status sentence below is superseded by that plan's final scope.

Added `SET LOCAL lock_timeout='2s'` and `statement_timeout='30s'` to the three
unapplied migrations `20260906140000`, `20260906150000`, `20260906160000`; no function
logic changed. Exact new hashes, affected objects and recovery boundaries are in
`docs/runbooks/swell-watch-no-send-evaluation-install-plan.md`. That draft is not an
executable approval request: reviewed commit, current production preflight, fresh
backup and exact approval remain absent. The earlier approved installation plan
was not modified.

PASS `bash scripts/test-swell-watch-worker-postgres.sh`: all ten cases, 24.907s Jest,
exit zero with owned containers removed. PASS `git diff --check`; `shasum -a 256`
over the three named migration files matches the draft. Reviewed existing database
harness/probes; no tests added/modified and no TypeScript changes. No browser/native
E2E reviewed/run; full release E2E incomplete. No production reads/writes, credentials,
backup, commit, deployment, notification or OTA in this increment. Runtime provider
entitlement/qualification and actual observation remain unfinished.

## Pinned transport redirect rejection — 2026-09-06

`lib/alerts/swell-watch/single-run-receipt.ts` and `provider-run-store.ts` now
require/pass native fetch `redirect: "error"` for forecast and availability reads.
The existing acquisition wrapper preserves it alongside no-store and the abort
deadline. Stored canonical requests, identity hashes, SQL and qualification state
are unchanged. Reused existing transport tests in `single-run-receipt.test.ts`,
`provider-run-store.test.ts` and `__tests__/api/cron/swell-watch.test.ts`; exact option
assertions cover both callers and wrapper forwarding. Added four surfaced-redirect
cases proving 301/302/307/308 bodies are never parsed into receipts. No new library
or transport abstraction (Ponytail); custom test transports must honor the options.

PASS commands:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent swell-watch
yarn typecheck
node_modules/.bin/eslint --max-warnings=0 lib/alerts/swell-watch/single-run-receipt.ts lib/alerts/swell-watch/provider-run-store.ts __tests__/lib/alerts/swell-watch/single-run-receipt.test.ts __tests__/lib/alerts/swell-watch/provider-run-store.test.ts __tests__/api/cron/swell-watch.test.ts
git diff --check
```

Final unit result: 31 suites / 316 tests. Reviewed direct callers and wrapper
forwarding. Typecheck followed production changes; subsequent changes added only
redirect test cases and this record. No browser/native E2E reviewed or run, no new
PostgreSQL drill (SQL unchanged), no real provider request, credentials, deployment,
send, commit or OTA. Full E2E and actual provider qualification remain incomplete.

## Provider qualification path clarified — 2026-09-06

Read-only upstream review changes the next action: absence of an echoed run ID is
not by itself evidence that Single Runs cannot qualify. The provider documents
`run` as the UTC initialization of an independently retrievable forecast, distinct
from availability time ([Single Runs documentation](https://open-meteo.com/en/docs/single-runs-api)).
This supports a reviewable request-bound contract; it does not prove any collected
response, deployment identity, archive immutability, or completed evaluation.

The [official controller at revision 6c45053fb1ef0c049de931292a0f5cb35f14c0ba](https://github.com/open-meteo/open-meteo/blob/6c45053fb1ef0c049de931292a0f5cb35f14c0ba/Sources/App/Controllers/ForecastapiController.swift)
recognizes public and customer Single Runs hosts, requires `run`, passes it into
reader settings, and maps `ncep_gfswave016` to the GFS wave reader. Local request
construction already pins the model/run and explicitly selects sea cells. Source
inspection is supporting evidence, not proof of the hosted server's exact version.

The [pricing matrix](https://open-meteo.com/en/pricing) places commercial Single Runs
access in Professional/Enterprise, not Standard. It allows free-tier evaluation and
prototyping but describes free access as non-commercial. No account entitlement was
verified or purchased here; public endpoint availability cannot establish it.

Concrete remaining work:

1. Establish the approved account/usage entitlement and exact transport endpoint.
2. Implement customer transport only if needed, without persisting keys. The current
   TypeScript request and installed receipt RPC both require the public canonical
   URL; blindly appending `apikey` would leak a credential into durable receipts and
   violate SQL validation. Preserve semantic run identity across transport changes,
   while truthfully recording which endpoint was used; review any schema delta.
3. Review a bounded real run sample: request/run binding, complete expected scope,
   exact component fields, unavailable slots and revision/correction behavior.
   Use the existing owner attestation only after that review; never self-qualify a
   fetch or make repeated captures count as independent evaluations.
4. Start reviewed no-send acquisition/completion/evaluation orchestration and record
   actual qualifying coverage. The thirty-day clock remains unstarted.

Verification: public docs and pinned source read; `gh api repos/open-meteo/open-meteo/commits/main --jq .sha`
PASS returned the revision above. Reviewed local request construction and installed
receipt URL validation with `rg`/`sed`. Documentation only changed; no runtime code,
tests, E2E, secrets, provider forecast requests, production writes, sends or OTA.

## No-send evaluation callback — local implementation, 2026-09-06

Added `POST /api/cron/swell-watch-evaluate`, independently default-off under
`SWELL_WATCH_SHADOW_EVALUATION_ENABLED`. Cron authentication is checked before the
flag. The strict body accepts only `provider_batch_id`; query parameters are
rejected. The existing server producer configuration supplies a unique cohort
(at most ten source points) and a hash-valid V2 policy with the 24-hour window.
The database evaluation-policy ledger, not caller metadata or push authority,
remains responsible for authorizing matching. This route only invokes the existing
shadow evaluator; the send callback is unchanged. Responses are private/no-store;
internal errors are sanitized.

Changed runtime file: `app/api/cron/swell-watch-evaluate/route.ts`.
Added tests: `__tests__/api/cron/swell-watch-evaluate.test.ts`. Reviewed the existing
acquisition/send route tests and shadow evaluator tests. No browser E2E was changed
or run: this batch covers server callbacks, not a UI flow. Deployed HTTP integration
remains unverified; the real-database callback integration is verified below.

Verification commands from the web worktree:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent __tests__/api/cron/swell-watch-evaluate.test.ts __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/api/cron/swell-watch.test.ts
yarn typecheck
node_modules/.bin/eslint --max-warnings=0 app/api/cron/swell-watch-evaluate/route.ts __tests__/api/cron/swell-watch-evaluate.test.ts
git diff --check
```

The focused suite passed 55 tests across three suites; typecheck and diff check
passed. Initial scoped lint found one conditional test assertion; replaced it with
an unconditional call-count assertion, then scoped lint passed. No deployment,
environment change, schedule, migration application, provider request, notification,
commit, push, or OTA publication occurred. No qualifying day was established.
Next operational work is reviewed acquisition/attestation/completion orchestration
and end-to-end invocation of this callback; real 30-day evidence remains required.

### Callback-to-database integration verified

Extended the existing `__tests__/notifications/swell-watch-worker-postgres.drill.ts`
full-horizon case to call the actual POST handler with server configuration and
cron authentication. Only the service-client factory and cron telemetry wrapper
are substituted; scope loading, evaluator, ingestion, matching, audience, and
recorded-demand RPCs execute against disposable PostgreSQL/PostgREST. Both live-send
flags are false, push authority is revoked and control is shadow. Assertions require
impacts to advance from one to three, one stable event/recipient, identical callback
and helper retries, private/no-store responses, and unchanged notification queue,
bindings, announcements, delivery attempts, control and authority snapshots.
Environment and factory overrides are restored in `finally`.

`bash scripts/test-swell-watch-worker-postgres.sh`: initial FAIL, nine of ten passed
because the test assumed the service factory was already a Jest mock. Added an
explicit factory mock; final PASS all ten cases (24.746 seconds Jest). An initial
`yarn typecheck` failed on closure inference for `storedRuns`; added its explicit
existing completion-result type; final `yarn typecheck` PASS. Final
`node_modules/.bin/eslint --max-warnings=0 __tests__/notifications/swell-watch-worker-postgres.drill.ts`
and `git diff --check` PASS. Independent source review found no actionable finding.
No production runtime files changed in this follow-up. No browser/native E2E was
run; full release E2E remains incomplete. Fixture provider transport and fixture
attestations are not real issuance qualification or qualifying observed days.

## Current deployment scope — 2026-09-06

### Current qualification review and minimal owner procedure

Source audit on September 6 confirms the exact-run binding is documented by the
[Single Runs contract](https://open-meteo.com/en/docs/single-runs-api). An echoed
run field is not required by that contract. The parser's retained
`prototype_unqualified` reason is a conservative acquisition label, not evidence
that the provider lacks request-bound semantics. Do not change stored labels or
installed migrations to bypass owner review.

`completeAttestedProviderRun` has no operational caller in `app/`, `lib/` or
`scripts/`; only the disposable drill exercises attestation followed by completion.
The acquisition GET and no-send evaluation POST are implemented. The older
implementation proposal below is historical, not a request to build them again.

Smallest operational sequence, pending reviewed runtime authorization:

1. Freeze exact public-beach UUID/region/coordinate membership, seven-day scope,
   evaluation policy/hash, cadence and deployment revision. Keep all send paths
   disabled. Do not substitute fixture identities or policy approval evidence.
2. Acquire through the existing leased path. Retain exact request/raw bytes and
   stored issuance/batch/revision-set identifiers. A failed cohort cannot shrink
   into successful coverage.
3. Independently review that revision set: documented pinned model/run request,
   expected grid/slot/unit/field coverage, raw-to-stored equality, explicit
   unavailable components and latest-revision status. Hash the actual review
   evidence; neither a digest nor a reviewer name alone proves qualification.
4. Under approved owner access, record that exact decision with
   `attest_swell_watch_provider_run`; then use the existing completion RPC. No
   service-role self-attestation or new HTTP attestation endpoint is needed.
5. Invoke the existing no-send evaluation POST with the returned completed batch
   ID. Verify persisted outcomes/demand and unchanged queue/delivery/control
   baseline. Record real coverage and gaps; repeated issuance is not a new run.

This is a proposed procedure, not an executed batch or accepted attestation.
Retained September 5 captures of September 3 runs show bounded transport and
missingness, not prospective operational coverage. Independent Terra review
agrees: documented request binding suffices; existing mechanisms support a manual
owner procedure without a new identity mechanism or HTTP attestation service.
Its required evidence manifest contains the real revision-set ID, run/model/
transport, scope hash/members, parser/schema version, raw/canonical hashes,
valid/unavailable counts and contract reference. Completion means this scoped
application cohort is persisted, not provider-wide publication completion.
The review's stale statement that migrations are unapplied is superseded by the
two verified installation receipts above; no fresh production poll ran here.
Current focused regression PASS: two suites / 24 tests, 0.66s Jest, using:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent --runTestsByPath __tests__/lib/alerts/swell-watch/single-run-receipt.test.ts __tests__/lib/alerts/swell-watch/provider-run-store.test.ts
```

Only this operational document changed in this review increment. No new tests,
production source, database changes or external acquisition. No E2E reviewed/run;
release E2E remains incomplete. Free hosted-service usage restrictions remain
separate and unresolved; no paid transport is proposed.

### Historical implementation proposal — superseded by installed/local work above

This section supersedes historical statements below about an active snapshot heartbeat. Its current scheduler state has not been revalidated here. That legacy SELECT-only collector is not the canonical receipt collector and cannot establish qualifying days. The production schema installation is complete; see `docs/runbooks/evidence/swell-watch-schema-install-20260906.md`. No acquisition runtime was deployed or started by that installation or this planning update.

Operator request: prepare the next no-send collection deployment scope. This document is an implementation/deployment proposal, not authorization to push, deploy, schedule, fetch production provider data, write attestations, or activate notifications. Preserve the Phase 25 OTA hold. No Swell Watch sends of any version or device class during the 30-day verification window; no automatic activation afterward.

### Inspected implementation and concrete gaps

- `app/api/cron/swell-watch/route.ts` accepts authenticated POST `{ "action": "acquire" }`, reads a fixed server cohort, selects the latest available issuance after a ten-minute replication delay, and acquires seven days. It returns `prototype_unqualified` and never completes or enqueues on this branch.
- The existing `vercel.json` entry schedules `/api/cron/swell-watch` at `0 15 * * *`. Its GET handler is the legacy major-swell shadow evaluator, not the POST acquisition branch. Reusing that schedule does not start receipt acquisition.
- The same POST route also accepts completed-batch callbacks. With cohort-only configuration and no policy, these reject with 503 before database access. Do not supply a fabricated production policy to enable raw collection.
- `single-run-receipt.ts` and `provider-run-store.ts` currently hard-code the public Single Runs endpoint/model. There is no customer endpoint/key configuration in this path. Existing access or a successful public response is not proof of commercial entitlement or operational issuance qualification; verify the actual account/provider contract before production collection.
- Acquired bytes and availability metadata do not prove response-to-issuance binding. Qualifying evaluations, owner attestation, reviewed policy and representative coverage remain distinct unfinished work.

### Proposed smallest implementation batch

1. Reuse the existing acquisition function, parser and atomic receipt RPC. Add a dedicated cron-authenticated GET acquisition entry point, `/api/cron/swell-watch-acquire`, with no completed-batch dispatch branch. Extract only the shared acquisition operation needed by the existing POST and new GET; do not duplicate provider or storage logic.
2. Give acquisition its own fail-closed enable switch, `SWELL_WATCH_ACQUISITION_ENABLED`. Keep `SWELL_WATCH_ENABLED` and `SWELL_WATCH_PUSH_ENABLED` false for this deployment. This avoids also enabling the legacy all-beach GET evaluator or completed-run processing when enabling the fixed-cohort collector. Preserve installed API behavior when acquisition is disabled.
3. Resolve the entitled endpoint/authentication contract before changing transport. If supported customer routing is required, allow only the reviewed provider host and keep credentials out of persisted canonical request URLs, raw receipts and logs. No guessed host, silent public-endpoint fallback or paid subscription purchase.
4. Proposed schedule: hourly at minute 15, initially disabled until separately approved. Each invocation queries availability and the exact fixed cohort, using the existing 240-second acquisition deadline within the 300-second route limit. Proposed initial cap: at most ten explicitly listed public beaches, selected for the launch-region/partition coverage matrix. Ten is an operational pilot cap, not proof that this cohort satisfies release coverage. No user/device/favorite/custom-spot data acquisition. Freeze exact UUID/region membership before deployment approval; do not auto-discover or silently reduce it.
5. Require non-overlap and a bounded retry policy before scheduling. Use an existing scheduler concurrency guarantee if verified; otherwise add the smallest reviewed lease mechanism. No immediate retry loop. The next scheduled invocation may retry identical receipt storage; identity reuse never counts as a new issuance. Worst-case raw HTTP request count at this proposed cadence is `24 × (1 + cohort size)` per day before failures/retries, not a provider billing estimate. Verify provider limits, weighted usage and measured execution duration before accepting the cohort/cadence.

No new table is proposed merely for raw storage. A lease requiring schema changes must be identified and separately reviewed before implementation/application. Source integration must be scoped to reviewed Phase 26 files; do not deploy the entire dirty worktree incidentally. Backend build/release gates remain required.

### Verification before runtime approval

- Extend existing cron tests for authenticated GET acquisition, disabled behavior, fixed server membership, malformed configuration and provider failure. Assert no completion/ingestion/enqueue call is reachable; test the legacy GET and completed POST remain disabled under collection-only configuration.
- Preserve existing real-PostgreSQL receipt retry, unavailable-component and partial-scope rejection checks. Add the smallest overlap test for the chosen scheduler/lease contract. Test distinct genuine request issuances separately from duplicate captures.
- Run scoped Jest, typecheck, scoped lint, existing PostgreSQL receipt/worker drills and the production build gate for the actual deployment revision. Independent review must cover shared-worker compatibility and the no-send boundary.
- Bind the final approval to an immutable release revision, actual cohort UUIDs/regions, provider entitlement/endpoint, secret names (not values), cadence, non-overlap behavior, exact deployment/configuration commands and stop procedure. Do not reuse the schema-installation approval token.
- Verify deployed Swell Watch registry channels are empty, push flag false and database control disabled; confirm authority/attestation tables remain empty. Do not infer deployed settings from local source. Check all-version queue/delivery counts against the preserved July baseline and specifically require zero v2 rows. Leave unrelated notification types enabled.
- After separately authorized deployment, start with one bounded acquisition and inspect stored scope/component completeness and retry identity before authorizing recurring operation. Unexpected queue/delivery writes, changed membership, malformed provenance, overlap or partial coverage stop collection and invalidate the affected evidence; retain records for diagnosis. Disable the acquisition switch/schedule, never delete tables or restore over concurrent user writes as a kill switch.

### What starts the 30-day verification window

#### Local rolling recorded-demand ledger — not wired or release-ready

Follow-up: the two targeted regression gaps are closed. The SQL fixture proves valid fallback succeeds and revoked/expired/future fallback rejects an identical retry with no extra ledger row. The existing transaction-race harness now observes the demand writer blocked on the provider advisory lock, commits owner revocation, requires the specific evidence rejection, and verifies no demand row appeared. Independent read-only review confirmed both tests address its findings; `bash scripts/test-swell-watch-worker-postgres.sh` passed all 10 cases plus probes (26.824s Jest).

Local TypeScript integration now exists in `lib/alerts/swell-watch/shadow-evaluation.ts`: records consolidated recipient/event pairs and validates the returned immutable timestamp and nonnegative safe-integer count. Only aggregate `recordedDemand` is returned; it is not delivery-eligible send count or complete coverage. Tests updated: `__tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts` and the existing worker drill. Invalid/empty receipts and RPC errors fail closed with sanitized error text; unknown delivery health and eligible 24-hour budget remain unknown. No HTTP/scheduler integration or production deployment occurred.

Final integrated gates PASS: `bash scripts/test-swell-watch-worker-postgres.sh` (all probes and 10/10 cases, 26.189s Jest), `yarn typecheck` (8.82s), `git diff --check`. Independent wiring review found no actionable issue. These prove local fixture-driven recording, not genuine observations or a running production collector.

Focused command PASS (37 tests / 3 suites): `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/lib/alerts/swell-watch-safety.test.ts __tests__/lib/alerts/swell-watch/enqueue-candidates.test.ts`. PASS: `node_modules/.bin/eslint --max-warnings=0 lib/alerts/swell-watch/shadow-evaluation.ts __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/notifications/swell-watch-worker-postgres.drill.ts`. Final database/typecheck results below supersede earlier disconnected-helper statements. Browser/native E2E not reviewed/run; no production data, sends or OTA changes.

Added `supabase/migrations/20260906160000_record_swell_watch_shadow_demand.sql` and extended the existing policy SQL probe/worker harness. The separate shadow ledger stores canonical recipient/event pairs per completed batch/policy, with permanent first-seen pair dedupe and an immutable observation time/count snapshot. Changed pairs for an existing evaluation reject; identical retries return the original snapshot. The counter includes first observations in `(observed_at - 24 hours, observed_at]`, never refreshes old pairs on retries, and never touches real-send reservations or recipient announcements. It is recorded pre-safety demand, not delivery eligibility or complete observation coverage. Private tables deny all runtime direct access; only the service recording RPC is exposed.

Independent review found missing validation of legacy fallback authority and a provider-revocation race. Source fixes now require unrevoked, unsuperseded, finite in-window authority and acquire the provider-run lock before the control lock. Dedicated invalid-fallback and concurrent-revocation regression tests remain required before declaring this slice reviewed. Initial probe plus 10 worker cases passed (25.323s); strengthened probe adds expired/recent/future fixture timestamps to prove window exclusion and retry time/count preservation. Final rerun result follows below. The TypeScript shadow helper does not yet call this RPC and its published rolling metric remains null.

No production application, credentials, provider collection, real sends, commit, push or OTA. Browser/native E2E not reviewed/run; full release remains incomplete. Existing database fixture setup/worker drill were reviewed. Only the new SQL, SQL fixture, harness and this operations record changed in this increment; application unit/typecheck gates were not rerun for SQL-only work.

Final available gates PASS: `bash scripts/test-swell-watch-worker-postgres.sh` (strengthened timestamp/retry probe and 10 worker cases, 99.938s Jest; same live process retained throughout the slower run), `bash -n scripts/test-swell-watch-worker-postgres.sh`, `git diff --check`. These do not close the specifically requested fallback-authority/revocation-race test gaps. Next: those regressions, then TypeScript integration of recorded demand without relabeling it eligible sends or complete coverage.

#### Shared no-send safety calculation

Changed `lib/alerts/swell-watch/safety-control.ts` to extract the existing policy/hold calculation as pure `evaluateSwellWatchSafety`; the live wrapper retains transition writes and treats missing metrics as `invalid_hold_input`. Changed `shadow-evaluation.ts` to use the same per-region candidate/per-event recipient maxima and continuity/disagreement flags without writing holds. It returns known safety reasons plus explicit missing 24-hour projection/delivery-health metrics, never a passing send-eligibility claim. Rolling-window accounting is still unimplemented, not zero.

Updated `__tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts` for unknown metrics and mixed-cohort discontinuity; updated `__tests__/lib/alerts/swell-watch-safety.test.ts` for each runtime-null metric and both together. Independent review identified the live-wrapper null risk; the final wrapper checks missing metrics and all three regressions pass. PASS: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/lib/alerts/swell-watch/enqueue-candidates.test.ts __tests__/lib/alerts/swell-watch-safety.test.ts` (33 tests / 3 suites); `yarn typecheck` (6.75s); `bash scripts/test-swell-watch-worker-postgres.sh` (10 cases, 24.127s Jest). Scoped ESLint command: `node_modules/.bin/eslint --max-warnings=0 lib/alerts/swell-watch/safety-control.ts lib/alerts/swell-watch/shadow-evaluation.ts __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/lib/alerts/swell-watch-safety.test.ts`.

Existing database E2E drill reviewed and rerun; no browser/native E2E reviewed/run. No SQL, production environment, deployment, provider acquisition, real sends or OTA changes. Full release E2E, actual 24-hour shadow accounting and qualifying observation remain incomplete.

#### Local projection increment — incomplete pending evaluation-policy schema approval

#### Database-backed shadow projection follow-up

Extended only `__tests__/notifications/swell-watch-worker-postgres.drill.ts` to call the actual shadow helper, real attested ingestion/matching and real paginated audience loader. The existing two-beach/two-run fixture now installs an evaluation policy, revokes the current push authority, resets control to shadow and clears the static push flag **before** the first successful current-cohort ingestion. It requires one stable regional event and one pre-safety recipient, retains actual evaluation/policy identity, excludes recipient/beach IDs from returned aggregate evidence, and checks impact counts advance from 1 to 3 exactly once. Retry must return identical evidence with 3 impacts. Queue, bindings, announcements, delivery attempts, control and authority-row counts must remain unchanged; delivery-health access must reject revoked authority. Valid fixture send authority is restored only afterward for the original recording-transport regression.

The first real-database version passed all 10 cases (25.832s) but independently reviewed coverage exposed that it only replayed a previously ingested stable cohort. Moving the shadow invocation earlier and asserting fresh impact advancement fixes that limitation; final rerun result is recorded below. This test uses revoked current authority, not an empty authority table; the separate transactional SQL probe proves identity ingestion with an entirely empty push-authority table. Neither represents genuine provider evidence. No production source/schema changes in this follow-up; no real notifications or external production access. No browser/native E2E reviewed/run; full release remains incomplete.

Final follow-up gates PASS: `bash scripts/test-swell-watch-worker-postgres.sh` (10/10 cases, 24.447s Jest), `yarn typecheck` (7.12s), `node_modules/.bin/eslint --max-warnings=0 __tests__/notifications/swell-watch-worker-postgres.drill.ts`, and `git diff --check`. The remaining implementation gap is no-send safety/rolling-window accounting and operational integration, not replaying this positive fixture. No full unit or release E2E rerun this increment.

Update after the operator clarified standing local authorization: evaluation-policy separation is now implemented locally in `20260906150000_separate_swell_watch_evaluation_policy.sql`; **not applied to production**. The owner-only append-only epoch ledger shares the existing control lock. Detection reads its latest active in-window policy; revoked/expired/future entries do not fall back to push approval. Legacy push-policy lookup remains only when no evaluation ledger exists. Release/health/control functions remain unchanged. A mechanical comparison confirmed the resolver body changes only its policy-reader call; the previously applied migration was not edited.

The new transactional fixture `__tests__/fixtures/swell-watch-evaluation-policy-probe.sql` and existing `scripts/test-swell-watch-worker-postgres.sh` exercise this against disposable PostgreSQL. Initial probe plus all 10 existing worker tests passed (23.757s Jest): detection and retry identity with empty push authority, unchanged queue/control/bindings, delivery-health rejection, revocation rejection and runtime privilege checks. Fixture transactions roll back and the harness removes its dedicated containers. Independent review found no source defect but requested a non-vacuous fallback test with valid push authority; that test now covers legacy fallback, evaluation precedence, revocation, expiry and future start. Final rerun evidence follows when complete.

Standing local authorization removes the earlier approval pause below. Next remains real database-to-shadow-helper stable-audience proof, no-send health/window accounting, operational policy/attestation procedures and genuine coverage. These are incomplete, not implied by successful scalar identity ingestion. No production credentials, mutations, deployment, collection, sends or OTA actions occurred. No browser/native E2E reviewed/run; full release E2E remains incomplete.

Final separation verification: `bash scripts/test-swell-watch-worker-postgres.sh` PASS, including both transactional policy probes and 10/10 worker cases (23.193s Jest). `bash -n scripts/test-swell-watch-worker-postgres.sh` and `git diff --check` PASS. No application TypeScript changed in this schema increment; full unit/typecheck gates were not rerun. The preceding projection helper's tests/typecheck remain dated evidence, not real-database projection proof.

Added `lib/alerts/swell-watch/shadow-evaluation.ts` and `__tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts`. Reuses existing attested ingestion, persisted matching, audience loader and regional/recipient consolidation; returns aggregate pre-safety audience and suppression reasons with evaluation/policy identity. Does not call enqueue/control/claim/delivery-health operations. Missing coverage returns null demand, not zero. Rolling 24-hour projection and delivery health remain null; `sendEligibility` is explicitly `not_evaluated`. No route or scheduler imports this helper; no SQL was changed.

Independent review found two issues: (1) **unresolved operational blocker** — ingestion's regional resolver requires `swell_watch_get_production_authority()` in migration `20260905020000`, so the helper cannot ingest detected events against the installed empty-authority state; (2) fixed misleading projection naming by explicitly calling it `preSafetyRecipientsThisEvaluation` and testing mixed stable/discontinuous cohorts. This is not full send-selection parity, an operational shadow evaluator, or qualified evidence. Do not create push authority to bypass (1).

Next requires approval for a **local-only evaluation-policy authority schema implementation and real PostgreSQL tests**, separately from production installation. Keep immutable reviewed matching values available to detection without granting release authority; preserve push approval, control and queue checks. Required positive database proof: ingest/match/count a stable cohort with empty push authority, disabled control, and unchanged queue/announcement tables. Required negatives: invalid/revoked/superseded evaluation policy and provider evidence must still fail closed. No production application, credentials or collection is included.

Final commands: PASS `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/lib/alerts/swell-watch/enqueue-candidates.test.ts __tests__/lib/alerts/swell-watch-audience.test.ts __tests__/lib/alerts/swell-watch-consolidation.test.ts` — 4 suites / 49 tests. PASS `yarn typecheck` (10.90s). Initial combined run named a nonexistent regional-consolidation test and discovered only three suites; the corrected command above includes the actual consolidation suite. No browser/native E2E reviewed/run, no real database drill for the new helper, and no external or production actions. Full release remains incomplete.

September 6 source audit confirms the no-enqueue orchestration is missing, not merely undeployed. `enqueueAttestedSwellWatchCohort` ingests, then checks armed production control **before** persisted matching and audience selection. `enqueueSwellWatchCandidates` also rejects disabled control before audience reads. `read_swell_watch_delivery_health` requires current `swell_watch_push` authority; its real-send ledger is not a shadow projected-send ledger. Therefore a disabled callback's zero audience/enqueue counters are not measured zero demand. Do not arm control, manufacture authority, or substitute actual-send counts to work around this.

Next local implementation: reuse ingestion, persisted matching, regional consolidation and recipient selection in an evaluation-only path, without queue/control/claim writes or delivery authority. Preserve sender guards and selection parity. Return explicit unavailable health/coverage rather than fake zero, distinguish a per-evaluation projected audience from the rolling 24-hour deduplicated projection, and retain immutable evaluation/policy identity with aggregate-only evidence. Tests must prove positive stable multi-beach demand while sending remains disabled, suppression/missingness behavior, repeat identity and no forbidden RPC/queue calls. Any new persistence schema or production audience reads require their own approval; local fixture implementation does not.

Audit regression added in `__tests__/lib/alerts/swell-watch/enqueue-candidates.test.ts`: a positive detected run is ingested while disabled but never reaches matching, audience, health, control RPCs or queue writes. PASS: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent __tests__/lib/alerts/swell-watch/enqueue-candidates.test.ts __tests__/lib/alerts/swell-watch-safety.test.ts __tests__/lib/alerts/swell-watch-audience.test.ts` — 3 suites / 41 tests (40 before the regression). Production source unchanged. No E2E reviewed/run or external requests; full release remains incomplete.

Raw collection alone does not start it. Before labeling any day qualifying, establish the reviewed provider issuance/completion contract, actual response/run binding and per-component provenance, operational owner-attestation procedure, versioned evaluation policy, and explicit coverage/gap rules. Compose the existing attested ingestion and read-only evaluation/audience calculation without invoking `enqueueAttestedSwellWatchCohort`, reserving sends, or writing recipient-announcement claims. If that no-enqueue orchestration is missing, implement/test it before starting qualification. Do not arm production control to make shadow evaluation work.

Record real distinct completed evaluations, missing/unavailable partitions, candidate/suppression outcomes and projected audience counts without sending. Missing partitions remain missing—not zero-height qualifying swells. Gaps and duplicated issuance captures cannot inflate qualifying coverage. Only thirty genuinely qualifying observed days plus reviewed policy/evidence and the remaining native/release checks can satisfy the full goal. Activation remains a later explicit decision.

### Local acquisition implementation — 2026-09-06

Implemented `/api/cron/swell-watch-acquire` as a cron-authenticated, default-off GET, controlled only by `SWELL_WATCH_ACQUISITION_ENABLED`. It rejects caller query parameters and invalid/duplicate/over-ten-beach server cohorts, applies private no-store response headers, returns unqualified receipts and zero enqueues, and imports no completed-run orchestration. The shared `lib/alerts/swell-watch/acquisition.ts` owns cohort schema, fixed membership loading and the existing seven-day/240-second no-store provider operation. Existing POST acquisition now reuses it; completed-run policy validation and legacy master-switch behavior are preserved. `vercel.json`, deployed environment, provider endpoint/authentication and SQL were not changed.

Four new cron tests cover authentication/default-off, collection-only isolation from legacy/completed processing, caller/config rejection and sanitized acquisition failure. Initial test run failed because the new route did not exist; after implementation the exact targeted command passed 3 suites/48 tests: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent __tests__/api/cron/swell-watch.test.ts __tests__/lib/alerts/swell-watch/provider-run-store.test.ts __tests__/lib/alerts/swell-watch/single-run-receipt.test.ts`. `yarn typecheck` passed (6.68s). Scoped ESLint over the two routes, acquisition helper and cron test passed; `git diff --check` passed. Independent read-only review found no actionable issue in the collector slice. This does not review/approve lease behavior, entitlement, scheduling or deployment.

`yarn deadcode` initially failed environment validation; with the same fixture environment it ran and failed on global unused/unlisted/duplicate findings (including six previously reported unused files). No broad cleanup or waiver was made. `VERCEL_ENV=preview NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn build --webpack` FAILED during forecast-page prerender: fixture-only JWT is not a valid local database credential (`PGRST301`); compilation and build TypeScript completed. This is an unresolved build-environment gate, not a passing build. No UI E2E was reviewed or run for this backend slice; full release E2E remains incomplete. No credentials, provider acquisition, database mutation, commit, push, scheduling, sends or OTA occurred.

The [current Vercel cron documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs#controlling-cron-job-concurrency) confirms overlapping and duplicate invocations are possible. Existing cron observability is not a lock. A search of repository cron/runtime helpers found no reusable distributed lease. A separate request now seeks approval for a local-only lease migration/RPC and concurrency tests; no new schema was implemented under the earlier schema-install token. Provider documentation establishes the public [Single Runs interface](https://open-meteo.com/en/docs/single-runs-api), but does not verify Quiver's commercial entitlement or customer routing for this path. Those remain operational release prerequisites, not reasons to mark raw captures qualified.

### Local collector lease — 2026-09-06

The user approved local-only implementation and tests, not production installation. Added `supabase/migrations/20260906140000_add_swell_watch_collection_lease.sql`: one ten-minute owner-token lease, service-only claim/release RPCs, and a receipt wrapper that checks ownership/expiry under a row lock through the existing atomic receipt write. Direct table access is denied. Both collector routes use the shared leased acquisition helper; a busy collector skips before scope/provider I/O, and cleanup uses the same owner token. The original receipt RPC remains callable for compatibility: this coordinates these collector routes, not arbitrary service-role writers.

Changed production-source files in this increment: that new, unapplied migration and `lib/alerts/swell-watch/acquisition.ts`. Tests added/modified: `__tests__/lib/alerts/swell-watch/acquisition.test.ts`, `__tests__/api/cron/swell-watch.test.ts`, `__tests__/notifications/swell-watch-worker-postgres.drill.ts`; harness updated: `scripts/test-swell-watch-worker-postgres.sh`. The existing database drill and provider receipt fixture were reviewed. No UI E2E was reviewed or run; final release E2E remains incomplete.

Verification commands:

- PASS: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent __tests__/api/cron/swell-watch.test.ts __tests__/lib/alerts/swell-watch/acquisition.test.ts __tests__/lib/alerts/swell-watch/provider-run-store.test.ts __tests__/lib/alerts/swell-watch/single-run-receipt.test.ts` — 4 suites, 54 tests.
- PASS: `yarn typecheck` — 125.10 seconds.
- PASS: `node_modules/.bin/eslint --max-warnings=0 lib/alerts/swell-watch/acquisition.ts __tests__/lib/alerts/swell-watch/acquisition.test.ts __tests__/api/cron/swell-watch.test.ts __tests__/notifications/swell-watch-worker-postgres.drill.ts`.
- First `bash scripts/test-swell-watch-worker-postgres.sh` run: FAIL, 1 failed / 9 passed; new lease test omitted required fixture argument `p_height`. Corrected the test call to supply height 1; no production logic changed for this failure.
- Corrected `bash scripts/test-swell-watch-worker-postgres.sh`: PASS, 10/10 real PostgreSQL drill cases (27.562 seconds Jest); isolated containers cleaned up by the harness. Delivery cases use recording-only fixtures, never real Firebase.
- PASS: `git diff --check`.

Independent read-only lease review found no actionable correctness issue. No production database access/mutation, provider collection, schedule, commit, push, deployment, send, activation or OTA occurred in this increment. The new migration still requires separate production review/approval. Entitlement, qualification orchestration, real thirty-day evidence and full release gates remain outstanding; this lease does not start the qualifying clock.

#### Historical planning-only evidence

Inspected the cron GET/POST dispatch, server cohort validation, acquisition deadline/metadata selection, receipt endpoint/parser, local registry channels, existing schedule and cron regression assertions. This increment changes only this operations document. No production source, tests, SQL, environment, automation or deployment was changed. Tests/E2E were not run for this planning-only update; final E2E remains incomplete. Provider entitlement and actual deployed configuration were not inspected or assumed. The earlier schema-install receipt remains authoritative for its separately verified database state.

## Historical SELECT-only snapshot collector

The collector makes bounded, paginated `SELECT` requests only to `enhanced_forecasts` and `gfs_wave_shadow_forecasts`. It does not query users, devices, relationships, notifications, or custom spots; it does not call upstream providers, RPCs, cron, enqueue, FCM, or any mutation path.

Independent review passed for the corrected V2 collector. The current-thread heartbeat `swell-shadow-evidence-collection` is active every six hours. It remains a bounded SELECT-only evidence collector, not an activation path; any collection failure pauses the evidence run for review.

## V1 quarantine and correction

The two prior V1 captures remain private, ignored, and untouched, but are **quarantined**: they are excluded from deduplication and all evidence accounting. V1 incorrectly treated null values as numeric zero and did not faithfully preserve formatted canonical units/cardinals or raw Open-Meteo S2. Their row counts and hashes are not data-quality evidence.

V2 keeps absent tuple values null, preserves a genuine numeric zero as zero, parses canonical display heights from feet to meters and cardinal directions to degrees, and stores raw Open-Meteo primary/secondary observations separately. `NOAA_NWS` maps to `noaa`, `OPEN_METEO` maps to `open_meteo`, and all other labels become the sanitized enum `FALLBACK` or `UNKNOWN`; raw source strings never persist.

## Verified V2 captures

| Capture                                         | Artifact SHA-256                                                   | Manifest integrity SHA-256                                         | Queried |    New | Deduplicated | Enhanced / raw OM shadow | V1 quarantined |
| ----------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------: | -----: | -----------: | ------------------------ | -------------: |
| `capture-2026-09-03T18-52-55-712Z-c7b7ac060b26` | `9cf8ff3da98f8f55dc3e8e4f7ffdf4639371063c75be95f8efca4850ca630c60` | `e1f32cc7c2340394117d72c5bd84929bade61b89c4dcc59f7016a3f07ae3f7b3` |  95,236 | 95,236 |            0 | 66,453 / 28,783          |              2 |
| `capture-2026-09-03T18-53-28-993Z-fafb0b52d299` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `70257bcb7aa57896d442493b22d095ddece62d3d1afea9f885d686ba9edf3cfb` |  95,236 |      0 |       95,236 | 66,453 / 28,783          |              2 |
| `capture-2026-09-04T01-08-01-129Z-03ac5e46e33e` | `ae5b2bfe9e0745ae8c4690a2336ccb844a0f0fafffd5c72400ff958dae3ce214` | `3c3d9f18992a732c0eb1cc8f5f66d06ff4f48977be5502e22973b14d7f0e7a31` |  98,007 | 33,816 |       64,191 | 69,224 / 28,783          |              2 |
| `capture-2026-09-04T07-07-34-355Z-e8fc795bbd8f` | `203d7d82446c17d48b65461f39e4a998026e51f7689ffb949244e59fcfcb8881` | `f0d873001bf58ad1db1753bcbbaafc491b76a96e32f84345711f51fd5c8d9de1` |  98,436 | 35,221 |       63,215 | 69,653 / 28,783          |              2 |
| `capture-2026-09-04T13-16-13-705Z-00d4d1c45733` | `738b43805202d845285d51321c7fae2271bf822e7b9cf882c1116958a4efdd15` | `4cbc101d5785cdb7bf687acbdc9d96eee094e79ca99fe0ad6aa73606bc74d7cf` |  98,689 | 35,413 |       63,276 | 69,906 / 28,783          |              2 |
| `capture-2026-09-04T21-48-31-582Z-23fe89f6015d` | `1cbde97ebae56857a9b78dad8865b4f4b82405d36782f1eaaa2b06cad5a73f5b` | `b373113b4f9e1240cd8b1d7053a670aee5966bebbe01b49398be2488e664db36` |  99,067 | 43,279 |       55,788 | 70,284 / 28,783          |              2 |

All six V2 runs used stable source-key pagination, 500-row pages, a 100,000-row cap, and were untruncated. They contain 242,965 unique retained observations and zero completed evaluations. Their V2 artifacts/manifests hash-check, are ignored, nonsymlink, and `0600`; the collection directory is `0700`. Recursive V2 schema/privacy scans found no raw beach ID, source key, user/device/installation ID, token, payload/error, salt, or secret field. The current V2 artifacts were revalidated offline after the collector hardening; their recorded hashes remain valid.

## Evidence limitations

- Immutable issuance/evaluation counts are zero; capture timestamps, mutable updates, row hashes, and capture IDs are not provider evaluations.
- The paginated read has no transactional batch receipt. This, immutable lineage, actual multi-provider completed evaluation coverage, and release-policy evidence remain approval blockers.
- No candidate, regional, audience, projected-send, or delivery outcome is collected. Those dimensions are unknown, not zero.
- `enhanced_forecasts` is the existing curated forecast table (unique beach/forecast-time rows); the collector never joins a beach, user, or custom-spot relation.

## Verified heartbeat command

```sh
cd /Users/stevenchandler/Desktop/dev/.worktrees/phase-26/quiver
if [ ! -e node_modules ]; then ln -s /Users/stevenchandler/Desktop/dev/quiver/node_modules node_modules; fi
yarn tsx scripts/collect-swell-watch-shadow-snapshots.ts --out-dir .artifacts/swell-watch/collection --env-file /Users/stevenchandler/Desktop/dev/quiver/.env.production.local --max-rows 250000 --page-size 500
[ -L node_modules ] && unlink node_modules
```

The dependency symlink is only a local reuse of the existing primary web checkout dependencies; it is ignored and must be removed after each run. Do not copy dependencies or credentials into this worktree.

Before credentials, key, lock, directory, artifact, or request creation, preflight requires the exact anchored ignore rule `/.artifacts/swell-watch/collection/`, validates every prospective path with `git check-ignore`, and rejects tracked, outside-worktree, or symlink destinations. Before any credential load or production request, retained V2 manifests must pass canonical manifest hashing, key-fingerprint, artifact basename/path, private-permission, artifact-hash, and per-observation-hash checks. Existing key changes/missing keys, V2 prior-manifest/artifact integrity failures, lock contention, request timeout, cap truncation, skipped invalid rows, or partial publication fail closed; skipped rows mark the capture incomplete. Publication uses no-overwrite linking, so an ID collision preserves the existing artifact. Timer expiry aborts the request and clears its timer.

The main orchestrator created the heartbeat after independent artifact validation. It preserves non-overlap, bounds, privacy checks, missed-run reporting, and no-send behavior; it pauses on any failure and never widens scope or activates pushes. The first invalid automation request created nothing; the successful automation is current-thread destination only.

## No-send audit

`swell_watch.channels` remains `[]`. No notification registry, enqueue/worker, FCM, provider-ingestion, relationship, user, or device import is reachable from collection. No send, enqueue, cron invocation, production write, migration, deployment, or activation occurred.
