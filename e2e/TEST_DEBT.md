# E2E Test Debt Documentation

> Updated: 2026-04-27
> Context: Dead `Not implemented:` tests for permanently-removed features deleted outright. Only environment-guard throws remain.

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

## Environment-Guard `throw new Error('Not implemented: ...')`

Only environment-guard throws remain. These fire when test infrastructure (Mapbox internals, `/api/beaches` endpoint) isn't accessible — not because the underlying feature is dead.

| File | Tests | Guard |
|------|-------|-------|
| `map-coordinate-validation.spec.ts` | 4 throws | Inaccessible Mapbox map instance / missing `/api/beaches` endpoint |

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
