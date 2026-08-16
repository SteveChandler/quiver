# Phase 16: Reusable Session Intelligence UI Components - Context

**Gathered:** 2026-06-01
**Status:** Added to roadmap, not planned

<domain>
## Phase Boundary

Build reusable UI components for existing Session Intelligence recommendations.
This phase should not broaden rollout beyond test/demo integration unless a plan
explicitly includes a narrow surface.
</domain>

<components>
## Components

- `BestSurfWindows`: reusable card/table component for 1-3 windows. Each
  recommendation shows local time, score, verdict, wave/wind/tide summary,
  best-for tags, confidence badge, "Open this window in Quiver", and "Why this
  call?"
- `WhyThisCall`: accessible drawer, modal, or accordion for positives,
  watchouts, confidence, and source chips. Must support keyboard focus, aria
  labels, escape-to-close if modal, and screen-reader-readable section labels.
- `SourceConfidenceBadge`: compact source label, such as "High - buoy + model",
  "Medium - model + tide", "Low - sparse data", or "Model only". It must never
  display sources that are not present.
- `AppDeepLinkCTA`: exact beach/window deep link plus universal link. Use
  existing app-link config if present; otherwise fall back safely to the App
  Store without breaking web rendering.
</components>

<validation>
## Default Validation

- Component tests for `BestSurfWindows` and `WhyThisCall`.
- Source badge assertions that unavailable sources are omitted.
- Rendering checks for 1, 2, and 3 recommendations.
- Rendering checks with missing tide, buoy, cam, and user-report data.
- Mobile/desktop checks at 360px, 390px, 412px, tablet, and desktop.
- Scoped ESLint and `yarn typecheck` for touched files.
</validation>

---

*Phase: 16-Reusable Session Intelligence UI Components*
*Context gathered: 2026-06-01*
