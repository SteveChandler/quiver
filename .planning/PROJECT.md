# Quiver Go-Live Campaign

## Current Goal

Drive iOS downloads by making the Quiver loop obvious and compelling: forecast, check, log, and improve.

## Current Status

Status: Active
Last compressed: 2026-05-31
Full pre-cleanup history: [.planning/archive/2026-05-31-doc-cleanup/PROJECT-full-history.md](archive/2026-05-31-doc-cleanup/PROJECT-full-history.md)

The public launch packaging work is complete through Sentry observability rollout. The controlled refactor checkpoint in Phase 13 is complete and tracked in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).

## Active Requirements

- Keep current public launch copy truthful to shipped behavior and live App Store/payment state.
- Keep pricing/founding copy waitlist-safe until purchase and entitlement release gates are proven.
- Use Brand-Vault as the first source for launch visuals and campaign assets.
- Keep all outbound, deploy, production mutation, and payment actions approval-gated.
- Preserve Phase 13 validation evidence and approval gates.

## Open Gaps

- Public pay scale and lifetime purchase details remain blocked until payment release gates are verified.
- Production deploy/alias promotion and outbound launch actions remain explicit-approval items.
- Future candidates include wrapper-internal helper collapse and the documented `social_share` taxonomy gap.

## Decisions Already Made

- Primary conversion goal is iOS downloads.
- Core story is one surf call plus forecast -> check -> log -> improve.
- Founder story supports the product loop rather than replacing it.
- Public pre-verification offer is a founding access waitlist.
- Existing beta/current users are protected from auto-billing and accidental promo-access loss.
- Active landing work belongs in the current `/` route path, not older inactive landing components.
- Launch reporting uses existing event primitives rather than new launch-only event names.
- App Store/TestFlight truth is a live report input and must be checked before public claims.
- Public go-live requires an approved deploy after local verification.
- Remaining production `@/lib/api-utils` imports outside wrapper internals were closed in Phase 13.

## Next Actions

- Review Phase 13 results or select the next future phase.
- Keep this project summary updated only when the campaign objective, constraints, or approval gates change.

## Historical Notes

Completed launch work covered public zine surfaces, landing-page loop copy and CTA/event normalization, waitlist-safe pricing, finite blog expansion, launch blog content, iOS App Store/TestFlight messaging, Brand-Vault-first launch assets, approval-gated outreach/social kits, campaign analytics/reporting, go-live verification, PBSC QR/event route work, and Sentry observability rollout. Full per-phase details are archived in the pre-cleanup history file.
