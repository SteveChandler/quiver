# E2E Test Debt Documentation

> Updated: 2026-04-01
> Context: Full suite optimization — removed redundant perf tests, replaced waitForTimeout calls, converted skipped tests to stubs or @infra tags

## Summary

Previous debt (39 skipped tests across 18 files) has been addressed:
- **Redundant performance tests deleted** — `guest-landing-performance.spec.ts`, `smoke-seo.spec.ts` (duplicated Lighthouse CI coverage)
- **`waitForTimeout` calls reduced** — 179 → 68 (62% reduction), all remaining annotated with eslint-disable reasons
- **`test.describe.skip` blocks** — 0 remaining (were 11+)
- **`test.fixme` calls** — 0 remaining (were 30+)
- **Infrastructure tests tagged `@infra`** — opt-in via `RUN_INFRA_TESTS=true`

## Infrastructure Tests (@infra)

These tests require infrastructure not available in local dev. They are tagged `@infra` and excluded by default via `grepInvert` in `playwright.config.ts`. Run with `RUN_INFRA_TESTS=true`.

| File | Tests | Requires |
|------|-------|----------|
| `push-notifications.spec.ts` | 5 describe blocks | Firebase FCM |
| `rate-limiting.spec.ts` | Full file | Rate limiting middleware |
| `error-boundaries.spec.ts` | 1 describe block | Network simulation |

## Stubbed Tests (throw new Error)

These tests have been converted from `test.skip`/`test.fixme` to active tests with `throw new Error('Not implemented: ...')`. They will fail loudly if run, making debt visible rather than silently hidden.

### High Priority (User-facing features)
| File | Tests | Issue |
|------|-------|-------|
| `location-pages.spec.ts` | 16 tests (4 blocks) | Selectors changed in location pages redesign |
| `plan-session.spec.ts` | 2 tests | Wizard navigation behavior changed |
| `sessions.spec.ts` | 1 test | Session creation button selector changed |

### Medium Priority
| File | Tests | Issue |
|------|-------|-------|
| `personalized-insights.spec.ts` | 10 tests | Personalized forecast card structure changed |
| `implicit-preference-privacy.spec.ts` | 8 tests | Privacy preference UI changed |
| `session-wizard-autofill.spec.ts` | 3 tests | Autofill behavior changed |
| `input-validation.spec.ts` | 3 tests | API endpoint behavior changed |
| `map-coordinate-validation.spec.ts` | 4 tests | Marker click interaction changed |

### Low Priority
| File | Tests | Issue |
|------|-------|-------|
| `discover.spec.ts` | 2 tests | Social follow feature not yet implemented |
| `api/social-interactions.spec.ts` | 1 test | Follow toggle returns 500 for fake user IDs |
| `api/gamification.spec.ts` | 1 test | POST endpoint may not exist |

## Remaining waitForTimeout Calls

68 calls remain across 15 files, all with eslint-disable annotations. Categories:

| Category | Count | Reason |
|----------|-------|--------|
| Mapbox map initialization | ~13 | GL context needs time to initialize |
| Scroll/animation settling | ~12 | CSS animations, IntersectionObserver timing |
| Geolocation simulation | ~6 | Browser geolocation API latency |
| Polling/retry loops | ~6 | Intentional backoff in test utilities |
| Error collection windows | ~4 | Waiting for async error handlers to fire |
| Onboarding scripts | ~13 | Multi-step wizard automation |
| Other genuine timing | ~14 | Various browser-level timing needs |

## How to Fix Stubbed Tests

1. Use Playwright's `page.pause()` to inspect current DOM and find updated selectors
2. Update `data-testid` values or use more resilient selectors
3. For API behavior changes, check current responses with `curl`
4. Run individual tests: `npx playwright test e2e/<file>.spec.ts`
