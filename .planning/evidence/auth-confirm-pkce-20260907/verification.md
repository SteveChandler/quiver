# Email confirmation fix — local verification

Implemented on `fix/auth-confirm-pkce-20260907`, based on `c0fa2bfd8`, in the isolated worktree `quiver/.worktrees/auth-confirm-pkce-20260907`. No commit, push, deployment, email send, or production configuration change was made.

## Behavior and files

Production code changed:

- `app/auth/confirm/route.ts`: exchange PKCE codes as well as existing OTP token hashes; replay session cookies and the Safari refresh marker; retain recovery destinations; handle invalid return cookies; report failures to Sentry and PostHog without credential URLs, headers, breadcrumbs, or user email in the new event.
- `app/error/page.tsx`: confirmation failures offer sign-in; explicit recovery failures retain password-reset actions.
- `lib/auth/confirm-utils.ts`: reject backslashes and control/space characters that could turn an apparent relative redirect into an external URL.

Tests changed/added:

- `__tests__/app/auth/confirm/route.test.ts`: both credential formats, session cookie replay, recovery routing, cookie fallback, malformed credentials, expired/reused credentials, thrown errors, no-session fallback, telemetry redaction.
- `__tests__/app/auth-confirm-route.test.ts`: additional unsafe redirect cases.
- `__tests__/app/auth-error-page.test.tsx`: new confirmation/recovery copy and action assertions.
- `e2e/guest-auth-confirm.spec.ts`: new browser checks for malformed confirmation -> sign-in and malformed recovery -> request reset; asserts redirect/page HTTP statuses and visible destination controls.

Existing E2E reviewed: `e2e/guest-auth.spec.ts`, `e2e/README.md`, `playwright.config.ts`, global setup/teardown, and `e2e/utils/error-detection.ts`. Tests deliberately avoid account creation, email sends, and database cleanup. Expected error-page alerts are asserted explicitly; unexpected console/network errors remain checked.

## Commands and outcomes

Commands were run inside the isolated worktree using Node 22 (`source ~/.nvm/nvm.sh && nvm use 22 >/dev/null`).

- PASS: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test-placeholder NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3108 yarn test:unit --runInBand --runTestsByPath __tests__/app/auth/confirm/route.test.ts __tests__/app/auth-confirm-route.test.ts __tests__/app/auth-error-page.test.tsx` — 3 suites, 26 tests, final rerun passed.
- PASS: `yarn eslint --max-warnings=0 app/auth/confirm/route.ts app/error/page.tsx lib/auth/confirm-utils.ts` — final rerun passed.
- PASS: `yarn playwright test --config=/private/tmp/auth-confirm-playwright.config.ts` — 2/2 tests, initial and final screenshot runs passed. Config selects the checked-in spec, one worker, Chromium with an iPhone 13 viewport, and `http://127.0.0.1:3108`; no global setup/teardown or database access.
- PASS: `git diff --check`.
- PASS: `yarn tsc --noEmit -p .auth-confirm-tsconfig.json` — source-only diagnostic check. Temporary config extended `./tsconfig.json`, disabled incremental output, and excluded `.next` plus the existing excluded directories; it was removed after the check. Full `yarn typecheck` remains blocked as described below.
- FAIL: `yarn typecheck` — initial test fixture typing errors were fixed; subsequent full run fails in generated `.next/types` across unrelated existing routes (`RouteContext | undefined`) and existing page exports. No unrelated production code was changed.
- FAIL: `VERCEL_ENV=preview yarn build --webpack` — initial sandbox run could not fetch Google Fonts. Retried with approved network access; compilation completed, then build failed on the pre-existing invalid GET signature in `app/api/admin/android-tester-roster/export/route.ts` (`RouteContext | undefined`). Build log: `/private/tmp/auth-confirm-build.log`.
- Initial Jest attempts without explicit environment variables failed before tests could execute. Final runs use placeholders, not production credentials.
- Auxiliary source-only typecheck attempts with a temporary config in `/private/tmp` failed because type discovery used that directory (missing Jest types, then an implicit proj4 stub). A project-local diagnostic config is used for the final source-only check; it excludes generated `.next` files without changing project configuration.

Local browser server: `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/Users/stevenchandler/Desktop/dev/quiver/.worktrees/auth-confirm-pkce-20260907/e2e/fixtures/next-font-google-mock.cjs VERCEL_ENV=preview yarn next dev --webpack -p 3108`. Sandbox initially blocked listening; approved execution succeeded. Test placeholders cause unrelated background service-role diagnostics in server logs; the tested pages and redirect paths returned the asserted statuses.

## Evidence and limitations

Final E2E result: **PASS, 2/2** for the error recovery paths. Successful provider exchanges are covered with mocked Supabase responses in unit tests, not a live email transaction.

Mobile screenshots were inspected for wrapping, overflow, overlap, and action visibility:

- `/private/tmp/auth-confirm-browser-results/guest-auth-confirm-a-malfo-0cf21-n-instead-of-password-reset/confirmation.png`
- `/private/tmp/auth-confirm-browser-results/guest-auth-confirm-a-malfo-3a400-still-offers-password-reset/recovery.png`

