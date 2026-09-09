# Homepage focus and loading follow-up — September 9, 2026

Local follow-up to the operator's dev homepage reports: long initial loading, unexpected “Rechecking the call,” and clicking apparently reloading the page. Branch `orch/home-loading-followup-20260909`, based on main `affba18ef8c022848e7b76ed5243e47a992e6103` (PR 715). Worktree: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/signed-in-home-performance-20260909`. The primary checkout and unrelated work were preserved. No delegation, dependency changes, or database changes. After local verification, the operator explicitly authorized deployment to dev; the release follows feature PR → main → Vercel Preview. Production promotion is outside this authorization.

## Findings and scope

The active path remains `app/page.tsx` → `AuthAwareLandingWrapper` → `OracleHomeScreen` → `useOracleData` → `useSurfDiscovery` → `/api/surf/discover`.

- **Verified:** the discovery hook treated every window focus event as a return, even without a preceding blur or hidden state. Repeated signals on an already focused document produced three requests instead of one in the failing regression. Each refresh cleared the call and triggered the rechecking screen.
- **Verified:** Oracle fetched its own profile through the legacy server-action hook while the existing app-wide `ProfileProvider` already supplied profile and home beach. The failing regression showed the legacy hook being invoked despite a ready shared profile.
- **Unresolved attribution:** ordinary heading/search clicks in the selected dev browser did not reproduce a hard navigation during inspection. The tests reproduce redundant focus signals, not proof that every reported click emits them in the embedded browser. A real blur followed by focus intentionally still rechecks safety information.
- **Remaining latency:** two pre-patch dev observations took 9,855 / 8,701 ms to render, with one discovery request taking 6,454 / 5,499 ms. These are individual live observations, not latency percentiles. This patch does not change backend query cost or the discovery deadline.

The bounded plan was to guard the existing shared focus handler with observed departure state, reuse the existing profile context, retain genuine-return/expiry/hold checks, and verify both hook regressions plus the browser interaction. Review rejected extending freshness or retaining an old positive call during genuine safety revalidation.

Production files changed: `hooks/use-surf-discovery.ts` and `hooks/use-oracle-data.ts`. Focus events must target the window; element focus does not count as a return. A document mounted unfocused or hidden still requires revalidation on return. Later real returns during pending requests retain the existing queue behavior. Scoring, ranking, entitlements, hazard policy, decision expiry, API shapes, and analytics contracts are unchanged.

Test files changed: `__tests__/hooks/use-surf-discovery.resume-revalidation.test.tsx`, `__tests__/hooks/use-surf-discovery-hold.test.tsx`, `__tests__/hooks/use-oracle-data.home-performance.test.tsx`, `__tests__/hooks/use-oracle-data-hold.test.tsx`, and `e2e/home-perf-probe.spec.ts`. Existing hold assertions remain intact; their return simulations now include the preceding blur or hidden event. The opt-in browser probe checks heading/search clicks, duplicate focus signals, request/navigation counts, and a simulated blur/focus return. It gates the real resumed request until the pending safety state has been asserted, avoiding a response-speed race.

## Verification

Commands run in the isolated worktree using Node 22 and Yarn 1. Jest uses fixture public configuration and mocked transport:

```sh
export PATH=/opt/homebrew/opt/node@22/bin:$PATH
export NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-key
yarn test:unit --runInBand __tests__/hooks/use-surf-discovery.resume-revalidation.test.tsx -t 'already-focused'
yarn test:unit --runInBand __tests__/hooks/use-oracle-data.home-performance.test.tsx -t 'shared profile'
```

Both failed on the prior implementation as intended: focus expected one request but received three; the profile test expected no legacy hook invocation but received two. The first post-fix run exposed two test simulations that omitted the departure event; those were corrected without changing their safety assertions.

```sh
yarn test:unit --runInBand __tests__/hooks/use-surf-discovery.resume-revalidation.test.tsx __tests__/hooks/use-surf-discovery-hold.test.tsx __tests__/hooks/use-oracle-data.home-performance.test.tsx __tests__/hooks/use-oracle-data-hold.test.tsx __tests__/hooks/use-surf-discovery.test.tsx __tests__/hooks/use-oracle-data.test.ts __tests__/components/oracle/oracle-home-screen.test.tsx
yarn test:unit --runInBand __tests__/hooks/use-surf-discovery.resume-revalidation.test.tsx __tests__/hooks/use-surf-discovery-hold.test.tsx __tests__/hooks/use-oracle-data.home-performance.test.tsx __tests__/hooks/use-oracle-data-hold.test.tsx __tests__/context/profile-context.test.tsx
yarn typecheck
yarn eslint --max-warnings=0 hooks/use-oracle-data.ts hooks/use-surf-discovery.ts __tests__/hooks/use-oracle-data-hold.test.tsx __tests__/hooks/use-oracle-data.home-performance.test.tsx __tests__/hooks/use-surf-discovery-hold.test.tsx __tests__/hooks/use-surf-discovery.resume-revalidation.test.tsx e2e/home-perf-probe.spec.ts
yarn test:unit --bail=0
git diff --check
```

