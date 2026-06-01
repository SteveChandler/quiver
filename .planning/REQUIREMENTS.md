# Requirements: Quiver Go-Live Campaign

Defined: 2026-05-24
Last compressed: 2026-05-31
Full pre-cleanup history: [.planning/archive/2026-05-31-doc-cleanup/REQUIREMENTS-full-history.md](archive/2026-05-31-doc-cleanup/REQUIREMENTS-full-history.md)

## Current Goal

Track only the active requirements for the current go-live/refactor planning state while preserving completed launch requirements in archive.

## Current Status

The Phase 13 controlled refactor checkpoint is complete. Earlier messaging, landing, pricing, blog, App Store, outreach, analytics, release-quality, PBSC, and Sentry work is historical for this tracker unless a future task reopens it.

## Active Requirements

- **REF-01**: Completed in Phase 13. Remaining production `@/lib/api-utils` imports outside wrapper internals were migrated.
- **REF-02**: Completed in Phase 13. API wrapper compatibility exports and wrapper-internal dependencies have documented ownership.
- **REF-03**: Completed in Phase 13. Each refactor slice stayed behavior-preserving, PR-sized, and test-backed.
- **REF-04**: Completed in Phase 13. [docs/refactor-roadmap.md](../docs/refactor-roadmap.md) records progress, validation, risks, rollback, and future candidates.
- **REF-05**: Completed in Phase 13. Targeted Jest, scoped ESLint, `yarn typecheck`, and preview build passed locally.

## Open Gaps

- Future candidates are listed in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- Wrapper-internal helper collapse remains future work outside the completed Phase 13 checkpoint.

## Decisions Already Made

- Completed launch requirements remain preserved in the full-history archive, not repeated in this active tracker.
- Monetization, CMS-style blog management, automated lifecycle nurture, and dedicated launch dashboards remain deferred v2 scope.
- Production database migrations, deploys, alias promotion, outbound sends, and payment actions require explicit approval.

## Next Actions

- Review Phase 13 results or select the next future phase.
- Preserve approval gates for deploys, production mutations, outbound sends, payment actions, and entitlement changes.

## Historical Notes

The full pre-cleanup requirements file included 54 v1 requirements mapped across launch messaging, public zine refresh, landing page, pricing, blog, App Store/mobile messaging, outreach/social, analytics/reporting, release quality, PBSC route verification, Sentry observability, and controlled refactor completion. Completed sections were compressed because they are no longer the active planning surface.
