# Requirements: Quiver Go-Live Campaign

Defined: 2026-05-24
Last compressed: 2026-05-31
Full pre-cleanup history: [.planning/archive/2026-05-31-doc-cleanup/REQUIREMENTS-full-history.md](archive/2026-05-31-doc-cleanup/REQUIREMENTS-full-history.md)

## Current Goal

Track only the active requirements for the current go-live/refactor planning state while preserving completed launch requirements in archive.

## Current Status

The active roadmap focus is Phase 13: controlled refactor completion. Earlier messaging, landing, pricing, blog, App Store, outreach, analytics, release-quality, PBSC, and Sentry work is historical for this tracker unless a future task reopens it.

## Active Requirements

- **REF-01**: Remaining production `@/lib/api-utils` imports outside wrapper internals are migrated or intentionally retained with documented rationale.
- **REF-02**: API wrapper compatibility exports and wrapper-internal dependencies have clear ownership, with no `app/api/**/route.ts` regression to direct legacy helper imports.
- **REF-03**: Each refactor slice is behavior-preserving, PR-sized, and backed by focused characterization, source-guard, or unit coverage before risky edits.
- **REF-04**: [docs/refactor-roadmap.md](../docs/refactor-roadmap.md) stays current after each completed slice with progress, validation status, current risks, open questions, rollback, and the next recommended slice.
- **REF-05**: Refactor validation includes targeted Jest, scoped ESLint, `yarn typecheck`, and preview build when runtime, route, middleware, or build-sensitive surfaces are touched.

## Open Gaps

- Phase 13 has no detailed phase plan yet.
- Remaining import cleanup targets are listed in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- Wrapper-internal ownership cleanup is still open after route-level migration.

## Decisions Already Made

- Completed launch requirements remain preserved in the full-history archive, not repeated in this active tracker.
- Monetization, CMS-style blog management, automated lifecycle nurture, and dedicated launch dashboards remain deferred v2 scope.
- Production database migrations, deploys, alias promotion, outbound sends, and payment actions require explicit approval.

## Next Actions

- Plan and execute the next controlled refactor slice from [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- After each completed slice, update both this file if requirements change and the refactor roadmap with validation evidence.

## Historical Notes

The full pre-cleanup requirements file included 54 v1 requirements mapped across launch messaging, public zine refresh, landing page, pricing, blog, App Store/mobile messaging, outreach/social, analytics/reporting, release quality, PBSC route verification, Sentry observability, and controlled refactor completion. Completed sections were compressed because they are no longer the active planning surface.
