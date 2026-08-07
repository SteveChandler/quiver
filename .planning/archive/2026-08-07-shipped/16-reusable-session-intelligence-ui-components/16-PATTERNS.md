---
phase: 16-reusable-session-intelligence-ui-components
status: complete
gathered: 2026-06-02
---

# Phase 16 Patterns

## Component Placement

Use a dedicated directory:

```text
components/session-intelligence/
  app-deep-link-cta.tsx
  best-surf-windows.tsx
  source-confidence-badge.tsx
  why-this-call.tsx
  index.ts
```

Keep the components data-only. They accept `SurfWindowRecommendation` objects
and do not fetch or mutate data.

## Component Roles

- `SourceConfidenceBadge`: derives a compact honest label from
  `recommendation.confidence` and `recommendation.sources`.
- `AppDeepLinkCTA`: renders one action from recommendation link fields with App
  Store fallback.
- `WhyThisCall`: inline accessible accordion for positives, watchouts,
  confidence reasons, and present source chips.
- `BestSurfWindows`: composition wrapper for one to three recommendation cards.

## Source Claim Rule

Never display a source label unless its boolean source flag is true. Missing
tide, buoy, cam, or user-report data must remain omitted from source chips.

## Accessibility Pattern

- Use semantic section headings.
- Use real links for navigation actions.
- Use `aria-label` on compact badges and icon-heavy actions.
- Keep `WhyThisCall` keyboard-accessible through Radix accordion.

## Responsive Pattern

- Mobile-first single column.
- At tablet/desktop widths, use a responsive grid for up to three windows.
- Keep card internals stable with fixed score badge dimensions and wrapping text.

## Visual Direction

Use Quiver's dark twilight surf UI language:

- Deep twilight card surfaces, warm orange/gold accents, and muted borders.
- Compact, decision-first UI. No marketing hero composition.
- Cards remain individual repeated items; do not wrap the whole section in a
  decorative outer card.
