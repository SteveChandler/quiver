# Auth confirmation review convergence

Scope: the uncommitted confirmation/PKCE fix, error recovery UI, and post-auth return destination. Reviewed callback consumers/producers, installed Supabase auth and SSR cookie handling, signup and sign-in page handlers, shared return storage, telemetry, unit assertions and `e2e/guest-auth-confirm.spec.ts` plus its error-detection helper. No agents, commits, deployment, or production data changes.

## Cycle 1: two findings fixed

1. `app/auth/sign-in/page.tsx` still passed the raw query-string destination to `router.push` from the modal completion/close handler. This bypassed the new return-path validation, permitting auth-page loops and external or script destinations. It now uses the existing shared resolver. Added `__tests__/app/auth-sign-in-page.test.tsx`: all three supported query aliases, auth-page loops, script/external destinations, and preserved map destination. The mock only replaces the modal, then invokes the actual page handler.
2. `app/auth/confirm/route.ts` replayed Supabase cookie mutations only on session success. Error, thrown-exchange, and sessionless redirects discarded any queued cookie changes, including session cleanup. All redirect responses now share cookie replay and clear the return cookie. Added three handler regression cases asserting deletion cookie options and absence of the success marker. This preserves mutations supplied by the installed SDK; it does not force verifier cleanup when the SDK does not emit it.

## Cycle 2: clear

Re-read the final production diff and tests for redirect safety, normal destination preservation, PKCE/OTP branching, recovery defaults, cookie replay, error context, telemetry token exposure, false-positive assertions, and scope. No further actionable findings in the reviewed feature. This is scoped review convergence, not a claim that the entire repository is free of bugs.

## Commands and results

Commands run from the isolated worktree with Node 22:

- PASS: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --runTestsByPath __tests__/app/auth-sign-in-page.test.tsx __tests__/components/auth/unified-auth-modal.test.tsx __tests__/app/auth/confirm/route.test.ts __tests__/app/auth-confirm-route.test.ts __tests__/app/auth-error-page.test.tsx` — 82/82 tests, 5 suites. `/private/tmp/auth-review-tests.log`.
- PASS: `yarn eslint --max-warnings=0 app/auth/confirm/route.ts app/auth/sign-in/page.tsx app/error/page.tsx components/auth/unified-auth-modal.tsx lib/auth/confirm-utils.ts`.
- PASS: `yarn playwright test --config=.auth-review-playwright.config.ts` — 2/2. Temporary config selected only `guest-auth-confirm.spec.ts`, Chromium/iPhone 13 viewport, one worker, local port 3108 and a managed webpack dev server. No global auth setup or database fixtures. Config removed after validation. `/private/tmp/auth-review-e2e.log` and `/private/tmp/auth-review-browser-results`.
- PASS: `git diff --check`.

This pass modified two production files and one existing unit-test file, and added one page unit-test file, listed above. No E2E files changed in this review pass. The whole feature's earlier changed-file inventory and simulator evidence remain in `verification.md`.

Full build and simulator were not rerun during this review pass: existing build blockers were documented previously, and these follow-up changes are covered by route/page regressions and browser error-flow tests. Prior real local Safari email signup validation remains historical evidence. Physical iPhone, production email configuration, cross-browser exchange, and live PostHog delivery remain unverified.

- FAIL: `yarn typecheck` — 191 errors, all in generated `.next` route/page checks, including existing `RouteContext | undefined` signatures and disallowed route/page exports. No errors outside `.next`. Log `/private/tmp/auth-review-typecheck.log`. These existing repository-wide release blockers remain unresolved; full typecheck is not green.
