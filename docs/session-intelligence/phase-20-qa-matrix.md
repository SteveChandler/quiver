# Phase 20 QA Matrix

Owner: Quiver Web
Created: 2026-06-02

## Scope

This matrix covers the Phase 20 public web QA conditions for Session
Intelligence app-link fallback, analytics readiness, canonical/schema safety,
source sparsity, responsive layout, and slow-route regression checks.

Native app-installed universal-link behavior is manual unless a signed native
simulator or device test is added. For Phase 20, simulator app-scheme route
evidence is accepted; signed HTTPS handoff is deferred to the next native
release lane.

## Matrix

| Condition | Automated validation | Manual gate | Owner | Status |
|---|---|---|---|---|
| Mobile 360px | `e2e/guest-session-intelligence-phase20.spec.ts` viewport loop checks `/app/spot/la-jolla-shores`, `/forecast`, `/forecast-accuracy`, and `/best-time-to-surf/la-jolla` for visible content and no horizontal overflow. | None. | Quiver Web | Covered locally. |
| Mobile 390px | `e2e/guest-session-intelligence-phase20.spec.ts` viewport loop. Existing coverage also includes `e2e/guest-session-intelligence-components.spec.ts`, `e2e/guest-session-intelligence-seo-rollout.spec.ts`, and `e2e/guest-forecast-accuracy.spec.ts`. | None. | Quiver Web | Covered locally. |
| Mobile 412px | `e2e/guest-session-intelligence-phase20.spec.ts` viewport loop. Existing Phase 16 component preview also covers 412px. | None. | Quiver Web | Covered locally. |
| Tablet | `e2e/guest-session-intelligence-phase20.spec.ts` viewport loop at 768px. Existing Phase 16 component preview covers tablet. | None. | Quiver Web | Covered locally. |
| Desktop | `e2e/guest-session-intelligence-phase20.spec.ts` viewport loop at 1280px. Existing Phase 18 and Phase 19 guest specs cover desktop on sampled routes. | None. | Quiver Web | Covered locally. |
| No forecast data | `__tests__/components/session-intelligence/best-surf-windows.test.tsx` checks the empty state; `__tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts` checks empty spot forecasts. | None. | Quiver Web | Covered locally. |
| 7-day only | `__tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts` checks first-week-only rows remain renderable. Existing `__tests__/lib/recommendations/surf-window-recommendations.test.ts` checks `horizonDays: 7`. | None. | Quiver Web | Covered locally. |
| 14-day available | `__tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts` checks week-two rows remain renderable. Existing `__tests__/lib/recommendations/surf-window-recommendations.test.ts` checks `horizonDays: 14`. | None. | Quiver Web | Covered locally. |
| No buoy | `__tests__/components/session-intelligence/best-surf-windows.test.tsx` and `__tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts` check no buoy source label is invented and the data note remains explicit. | None. | Quiver Web | Covered locally. |
| No tide | Same focused unit coverage checks the tide unavailable copy and absent tide source. | None. | Quiver Web | Covered locally. |
| No cam | Same focused unit coverage checks no cam source label is invented and the data note remains explicit. | None. | Quiver Web | Covered locally. |
| No user reports | Same focused unit coverage checks no user-report source label is invented and the data note remains explicit. | None. | Quiver Web | Covered locally. |
| Model only | `__tests__/components/session-intelligence/best-surf-windows.test.tsx` checks the `Model only` badge for model-only non-low confidence. | None. | Quiver Web | Covered locally. |
| Low confidence | `__tests__/components/session-intelligence/best-surf-windows.test.tsx` checks `Low - sparse data`; adapter tests check low-confidence data notes. | None. | Quiver Web | Covered locally. |
| App not installed | `/app/spot/la-jolla-shores?window=phase20-smoke` is covered in `e2e/guest-session-intelligence-phase20.spec.ts` as the browser fallback path. | Verify on an iPhone without Quiver installed that a universal link opens the fallback and the App Store CTA is usable. | Quiver Web + Native | Automated fallback covered; physical no-install spot check still useful. |
| App-link fallback | `e2e/guest-session-intelligence-phase20.spec.ts` checks App Store and web fallback links on `/app/spot/:slug?window=:id`. `__tests__/app/app-spot-handoff-page.test.tsx` checks server-rendered fallback content. | Verify production `https://www.quiversurf.app/app/spot/la-jolla-shores?window=phase20-smoke` on signed device/TestFlight before the next native release. | Quiver Web + Native | Automated fallback and simulator native route covered; signed HTTPS handoff deferred. |
| Canonical tags | `e2e/guest-session-intelligence-phase20.spec.ts` checks canonicals on `/forecast`, `/forecast-accuracy`, and `/best-time-to-surf/la-jolla`; 20-01 unit tests check canonical web URLs omit `window=`. | Live production spot-check after deploy. | Quiver Web | Covered locally. |
| Schema | `e2e/guest-session-intelligence-phase20.spec.ts` checks JSON-LD presence on `/forecast`, `/forecast-accuracy`, and `/best-time-to-surf/la-jolla`; Phase 19 component tests cover Dataset schema. | Live Rich Results or schema validator sample after deploy if release risk is high. | Quiver Web | Covered locally. |
| Slow route regression | `docs/session-intelligence/phase-20-before-after-measurement.md` records before p75 LCP/INP/CLS where samples exist; `VERCEL_ENV=preview yarn build` passed in 20-02. | After deploy, compare Vercel/PostHog route performance for 3-day, 7-day, and 28-day windows. | Quiver Web | Baseline covered; after-check pending. |

## Existing E2E Reviewed

- `e2e/guest-session-intelligence-components.spec.ts`
- `e2e/guest-session-intelligence-seo-rollout.spec.ts`
- `e2e/guest-forecast-accuracy.spec.ts`

## Manual Gates Before Public Claims

- Production AASA and Android assetlinks must be checked live.
- Native app-installed HTTPS handoff must be verified on a signed app build or
  device before claiming installed-app HTTPS handoff works in a native release.
- App-not-installed fallback must be verified on a real iOS Safari device.
- GSC/PostHog/Vercel after windows must complete before any lift claim.
