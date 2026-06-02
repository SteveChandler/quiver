---
phase: 16-reusable-session-intelligence-ui-components
status: complete
gathered: 2026-06-02
---

# Phase 16 Research

## Component Surface

Phase 16 builds reusable display components only. The data contract and helper
surface from Phase 15 are the source of truth:

- `types/session-intelligence.ts`
- `lib/recommendations/surf-window-recommendations.ts`
- `lib/recommendations/surf-window-source-flags.ts`
- `lib/recommendations/surf-window-links.ts`

No production data fetches, route rollout, SEO metadata edits, schema changes,
or app-link/native-route changes belong in this phase.

## Existing UI Patterns

- Use `components/ui/button.tsx`, `components/ui/card.tsx`, and
  `components/ui/badge.tsx` rather than hand-coded primitives.
- Use `components/ui/accordion.tsx` for the `WhyThisCall` disclosure. It is
  Radix-backed and keyboard accessible.
- Use `components/ui/drawer.tsx` only if a modal/drawer is necessary. Accordion
  is enough for this component because it keeps the explanation inline and
  avoids route-level overlay state.
- Use lucide icons in compact UI affordances.
- Follow `docs/STYLE_GUIDE.md`: `font-heading` for headings, semantic status
  tokens, `Button` for actions, and restrained card surfaces.

## Link Handling

`AppDeepLinkCTA` should prefer the exact recommendation universal link, then the
relative app deep link, then `IOS_APP_STORE_URL`. It should not alter AASA,
assetlinks, app-store constants, or native app files. Exact native window
handling remains Phase 20 scope.

## Test Patterns

- Component unit tests live under `__tests__/components/...`.
- Use Testing Library for render and interaction tests.
- Playwright guest specs use `setupErrorDetection` in `beforeEach` and
  `assertNoErrors` after assertions.
- Responsive validation needs browser layout evidence, not JSDOM-only checks.

## Scope Decision

Add a dev-only preview route for browser validation:

- `app/dev/session-intelligence-preview/page.tsx`
- It must call `notFound()` in production.
- It must use static fixture recommendations only.
- It must not be linked from app navigation or SEO metadata.

This satisfies Phase 16 mobile/desktop checks without rolling the component into
real user-facing production surfaces.
