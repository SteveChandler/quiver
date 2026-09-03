# Supabase and Vercel performance fixes — 2026-09-03

Combined review worktree: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903`, branch `orch/perf-runtime-20260903`, based on `d2a23fd27`. All changes are uncommitted. Main checkout and production unchanged.

## Implemented

- Cron cleanup: transactional partial index on `started_at WHERE status = 'started'`, with bounded lock and statement timeouts. Disposable PostgreSQL validation passed apply, repeat apply, actual stale-run UPDATE and rollback. Synthetic 209k-row sweep: 13.964 ms / 1,332 buffers → 0.032 ms / two buffers. Not a production speedup estimate.
- Query volume: apply the existing 48-hour IOOS temperature cutoff in SQL; filter single-beach anchor responses at PostgREST instead of transferring all anchors. Batch callers unchanged. RPC filtering need not eliminate all work inside its SECURITY DEFINER function.
- Runtime: validate beach UUIDs once in the shared query service before database access. Missing slug fallbacks and literal `null` no longer cause invalid-UUID database errors through this path. Other routes are not claimed covered.
- Discovery: overlap sun times, water quality, boards and historical reads with preference lookup; personalization alone waits for preferences. Preferences are still read once. This removes an avoidable serial dependency; it is not a verified solution to the observed 12-second production timeout.
- Auth: use established patch-package postinstall to validate stored sessions before SDK mutation; scrub credential-bearing API errors and Sentry events/logs. Valid remote user verification and token refresh remain tested. Synthetic test credentials only.
- Landing media: defer video sources until visible; reduced-motion and Save-Data visitors get manual playback. Offscreen video no longer competes with initial hero loading. No production LCP improvement claimed yet.

## Review and verification

Inspected workspace/repository contracts, migration safety, relevant service architecture, package/Jest/TypeScript configuration and CI configuration, callers and existing tests before edits. Reviewed combined diff for contracts, failure handling, privacy, race ordering, query semantics and test assertions. No dependency upgrades or shared node_modules modifications. Integration has private copies of auth-js, supabase-js and ssr so realpath resolution reaches the patched SDK.

Focused worker evidence and exact commands:
- [Database report](perf-db-report.md): 56 tests, scoped lint and disposable SQL validation passed; typecheck stopped to consolidate validation.
- [Auth report](perf-auth-report.md): 72 tests, scoped lint and patch application passed. Reversing patch breaks four malformed-session cases while two valid-session cases still pass. Typecheck stopped to consolidate validation.
- [Landing report](perf-pages-report.md): media unit regression, browser evidence and exact E2E commands/status.

Root runtime checks (synthetic environment variables below):

```sh
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-test-placeholder
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
export SUPABASE_SERVICE_ROLE_KEY=gate-unit-tests-placeholder

yarn test:unit --runInBand __tests__/lib/services/beach-query-service.test.ts __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts
# PASS: 2 suites / 67 tests.

yarn test:unit --runInBand __tests__/lib/services/discovery __tests__/actions/beach/beach-query-actions.test.ts __tests__/app/mexico-beach-page-indexability.test.ts __tests__/app/mexico-beach-subpage-route.test.ts __tests__/app/beach-legacy-subpages.test.ts
# PASS: 41 suites / 547 tests.

npx eslint --max-warnings=0 lib/services/beach-query-service.ts lib/services/discovery/surf-discovery-orchestrator.ts
# PASS.

CI=1 yarn test:unit --runInBand __tests__/lib/services/beach-query-service.test.ts __tests__/lib/services/discovery __tests__/lib/services/observations/nowcast-anchor.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts __tests__/lib/api-utils.test.ts __tests__/lib/monitoring/redact-secrets.test.ts __tests__/lib/monitoring/sentry-redaction.test.ts __tests__/lib/supabase/auth-session-recovery.test.ts __tests__/components/landing/autoplay-video.test.tsx
# PASS on combined changes: 45 suites / 570 tests. Final rerun includes the hydration regression. Counts overlap prior runs.

yarn typecheck
# Initial runtime-only run stopped (SIGTERM) to consolidate checks. Combined status recorded below.

