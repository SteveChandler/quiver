# Phase 18 Validation Strategy

## Purpose

Phase 18 changes SEO-facing templates. Validation must prove the rollout is
additive, public, route-safe, source-honest, and measurable before any broader
rollout.

## Required Local Checks

```bash
yarn test:unit __tests__/lib/recommendations/session-intelligence-rollout.test.ts --runInBand
yarn test:unit __tests__/components/intent/todays-intent-plan.test.tsx __tests__/components/intent/session-intelligence-intent-handoff.test.tsx --runInBand
yarn test:unit __tests__/components/beginner/beginner-session-decision.test.tsx __tests__/app/best-time-city-page.test.ts --runInBand
npx eslint --max-warnings=0 <Phase 18 touched production and test files>
yarn typecheck
npx playwright test --list e2e/guest-session-intelligence-seo-rollout.spec.ts e2e/visual/seo-funnel-next-steps.spec.ts e2e/guest-spot-surf-report.spec.ts
npx playwright test e2e/guest-session-intelligence-seo-rollout.spec.ts --project=guest
```

## SEO Safety Assertions

- Canonical URLs remain unchanged for every sampled route.
- Water-temp H1/title/copy keep water temperature as the primary intent.
- Best-time pages keep seasonal/monthly framing and link to live conditions as a handoff.
- Malibu enrichment does not rename the page or target `/surf-report/malibu-today` keywords.
- Structured data scripts remain present on sampled tide, water-temp, best-time, and spot pages.
- Basic surf-window or planning answers are visible without sign-in.
- Alerts, saved windows, or personalization can remain gated.
- Source badges never claim unavailable tide, buoy, cam, or user-report support.

## Sample Routes

Generic and beginner intent:
- `/longboard/san-diego`
- `/least-crowded/santa-cruz`
- `/beginner/san-diego`

Dedicated utility and sun-time intent:
- `/tide/san-diego`
- `/water-temp/huntington-beach`
- `/water-temp/santa-cruz`
- `/dawn-patrol/san-diego`
- `/sunset/santa-cruz`

Best-time and spot:
- `/best-time-to-surf/la-jolla`
- `/best-time-to-surf/westport`
- `/best-time-to-surf/cocoa-beach`
- `/ca/malibu/malibu-surfrider-first-point-malibu-ca`

## Measurement Evidence To Record

- GSC before/after CTR, average position, and impressions for sampled routes.
- GSC sister-page check for `/surf-report/malibu-today` before/after Malibu spot enrichment.
- PostHog or existing analytics multi-page behavior for sampled pages.
- Vercel or browser timing evidence for pages that receive new modules.
- Exact date window used for any before/after claim.
