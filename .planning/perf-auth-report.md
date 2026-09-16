# Auth performance/security work

Inspected repository soul, Supabase architecture, API wrappers, SDK recovery/storage helpers, existing API and middleware tests, Jest/TS config, Main Gate CI. Installed and lockfile @supabase/auth-js are both 2.100.0. SDK recovery assigns .user before validating parsed storage and logs the resulting exception itself. No reusable general credential sanitizer exists (provider-specific push sanitizer is unrelated).

Plan reviewed: move SDK session validity guard before mutation using established patch-package postinstall, covering all consumers without custom auth parsing; reject corrupt sessions rather than trust nested JSON. Scrub credentials at shared API error and Sentry boundaries. Preserve valid session verification and refresh. Add synthetic regression tests, scoped lint/typecheck, review diff. No auth policy, email behavior, schema or production changes.

## Changes and review

- `patches/@supabase+auth-js+2.100.0.patch`: moves the SDK's existing session-shape validation before `.user` mutation in source, CJS and ESM. Invalid serialized/numeric/boolean session storage is removed without leaking a TypeError. Normal user verification and expired-session refresh retain their existing paths.
- `lib/monitoring/redact-secrets.ts`: shared recursive telemetry scrubber. Drops complete credential-bearing strings rather than attempting to salvage fragments of malformed serialized sessions; redacts sensitive structured fields, bounds recursion.
- `lib/api-utils.ts`: scrub API exception message/stack before console output or response body, including optional error details.
- `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts`: scrub events/transactions and enabled server/edge logs before sending.
- Added `__tests__/lib/supabase/auth-session-recovery.test.ts`, `__tests__/lib/monitoring/redact-secrets.test.ts`, `__tests__/lib/monitoring/sentry-redaction.test.ts`; extended `__tests__/lib/api-utils.test.ts`.

Review: no auth bypass, no token decoding/trusting nested JSON, no mutable global console interception, no email route edits, no secrets accessed. SDK patch applies across browser/API/proxy clients after normal postinstall. Invalid sessions follow existing SDK invalid-session removal behavior. Scope excludes historical credential revocation and production log cleanup.

## Verification

All Jest runs used synthetic environment values only:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-anon NEXT_PUBLIC_SITE_URL=http://localhost:3000 SUPABASE_SERVICE_ROLE_KEY=gate-unit-tests-placeholder yarn test:unit --runInBand --silent __tests__/lib/supabase/auth-session-recovery.test.ts __tests__/lib/monitoring/redact-secrets.test.ts __tests__/lib/monitoring/sentry-redaction.test.ts __tests__/lib/middleware/api-wrappers.test.ts __tests__/lib/monitoring/sentry-config.test.ts __tests__/lib/api-utils.test.ts
```

PASS: 6 suites, 72 tests (`.planning/auth-final-check.log`). Initial runs found test-fixture issues (incorrect relative Sentry config path, omitted `expires_in`, overly broad no-remove assertion despite expected PKCE verifier cleanup), all corrected. No production changes were needed for those test failures.

```sh
npx eslint --max-warnings=0 lib/monitoring/redact-secrets.ts lib/api-utils.ts sentry.server.config.ts sentry.edge.config.ts instrumentation-client.ts __tests__/lib/supabase/auth-session-recovery.test.ts __tests__/lib/monitoring/redact-secrets.test.ts __tests__/lib/monitoring/sentry-redaction.test.ts __tests__/lib/api-utils.test.ts
```

PASS, run twice including after test corrections.

```sh
npx patch-package --reverse --error-on-fail
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-anon NEXT_PUBLIC_SITE_URL=http://localhost:3000 SUPABASE_SERVICE_ROLE_KEY=gate-unit-tests-placeholder yarn test:unit --runInBand --silent __tests__/lib/supabase/auth-session-recovery.test.ts
npx patch-package --error-on-fail
```

Reverse PASS; intentional negative control FAIL (4 malformed-session cases fail, valid user and refresh cases still pass); clean patch reapply PASS. Followed by the passing final six-suite run above. SDK package was copied privately before mutation; shared node_modules was never modified. Local node_modules now uses private copies of auth-js, supabase-js and ssr; other dependencies remain symlinks. A Node require.resolve check confirmed supabase-js resolves this private patched auth-js.

`git diff --check`: PASS.

`yarn typecheck`: interrupted with SIGTERM at root request to reduce concurrent TypeScript resource contention; NOT a passing check. Root will run one combined typecheck.

E2E reviewed: `e2e/README.md`, `e2e/guest-auth.spec.ts`, `e2e/prod-readonly/auth-api.spec.ts`. No E2E tests added/modified/run. E2E status: unverified, needs authenticated local/preview runtime before release. Existing guest invalid-credential test has a weak fallback (dialog remaining visible); left outside scope, this patch's assertions directly test session removal and zero raw logging.

Remaining risks: pinned upstream patch must be reevaluated on auth-js upgrade; installs must run existing patch-package postinstall. Whole credential-bearing diagnostics are intentionally redacted, reducing context. Arbitrary unlabeled opaque secrets cannot be identified by a generic scrubber; known auth fields, JWTs, headers and serialized auth exception messages are covered. No build/browser/iOS OAuth validation was run. Production historical exposed sessions/logs remain for separate operator action. No commit, push, deploy, production mutation or session revocation.