git diff --check
# PASS.
```

Initial `yarn typecheck` before Next-generated route checks: PASS (58.32 seconds). Final post-build `yarn typecheck`: FAIL; see generated-route failures below. Combined scoped ESLint over all changed `.ts` / `.tsx` files: PASS (10.59 seconds). Production-build browser gate BLOCKED; final local dev E2E FAIL (1 passed, 3 failed), details below. No full unit suite, authenticated real-Supabase E2E or deployment run. Full verification of deployment behavior remains a release gate. No tests are described as passed unless executed.

## Deferred / remaining risks

- Production rollout and migration are pending review/approval. `docs/MIGRATION_SAFETY.md` requires approved exact plan and backup verification. Normal index creation can briefly block writers; timeouts bound that risk. Rollback is in the DB report.
- Historic exposed sessions/logs were not revoked or purged. SDK patch prevents the identified malformed-session path going forward only; incident remediation is a separate production action.
- No large index dropped. Check live definitions, dependencies and a representative workload first; the nonunique enhanced-forecast index is a stronger redundancy candidate than wind/tide indexes.
- No speculative cache TTL increases or Vercel/Supabase capacity upgrades. Current evidence did not establish a capacity bottleneck. Mobile homepage sample is small.
- NOAA/IOOS upstream failures, HLS fetch errors and the discovery timeout still need representative production traces. Blanket geographic exclusions could discard valid border coverage and were not introduced.
- SDK patch is tied to auth-js 2.100.0 and must be reviewed when upgrading. A clean dependency install applies it through existing postinstall; do not apply it against another session's shared node_modules.

## Changed files

- `__tests__/lib/api-utils.test.ts`
- `__tests__/lib/services/beach-query-service.test.ts`
- `__tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`
- `__tests__/lib/services/enhanced-forecast-service.test.ts`
- `__tests__/lib/services/observations/nowcast-anchor.test.ts`
- `components/landing-page/field-guide/autoplay-video.tsx`
- `e2e/guest-landing-media-budget.spec.ts`
- `instrumentation-client.ts`
- `lib/api-utils.ts`
- `lib/services/beach-query-service.ts`
- `lib/services/discovery/surf-discovery-orchestrator.ts`
- `lib/services/enhanced-forecast-service.ts`
- `lib/services/observations/nowcast-anchor.ts`
- `sentry.edge.config.ts`
- `sentry.server.config.ts`
- `__tests__/components/landing/autoplay-video.test.tsx`
- `__tests__/lib/monitoring/redact-secrets.test.ts`
- `__tests__/lib/monitoring/sentry-redaction.test.ts`
- `__tests__/lib/supabase/auth-session-recovery.test.ts`
- `lib/monitoring/redact-secrets.ts`
- `patches/@supabase+auth-js+2.100.0.patch`
- `supabase/migrations/20260903200100_index_started_cron_runs.sql`

Combined lint command (PASS):

```sh
yarn eslint --max-warnings=0 __tests__/lib/api-utils.test.ts __tests__/lib/services/beach-query-service.test.ts __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts __tests__/lib/services/observations/nowcast-anchor.test.ts components/landing-page/field-guide/autoplay-video.tsx e2e/guest-landing-media-budget.spec.ts instrumentation-client.ts lib/api-utils.ts lib/services/beach-query-service.ts lib/services/discovery/surf-discovery-orchestrator.ts lib/services/enhanced-forecast-service.ts lib/services/observations/nowcast-anchor.ts sentry.edge.config.ts sentry.server.config.ts __tests__/components/landing/autoplay-video.test.tsx __tests__/lib/monitoring/redact-secrets.test.ts __tests__/lib/monitoring/sentry-redaction.test.ts __tests__/lib/supabase/auth-session-recovery.test.ts lib/monitoring/redact-secrets.ts
```

## Final review follow-up

Retained dev logs exposed an existing SSR/client mismatch when reduced motion is enabled. Root gated the manual-play button until mount using the existing Save-Data state; no additional state was needed. Added a server-markup stability regression. Initial test import failed because jsdom resolves the browser server-renderer requiring MessageChannel; corrected to the explicit `react-dom/server.node` export. Final command passed all four media cases:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3134 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key yarn test:unit --runInBand __tests__/components/landing/autoplay-video.test.tsx
```

The media E2E assertions now also prove actual playback after manual activation, beyond merely requesting the file. First combined build was stopped after compilation to include this fix; not counted as a passing build.

