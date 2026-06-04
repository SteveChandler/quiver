---
phase: 16-reusable-session-intelligence-ui-components
status: planned
gathered: 2026-06-02
---

# Phase 16 Validation Plan

## Unit / Component Tests

- `__tests__/components/session-intelligence/source-confidence-badge.test.tsx`
- `__tests__/components/session-intelligence/app-deep-link-cta.test.tsx`
- `__tests__/components/session-intelligence/why-this-call.test.tsx`
- `__tests__/components/session-intelligence/best-surf-windows.test.tsx`

Coverage must include:

- 1, 2, and 3 recommendations.
- Missing tide, buoy, cam, and user-report source flags.
- Source badge labels that omit unavailable sources.
- `WhyThisCall` disclosure behavior.
- App deep link, universal link, and App Store fallback.

## Browser / Responsive Checks

- Add `e2e/guest-session-intelligence-components.spec.ts`.
- Use the dev-only preview route.
- Check widths: 360, 390, 412, 768, and 1280.
- Assert the component renders without horizontal overflow and keeps required
  labels/actions visible.

## Static Guards

- No production fetch or Supabase calls in `components/session-intelligence`.
- No diffs in `app/layout.tsx` or `lib/constants/seo.ts`.
- No AASA, assetlinks, native, or app-store constant changes.

## Commands

```bash
yarn test:unit __tests__/components/session-intelligence/source-confidence-badge.test.tsx __tests__/components/session-intelligence/app-deep-link-cta.test.tsx __tests__/components/session-intelligence/why-this-call.test.tsx __tests__/components/session-intelligence/best-surf-windows.test.tsx --runInBand
npx eslint --max-warnings=0 components/session-intelligence app/dev/session-intelligence-preview/page.tsx __tests__/components/session-intelligence e2e/guest-session-intelligence-components.spec.ts
yarn typecheck
npx playwright test e2e/guest-session-intelligence-components.spec.ts --project=guest
```
