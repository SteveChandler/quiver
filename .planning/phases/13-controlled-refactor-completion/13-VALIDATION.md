---
phase: 13
slug: controlled-refactor-completion
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-31
---

# Phase 13 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Jest 29, ESLint flat config, TypeScript strict, Next.js preview build |
| Config files | `jest.config.js`, `eslint.config.mjs`, `tsconfig.json`, `next.config.mjs` |
| Quick run command | `yarn test:unit --runInBand <focused-test-file>` |
| Full gate command | `yarn typecheck` and `VERCEL_ENV=preview yarn build` |
| Estimated runtime | Focused tests: under 2 minutes each. Typecheck/build: several minutes. |

## Sampling Rate

- After every production-code slice: run the focused Jest file for that slice.
- After every production-code slice: run scoped ESLint on touched files.
- After all import cleanup slices: run the import guard, `yarn typecheck`, and
  `VERCEL_ENV=preview yarn build`.
- Before phase closeout: final targeted Jest sweep plus typecheck/build must be
  green, or failures must be documented as unresolved blockers.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 13-01 | 1 | REF-01, REF-03 | T-13-01 | Invalid beach UUIDs still return the existing email-action error page before token verification. | unit/source guard | `yarn test:unit --runInBand __tests__/app/session/confirm/route.test.ts` | yes | passed 2026-05-31 |
| 13-02-01 | 13-02 | 2 | REF-01, REF-03 | T-13-02 | Unauthorized cron requests still skip `cron_runs` and Sentry check-ins. | unit/source guard | `yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts` | yes | passed 2026-05-31 |
| 13-02-02 | 13-02 | 2 | REF-01, REF-03 | T-13-03 | JSON parsing errors still return 400 validation envelopes. | unit/source guard | `yarn test:unit --runInBand __tests__/lib/validation/middleware.test.ts` | yes | passed 2026-05-31 |
| 13-02-03 | 13-02 | 2 | REF-01, REF-03 | T-13-04 | Blocked bots still receive 403 plus default security headers. | unit/source guard | `yarn test:unit --runInBand __tests__/lib/middleware/bot-blocker.test.ts __tests__/lib/middleware/api-wrappers.test.ts` | yes | passed 2026-05-31 |
| 13-03-01 | 13-03 | 3 | REF-02 | T-13-05 | Route type imports can come from the compatibility barrel without runtime changes. | type/source guard | `yarn typecheck` | yes | passed focused tests/lint 2026-05-31; typecheck pending 13-04 |
| 13-04-01 | 13-04 | 4 | REF-01, REF-05 | T-13-06 | No production imports outside wrapper internals point at `@/lib/api-utils`. | source guard/build | `rg -n "@/lib/api-utils" app lib proxy.ts --glob '!lib/middleware/api-wrappers.ts' --glob '!lib/middleware/api-wrappers/**'` | yes | green 2026-05-31 |

## Wave 0 Requirements

Existing infrastructure covers Phase 13 requirements:

- Jest is configured in `jest.config.js`.
- Scoped ESLint is available through `npx eslint --max-warnings=0 <files>`.
- TypeScript is available through `yarn typecheck`.
- Preview build is available through `VERCEL_ENV=preview yarn build`.

The execution plans add two focused test files:

- `__tests__/lib/validation/middleware.test.ts`
- `__tests__/lib/middleware/bot-blocker.test.ts`

## Manual-Only Verifications

All Phase 13 implementation behavior has automated or source-guard validation.
No browser E2E is expected because this phase changes imports, focused utility
tests, wrapper type exports, and planning/refactor documentation, not UI flows.

## Validation Sign-Off

- All plans include automated verification commands.
- Source guards exist for each production import cleanup target.
- Final gate completed 2026-05-31: production import guard returned no matches,
  route type guard returned only wrapper-adjacent `bot-blocker.ts`, targeted
  Jest passed 15 suites / 169 tests, scoped ESLint passed, `yarn typecheck`
  passed, and `VERCEL_ENV=preview yarn build` passed.
- `nyquist_compliant: true` is set in frontmatter.