Final media scoped lint command: `yarn eslint --max-warnings=0 components/landing-page/field-guide/autoplay-video.tsx __tests__/components/landing/autoplay-video.test.tsx e2e/guest-landing-media-budget.spec.ts` — PASS (10.92 seconds).

## Final build / browser result — release blocked

The optimized build compiled successfully, then failed Next.js route validation on unchanged `app/api/admin/android-tester-roster/export/route.ts`: GET's second argument is `RouteContext | undefined`, while Next requires `RouteContext`. `git diff --exit-code HEAD -- app/api/admin/android-tester-roster/export/route.ts lib/middleware/api-wrappers.ts` passed, confirming those files were not changed by this batch. Standalone TypeScript success does not establish a successful Next.js build. No bypass was added and the unrelated route wrapper was not changed.

Exact build command (FAIL):

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3134 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key SUPABASE_SERVICE_ROLE_KEY=synthetic-local-key NEXT_PUBLIC_SITE_URL=http://localhost:3113 VERCEL_ENV=preview NEXT_PUBLIC_PLAYWRIGHT_TEST=true PLAYWRIGHT_TEST=true NEXT_PUBLIC_E2E_DISABLE_EMAIL_SENDS=true NEXT_PUBLIC_E2E_DISABLE_AUTH_REFRESH=true NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN= NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$PWD/e2e/fixtures/next-font-google-mock.cjs" yarn next build --webpack
```

Started the synthetic local read fixture with `node .planning/supabase-fixture.cjs` and the same environment with `yarn next dev --webpack -p 3113`. Dev server started and returned homepage200. Temporary `.perf-playwright.config.ts` inherited the existing Playwright config with only `webServer: undefined`; its purpose was to use the already-running server, not relax assertions.

Exact final E2E command (FAIL: 1 passed / 3 failed):

```sh
BASE_URL=http://localhost:3113 SKIP_AUTH_SETUP=true SKIP_E2E_CLEANUP=true NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3134 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key yarn test:e2e e2e/guest-landing-media-budget.spec.ts --config=.perf-playwright.config.ts --project=guest --workers=1 --trace=on
```

Desktop validates initial media budget, deferral, scroll-triggered request and actual playback. Mobile records a SyntaxError (`Invalid or unexpected token`, empty stack) before hydration; later cases record `Internal Next.js error: Router action dispatched before initialization` from dev HMR. Root trace inspection confirmed those errors; none were suppressed. The fixed reduced-motion markup mismatch did not reappear in the final dev log, but all four flows must pass together before release. These dev errors are not proved to be a production issue or caused by this patch.

Final E2E status: **FAIL / release blocked**. Production-build and mobile visual validation remain incomplete. Traces and screenshots are retained in the integration worktree's ignored `test-results/` directory. Local servers are stopped after verification; temporary Playwright config removed. The synthetic fixture and standalone SQL check remain with the reports for reproducibility.

Remaining required work: repair/review the pre-existing Next.js route typing blocker, rerun a complete production build and media E2E on that build, then review deployment/migration approval. Separately investigate upstream failures/timeouts using production traces and address historical exposed credentials under approved incident remediation. No commits, pushes, deploys, index application/removal, session revocations or log purges were performed.

## Post-build TypeScript status: FAIL

After Next generated its route validators, `yarn typecheck` failed with 185 diagnostics. The earlier successful run had not included these generated checks. Final typecheck must therefore be reported as FAIL, not green. Errors concern existing optional route-context signatures and unsupported named exports from pages; they are outside this performance patch. Exact diagnostics:

```text
.next/types/app/api/admin/android-tester-roster/export/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/android-tester-roster/identity/[entryId]/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/android-tester-roster/play-evidence/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/android-tester-roster/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/android-tester-roster/sync/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/broadcast-push/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/broadcast-push/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/cleanup-inactive-buoys/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/cleanup-inactive-buoys/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photo-contributors/[contributorId]/restriction/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photo-contributors/[contributorId]/restriction/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photos/[photoId]/hold/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photos/[photoId]/hold/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photos/[photoId]/image/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photos/[photoId]/moderation/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photos/[photoId]/pin/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photos/[photoId]/pin/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photos/[photoId]/recover/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photos/monitoring/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/community-photos/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/delivery-stats/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/new-user-alert/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/notifications/recent/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/recommendation-holds/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/recommendation-holds/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/session-videos/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/session-videos/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/sync-buoys/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/sync-buoys/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/test-push/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/test-push/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/update-buoy-conditions/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/admin/update-buoy-conditions/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/alerts/activity/[notificationId]/read/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/alerts/activity/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/alerts/anon-capture/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/alerts/attribution/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/alerts/debug/[ruleId]/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/alerts/rules/[ruleId]/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/alerts/rules/[ruleId]/route.ts(287,7): error TS2344: Type '{ __tag__: "PATCH"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/alerts/rules/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/alerts/rules/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/alerts/seed-default/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/analytics/sessions/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/analytics/sessions/route.ts(287,7): error TS2344: Type '{ __tag__: "PATCH"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/android-beta/leads/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/android-beta/status/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/android-tester-roster/first-open/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/android-tester-roster/install/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/android-tester-roster/join/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/app-link-email/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/auth/apple-recovery/assess/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/api/auth/apple-recovery/assess/route"), "config" | "GET" | "HEAD" | "POST" | ... 13 more ... | "OPTIONS", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/auth/apple-recovery/assess/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/auth/apple-recovery/confirm/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/api/auth/apple-recovery/confirm/route"), "config" | "GET" | "HEAD" | "POST" | ... 13 more ... | "OPTIONS", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/auth/apple-recovery/confirm/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/auth/check-session/route.ts(42,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "first"; __param_type__: NextRequest | undefined; }' does not satisfy the constraint 'ParamCheck<Request | NextRequest>'.
.next/types/app/api/auth/email/update/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/beach-daily-intel/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/beach/personalized-score/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/beaches/[id]/favorite/toggle/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/beaches/favorites/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/beaches/featured/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/beaches/nearby/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/beaches/popular/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/beaches/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/beaches/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/beaches/search/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/boards/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/boards/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/buoys/conditions/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/buoys/nearby/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/cam-resolve/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/coach-picks/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/coast-pulse/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/coast-pulse/summary/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/comments/[commentId]/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/community-photos/[photoId]/image/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/community-photos/[photoId]/recover/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/community-photos/[photoId]/report/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/community-photos/[photoId]/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/community-photos/[photoId]/vote/route.ts(209,7): error TS2344: Type '{ __tag__: "PUT"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/community-photos/mine/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/community-photos/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/community-photos/upload/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/community-stats/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/cron/home-morning-call/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/api/cron/home-morning-call/route"), "config" | "GET" | "HEAD" | "POST" | "PATCH" | ... 12 more ... | "OPTIONS", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/cron/swell-watch/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/api/cron/swell-watch/route"), "config" | "GET" | "HEAD" | "POST" | "PATCH" | "DELETE" | ... 11 more ... | "OPTIONS", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/devices/remove/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/devices/upsert/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/devices/upsert/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/events/link/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/events/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/api/events/route"), "config" | "GET" | "HEAD" | "POST" | "PATCH" | "DELETE" | "PUT" | ... 10 more ... | "OPTIONS", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/events/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/forecast-feedback/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/forecasts/current/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/forecasts/scored/[beachId]/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/api/forecasts/scored/[beachId]/route"), "config" | "GET" | "HEAD" | "POST" | ... 13 more ... | "OPTIONS", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/forecasts/scored/[beachId]/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/forecasts/update-enhanced/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/forecasts/update-enhanced/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/forecasts/update/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/forecasts/update/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/gamification/award/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/gamification/badge-definitions/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/gamification/user-badges/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/gamification/xp-status/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/image-proxy/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/install-attribution/issue/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/intel/[id]/confirm/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/intel/[id]/confirm/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/intel/[id]/report/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/intel/[id]/vote/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/intel/[id]/vote/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/intel/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/intel/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/internal/send-welcome-email/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/invites/consume/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/invites/generate/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/journal/export/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/map/bootstrap/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/me/milestones/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/me/milestones/route.ts(287,7): error TS2344: Type '{ __tag__: "PATCH"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/me/profile-page/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/me/profile/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/api/me/profile/route"), "config" | "GET" | "HEAD" | "POST" | "PATCH" | "DELETE" | ... 11 more ... | "OPTIONS", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/me/profile/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/personalization/match-score/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/profile/[id]/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/profile/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/recent-posts/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/recommendation-impressions/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/recommendations/session-context/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/reports/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/roadmap/items/[id]/vote/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/roadmap/submissions/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/comments/[commentId]/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/comments/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/comments/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/likes/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/likes/toggle/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/photos/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/photos/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/route.ts(287,7): error TS2344: Type '{ __tag__: "PATCH"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/videos/[mediaId]/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/[id]/videos/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/sessions/public/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/social-proof/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/surf/call/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/surf/discover/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/api/surf/discover/route"), "config" | "GET" | "HEAD" | "POST" | "PATCH" | "DELETE" | ... 11 more ... | "OPTIONS", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/surf/discover/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/surf/insights/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/surf/session-decision/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/surf/week-scout/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/surf/week-scout/snapshots/[snapshotId]/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/surf/week-scout/weekend/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/tools/dawn-patrol/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/tools/tide-clock/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/user/beach-affinity/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/user/location-snapshot/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/user/location-snapshot/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/user/preferences/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/[id]/block/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/[id]/block/route.ts(248,7): error TS2344: Type '{ __tag__: "DELETE"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/[id]/follow/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/[id]/follow/toggle/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/[id]/followers/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/[id]/following/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/[id]/sessions/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/[id]/stats/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/me/blocks/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/search/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/users/suggested/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/v1/auth/apple-orphan-detection/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/api/v1/auth/apple-orphan-detection/route"), "config" | "GET" | "HEAD" | "POST" | ... 13 more ... | "OPTIONS", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/v1/auth/apple-orphan-detection/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/v1/auth/apple-orphan-precheck/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/api/v1/auth/apple-orphan-precheck/route"), "config" | "GET" | "HEAD" | "POST" | ... 13 more ... | "OPTIONS", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/v1/auth/apple-orphan-precheck/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/v1/conditions-reports/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/v1/conditions-reports/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/v1/experiments/assignment/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/v1/experiments/link/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/v1/recommendations/route.ts(53,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/api/webhooks/resend/route.ts(170,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "second"; __param_type__: RouteContext | undefined; }' does not satisfy the constraint 'ParamCheck<RouteContext>'.
.next/types/app/best-time-to-surf/[city]/page.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/best-time-to-surf/[city]/page"), "config" | "default" | "viewport" | "metadata" | ... 11 more ... | "generateViewport", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/profile/[id]/page.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/profile/[id]/page"), "config" | "default" | "viewport" | "metadata" | "revalidate" | ... 10 more ... | "generateViewport", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/us-open-of-surfing-forecast/page.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import("/Users/stevenchandler/Desktop/dev/quiver/.worktrees/perf-runtime-20260903/app/us-open-of-surfing-forecast/page"), "config" | "default" | "viewport" | "metadata" | ... 11 more ... | "generateViewport", "">' does not satisfy the constraint '{ [x: string]: never; }'.
```

## Commit/push preparation

User authorized commit and push to main after the failed checks were reported. Shipping worktree is `quiver/.worktrees/perf-main-20260903` on `orch/perf-main-20260903`, based directly on remote main `0b1835fa2`. Only task-owned changes were transferred; unrelated Hawaii catalog and email policy commits from the previous local base were excluded. Existing main already has a failed Prod Gate run: https://github.com/SteveChandler/quiver/actions/runs/33782199636 . Dev before push serves a Ready Turbopack deployment of that main SHA; local webpack build failures do not establish that Vercel will fail.

The same combined focused unit command was rerun on this shipping base. Deployment and final results are recorded in the task response; the historical reports above remain evidence for the earlier worktrees.

Rollout: push main triggers Vercel Preview/dev automatically. Verify the exact commit is Ready and aliased to dev.quiversurf.app; validate guest media and auth before production. Production promotion is a separate regular main-to-prod merge and push after review. Supabase migration is separate from Vercel deploy: verify backup/migration history, prepare the exact owner-connection plan and obtain its approval token per docs/MIGRATION_SAFETY.md before applying the cron index. Do not run an unreviewed blanket db push. Production crons pick up application changes only after production deployment.
