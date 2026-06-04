# Requirements: Quiver Go-Live Campaign

Defined: 2026-05-24
Last compressed: 2026-05-31
Full pre-cleanup history: [.planning/archive/2026-05-31-doc-cleanup/REQUIREMENTS-full-history.md](archive/2026-05-31-doc-cleanup/REQUIREMENTS-full-history.md)

## Current Goal

Track only the active requirements for the current go-live/refactor planning state while preserving completed launch requirements in archive.

## Current Status

The Phase 14 Session Intelligence guardrails and inventory, Phase 15 recommendation primitive, Phase 16 reusable UI, and Phase 17 limited pilot are complete. Phase 18 SEO-safe intent rollout is planned and ready for execution. Earlier messaging, landing, pricing, blog, App Store, outreach, analytics, release-quality, PBSC, Sentry, and controlled-refactor work is historical for this tracker unless a future task reopens it.

## Active Requirements

- **REF-01**: Completed in Phase 13. Remaining production `@/lib/api-utils` imports outside wrapper internals were migrated.
- **REF-02**: Completed in Phase 13. API wrapper compatibility exports and wrapper-internal dependencies have documented ownership.
- **REF-03**: Completed in Phase 13. Each refactor slice stayed behavior-preserving, PR-sized, and test-backed.
- **REF-04**: Completed in Phase 13. [docs/refactor-roadmap.md](../docs/refactor-roadmap.md) records progress, validation, risks, rollback, and future candidates.
- **REF-05**: Completed in Phase 13. Targeted Jest, scoped ESLint, `yarn typecheck`, and preview build passed locally.
- **SI-01**: Completed in Phase 14. Eligible web templates and data availability were inventoried before adding heavier recommendation UI.
- **SI-02**: Create a deterministic `SurfWindowRecommendation` model and helper that returns top surf windows from existing forecast data without a new ML model.
- **SI-03**: Build reusable, accessible UI components for best windows, explanations, source confidence, and app deep links. Session Intelligence UI must use Brand-Vault styling and sticker-sheet assets where visual treatment is introduced, including the web mirror at `public/images/quiver-stickers`.
- **SI-04**: Prove Session Intelligence on a limited pilot before rollout: one major spot page, one regional forecast page, and a compact homepage module.
- **SI-05**: Roll out only after pilot validation while preserving page intent, canonical URLs, schema, app CTAs, and measurement.
- **SI-06**: Upgrade `/forecast-accuracy` so it never appears empty and only shows accuracy claims backed by data.
- **SI-07**: Phase 14 baseline complete. Universal/app links, analytics, performance, structured-data, source-claim, and fallback-state checklists are documented; later implementation phases must preserve and extend validation before broad rollout.

## Open Gaps

- Phase 18 SEO-safe intent rollout is planned and still needs execution. Phases 19-20 still need planning and execution.
- Future candidates are listed in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- Wrapper-internal helper collapse remains future work outside the completed Phase 13 checkpoint.

## Decisions Already Made

- Completed launch requirements remain preserved in the full-history archive, not repeated in this active tracker.
- Monetization, CMS-style blog management, automated lifecycle nurture, and dedicated launch dashboards remain deferred v2 scope.
- Production database migrations, deploys, alias promotion, outbound sends, and payment actions require explicit approval.
- Ahrefs crawl limit remains fixed; treat Ahrefs as a sampled audit and confirm findings against GSC, Vercel, PostHog, direct template review, or code inspection.
- Session Intelligence surfaces should pull visual direction from Brand-Vault before adding new icons, stickers, tape treatments, screenshots, or decorative art.

## Next Actions

- Execute Phase 18 SEO-safe intent rollout before planning Phase 19 forecast-accuracy trust page.
- Preserve approval gates for deploys, production mutations, outbound sends, payment actions, and entitlement changes.

## Historical Notes

The full pre-cleanup requirements file included 54 v1 requirements mapped across launch messaging, public zine refresh, landing page, pricing, blog, App Store/mobile messaging, outreach/social, analytics/reporting, release quality, PBSC route verification, Sentry observability, and controlled refactor completion. Completed sections were compressed because they are no longer the active planning surface.