No physical iPhone Safari test or live Supabase email-template verification was performed. Cross-browser PKCE links can still lack the originating verifier; the error page now offers password sign-in instead of incorrectly telling the user to reset their password. Existing token-hash links remain supported.

PostHog uses the existing `auth_failed` event with `source=auth_confirm`, `flow`, `credential`, and `reason`. Server failure events use an ephemeral distinct ID with person profile processing disabled: count them as failure attempts, not unique affected users. Live event delivery has not been verified because this patch has not been deployed.

No remaining actionable findings were identified in the scoped diff. Release remains gated on the existing full build/typecheck blockers and real Safari/live-email verification. Full unit suite and successful live signup E2E were not run.


## Actual iOS Simulator Safari validation — 2026-09-07

**PASS:** a fresh email/password signup in Safari on a dedicated iPhone SE (3rd generation) simulator, iOS 26.5, using the fixed worktree at `http://localhost:3000` and the existing local Supabase stack. No mocked auth responses were used.

- Submitted the signup through the actual web form with a disposable local account.
- Local Mailpit received the real Supabase confirmation email. The running local auth service has email auto-confirmation disabled.
- Opened the email's original verification URL in the same Safari session. Its `redirect_to` targeted `/auth/confirm`; the handler received `code` and returned HTTP 307.
- Local database confirmed `email_confirmed_at` and `last_sign_in_at` were set.
- Navigated to `/profile` without signing in again. HTTP 200 and the correct account's profile appeared.
- Fully reloaded `/profile`; the authenticated profile remained visible, verifying persistent session cookies.
- Screenshot: `/private/tmp/auth-confirm-safari-profile.png`.

Simulator: `Quiver Auth Safari QA`, UDID `8FEEE6AF-C94F-4763-9036-D096B14BCD71`. Browser interactions used CUA against Simulator; backend evidence used the local Mailpit API and `docker exec supabase_db_quiver psql -U postgres -d postgres -Atc ...` scoped to the disposable account.

New finding: the dedicated `/auth/sign-up` page supplies itself as the return destination, so successful confirmation returns to a signup modal despite the authenticated header. Navigating to the protected profile and reloading worked. This is a separate existing post-signup destination issue, not an OTP/code exchange failure, and was not changed during this validation.

This supersedes the earlier "no simulator/live email transaction" gap for local same-browser Safari. Production email template/configuration, a physical iPhone, and cross-browser opening remain unverified. No additional production files or tests changed during simulator validation.

Cleanup: removed only the disposable local auth account (DELETE returned one row), stopped this test server, and shut down the dedicated QA simulator. Local test email retained as evidence; no production data changed.


## Follow-up: signup return destination — resolved

The separate finding above is now fixed locally. A closed header auth modal no longer overwrites the stored destination. Signup/signin destinations are normalized to home in the shared confirmation resolver, protecting both newly generated and already-sent confirmation links. Valid beach destinations and recovery defaults remain covered.

Production files changed for this follow-up: `components/auth/unified-auth-modal.tsx`, `lib/auth/confirm-utils.ts`. Tests modified: `__tests__/components/auth/unified-auth-modal.test.tsx`, `__tests__/app/auth-confirm-route.test.ts`, `__tests__/app/auth/confirm/route.test.ts`. Existing `e2e/guest-auth-confirm.spec.ts` covers error recovery; no new automated E2E spec was added for this follow-up.

Commands (Node 22, worktree root):
- PASS: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --runTestsByPath __tests__/components/auth/unified-auth-modal.test.tsx __tests__/app/auth/confirm/route.test.ts __tests__/app/auth-confirm-route.test.ts __tests__/app/auth-error-page.test.tsx` — 74 tests, 4 suites. Log `/private/tmp/auth-return-tests.log`.
- PASS: `yarn eslint --max-warnings=0 components/auth/unified-auth-modal.tsx lib/auth/confirm-utils.ts`.
- PASS: `yarn tsc --noEmit -p .auth-confirm-tsconfig.json` — source-only check excluding generated `.next` types; temporary config removed. Log `/private/tmp/auth-return-typecheck.log`.
- PASS: `git diff --check`.
- Test server: `VERCEL_ENV=preview yarn next dev --webpack -p 3000`.

Manual E2E: PASS in actual iOS 26.5 Simulator Safari. Submitted fresh signup with an explicit `/auth/sign-up` return destination. The real local Supabase email instead contained root `next`. Opened its verification link in the originating Safari session; `/auth/confirm?code=[redacted]&next=%2F` returned 307. Landed directly on the authenticated home page with the correct account initials and no signup modal. Full Safari reload retained that state. Local database confirmed both email confirmation and sign-in timestamps. Screenshot `/private/tmp/auth-return-safari-home.png`. Local home shows unavailable forecast data, unrelated to authentication.

Cleanup: deleted exactly the newly created local auth user by matching UUID and email (one row), stopped the test server, and shut down only the dedicated QA simulator. No production mutation or commit.

Final follow-up review: no actionable scoped findings. Earlier full build/typecheck failures remain unresolved and were not rerun for this follow-up. Production configuration, physical iPhone, cross-browser verification, and live PostHog delivery remain unverified. Automated Playwright error-path result remains the earlier 2/2 pass, not a fresh run after this follow-up; successful signup was validated manually end to end as above.
