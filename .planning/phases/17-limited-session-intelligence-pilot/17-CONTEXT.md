# Phase 17: Limited Session Intelligence Pilot - Context

**Gathered:** 2026-06-01
**Status:** Added to roadmap, not planned

<domain>
## Phase Boundary

Prove the Session Intelligence module on a small surface before rollout. Do not
remove existing spot/forecast content and do not broaden SEO rollout in this
phase.
</domain>

<pilot_surfaces>
## Pilot Surfaces

1. One major spot page, preferably `/ca/san-diego/blacks` or another high-value
   existing spot page.
2. One regional forecast page, such as `/forecast`, `/forecast/santa-cruz`, or
   another region with enough data.
3. Homepage compact module: "Find your next best surf window."
</pilot_surfaces>

<work>
## Work

- Spot page: place `BestSurfWindows` above or near forecast/reviews/local-intel
  tabs, show top 3 windows, preserve field-guide/local-intel content, and add
  "Why this call?" where a current conditions call exists.
- Regional forecast page: keep the 7-day outlook, add "Best windows this week"
  above the daily list, link to the best spot/window when available, and expand
  thin "Why" copy into the shared explanation format.
- Homepage: use user location/home region if already available; otherwise show
  popular regions/spots. CTA copy should include "Browse best surf windows" and
  "Open in app."
</work>

<brand_direction>
## Brand Direction

- Reuse Brand-Vault assets when Session Intelligence UI needs visual texture.
- Primary source: `/Users/stevenchandler/Desktop/dev/Brand-Vault/media/icons/quiver-sticker-sheet`.
- Web mirror: `public/images/quiver-stickers`.
- Preserve the Phase 16 sticker treatment for wave, wind, tide, rank, and source
  details unless a real surface needs a quieter variant.
- Prefer existing sticker-sheet icons, tape strips, torn-paper shapes, and
  Brand-Vault colors over new generic icons or decorative art.
</brand_direction>

<validation>
## Default Validation

- Targeted component/unit tests for pilot data wiring.
- Targeted Playwright on pilot pages, including anonymous state.
- Mobile checks at 360px, 390px, 412px, tablet, and desktop.
- Route performance comparison before/after on touched pilot pages.
- Verify app CTA still works and no existing content is removed.
</validation>

---

*Phase: 17-Limited Session Intelligence Pilot*
*Context gathered: 2026-06-01*
