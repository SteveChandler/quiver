# Phase 17 Validation Plan

**Created:** 2026-06-02

## Unit And Component Checks

Run targeted Jest checks for changed helpers and surfaces:

```bash
yarn test:unit __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts --runInBand
yarn test:unit __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/components/session-intelligence/why-this-call.test.tsx --runInBand
yarn test:unit __tests__/components/beach-detail/tabs/forecast-tab.test.tsx __tests__/components/forecast/regional-best-surf-windows.test.tsx __tests__/components/home-screen/session-intelligence-module.test.tsx --runInBand
```

If exact filenames differ during execution, run the nearest touched test files
and any tests importing the touched modules.

## Static Checks

```bash
npx eslint --max-warnings=0 <touched production files> <touched test files>
yarn typecheck
```

## Targeted E2E Checks

```bash
npx playwright test e2e/guest-session-intelligence-components.spec.ts e2e/guest-spot-surf-report.spec.ts --project=guest
npx playwright test e2e/forecast-hub.spec.ts e2e/home.spec.ts --project=auth
```

Add or update pilot-specific E2E coverage if existing specs cannot prove:

- Spot pilot renders top windows on `/ca/san-diego/blacks` without hiding tabs.
- Regional pilot renders "Best windows this week" while `SevenDayOutlook`
  remains visible.
- Homepage module renders from fallback discovery data when browser location is
  unavailable.
- App CTA anchors have valid `href`s.
- "Why this call?" opens and exposes positive signals, watchouts, confidence,
  and sources.

## Responsive Matrix

For the pilot surfaces, verify no horizontal overflow and no incoherent overlap
at:

- 360 x 900
- 390 x 900
- 412 x 900
- 768 x 900
- 1280 x 900

## Performance Evidence

Before the first code change, record local navigation timing for:

- `/ca/san-diego/blacks`
- `/forecast?region=southern-california`
- `/` in the auth project

After implementation, repeat the same route timing checks. Investigate any
route whose local p75 navigation/load timing increases by more than roughly 20%
or whose implementation adds duplicate forecast/discovery fetches.

## Final Gate

Phase 17 is ready to close only when:

- All three pilot surfaces render.
- Existing spot/forecast/home content remains visible.
- App CTAs work.
- Targeted unit/static/E2E checks pass or blockers are documented.
- Route timing evidence is recorded.