The seven-suite focused run passed all 104 tests. The subsequent five-suite safety/context run passed all 35 tests. Typecheck and scoped ESLint passed with zero warnings. The full unit gate passed: **1,412 suites, 18,206 tests, four snapshots** in 74.852 seconds; **16 suites / 195 tests skipped and one todo** are not passes. It emitted a worker-shutdown warning. A scoped open-handle diagnostic passed all 35 safety/context tests without reporting an open handle; the full-suite warning remains unattributed. The production build passed in 89.68 seconds. Its missing server-key warning reflects the public-only build environment; the local runtime received the existing server key separately.

The additional diagnostic command passed (exit 0):

```sh
yarn test:unit --runInBand --detectOpenHandles __tests__/hooks/use-surf-discovery.resume-revalidation.test.tsx __tests__/hooks/use-surf-discovery-hold.test.tsx __tests__/hooks/use-oracle-data.home-performance.test.tsx __tests__/hooks/use-oracle-data-hold.test.tsx __tests__/context/profile-context.test.tsx
```

## Browser evidence and final review

Reviewed the existing performance probe, Playwright auth project/configuration, authentication helper, setup/teardown, and runtime error detector before extending the probe. Exact local launch commands:

```sh
node /tmp/signed-home-run.cjs build ignored /tmp/home-followup-build.log
node /tmp/signed-home-run.cjs serve 3217 /tmp/home-followup-server.log
node /tmp/signed-home-run.cjs probe http://127.0.0.1:3217 /tmp/home-followup-probe.log
```

The temporary credential-safe launcher runs `VERCEL_ENV=preview yarn build`, `yarn start -p 3217`, and the following browser command, supplying existing approved test credentials only in the child environment:

```sh
RUN_PERF_PROBE=1 PLAYWRIGHT_PROD_READONLY=true SKIP_E2E_CLEANUP=true BASE_URL=http://127.0.0.1:3217 yarn playwright test e2e/home-perf-probe.spec.ts --project=auth --workers=1 --retries=0 --config=/tmp/signed-home-playwright.config.ts
```

The temporary config inherits the repository configuration with absolute test/setup paths and disables its automatic web server because the task-owned production server is already running. No new test framework or dependency was installed.

**Final browser result: two passed, zero failed, zero retried**, 18.5 seconds, with runtime error detection enabled. Desktop Chromium against the local production build used live backend reads with the approved test account; the resumed request was briefly gated, then continued to the real server. Browser blur/focus signals were simulated, not an OS-level tab-switch test or real-device test.

- Initial surf call: **4,385 ms**; one discovery request, **3,528 ms**. Document TTFB 6 ms, first contentful paint 192 ms. These local timings cannot establish a dev hosting improvement or a latency percentile.
- Heading and search clicks plus repeated focus/visible signals preserved the call, discovery request count, and main-frame navigation count.
- A subsequent simulated blur/focus return issued exactly one new discovery, displayed “Rechecking the call,” hid the prior banner while pending, then displayed the fresh call without a page navigation.

No UI layout was changed. User-provided screenshots show the original symptom; no new screenshot or recording is claimed. Raw authentication logs and automatic artifacts are excluded because they can contain account data. Normal auth/page-view telemetry occurs; no forms or business-data changes were exercised.

Final scoped diff review found no remaining actionable findings in the patch. `git diff --check` passed. No CI run, clean dependency install, deployment, or live-dev validation of this follow-up is claimed. The remaining uncertainties are the exact embedded-browser click event sequence, backend tail latency, and the full-suite worker-shutdown warning. The task-owned local server was stopped after verification.

## Recovery and compatibility

No migration, flag, storage-schema, or health/API consumer change is needed. Rollback is a code revert of the two runtime changes; no data repair is needed. The existing profile provider already owns onboarding refresh and per-user caching. No recommendation cache or freshness grace period was added.

After a separately authorized integration, confirm the deployed SHA and run the same opt-in probe on dev. Ordinary in-page clicks should preserve the rendered call and request count. A genuine departure/return should show rechecking, issue a fresh discovery, then resolve to the current call or existing unavailable/hold state. If clicks still trigger rechecks, capture whether the browser actually emitted a window blur/hidden transition before focus; that distinguishes remaining browser behavior from a hard navigation. Do not disable hazard revalidation as a latency workaround. Record safe request timings/statuses and the deployed SHA for slow requests; exclude account identifiers, tokens, query parameters, and raw auth logs.
