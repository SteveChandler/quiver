# Phase 15: Shared Recommendation Primitive - Context

**Gathered:** 2026-06-01
**Status:** Planned, ready to execute

<domain>
## Phase Boundary

Create the reusable `SurfWindowRecommendation` data model and deterministic
helper. This phase should not build UI, change SEO templates, or introduce a new
ML model.
</domain>

<model>
## Required Shape

The shared model must include beach identity, start/end ISO times, a local label,
score, verdict, headline, wave/wind/tide summaries, best-for tags, positives,
watchouts, data notes, confidence, source flags, app deep link, universal link,
and canonical web URL.

Use this union vocabulary unless a later planning phase explicitly changes it:

- `verdict`: "Worth it", "Maybe", "Skip"
- `windQuality`: "offshore", "cross-shore", "onshore", "variable", "unknown"
- `tideTrend`: "rising", "falling", "high", "low", "unknown"
- `bestFor`: beginner, intermediate, advanced, longboard, shortboard, fish,
  mid-length, foamie, dawn-patrol, sunset-session
- `confidence.level`: low, medium, high
</model>

<logic>
## Recommendation Logic

1. Take existing forecast rows for a beach or region and return the top 3
   recommended surf windows.
2. Prefer 14 days if the data exists; fall back to 7 days if only 7 days exists.
3. Use deterministic v1 scoring only.
4. Score only surf-relevant inputs: wave height range, swell period, swell
   direction fit when available, wind direction/strength, tide phase/trend,
   skill fit, board fit, local spot behavior when available, and confidence or
   buoy alignment when available.
5. Do not overclaim sources. Missing buoy, cam, tide, or user-report data must
   be omitted from source chips or labeled model-only.
</logic>

<validation>
## Default Validation

- Unit tests for normal scoring.
- Unit tests for no tide data.
- Unit tests for no buoy data.
- Unit tests for sparse forecast rows.
- Unit tests for only 7-day horizon.
- Unit tests for low-confidence output.
- Unit tests for no recommendation available.
- Scoped ESLint and `yarn typecheck` for touched files.
</validation>

---

*Phase: 15-Shared Recommendation Primitive*
*Context gathered: 2026-06-01*
