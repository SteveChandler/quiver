# Roadmap: Quiver Go-Live Campaign

## Current Goal

Keep the go-live campaign roadmap usable as a current planning tracker without loading completed phase narratives by default.

## Current Status

Status: Active
Last compressed: 2026-05-31
Full pre-cleanup history: [.planning/archive/2026-05-31-doc-cleanup/ROADMAP-full-history.md](archive/2026-05-31-doc-cleanup/ROADMAP-full-history.md)

Phases 1 through 12 are complete. Phase 13 is ready and should continue the controlled refactor work tracked in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).

## Active Requirements

- Phase 13 work must remain behavior-preserving, PR-sized, and test-backed.
- Keep `docs/refactor-roadmap.md` current after each completed refactor slice.
- Do not start broad cleanup, deletion, or risky route/API rewrites under this roadmap.
- Preserve launch, pricing, App Store, outreach, and Sentry history in archive unless a future phase needs exact detail.

## Open Gaps

- Phase 13 planning is still pending.
- Remaining controlled-refactor imports are listed in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- Public go-live deployment/alias promotion and any outbound launch actions remain approval-gated.

## Decisions Already Made

- The launch campaign objective is iOS downloads, not generic web awareness.
- Public copy teaches the Quiver loop: forecast, check, log, improve.
- Public pricing stays waitlist-safe until payment and entitlement release gates are proven.
- Brand-Vault remains the first source for launch visuals and campaign assets.
- Outbound sends, posts, DMs, tracker writes, Play Console actions, entitlement grants, production mutations, deploys, alias promotion, and payment changes require exact user approval.

## Next Actions

- Plan Phase 13 around the next safe refactor slice.
- Start with Slice 82 from [docs/refactor-roadmap.md](../docs/refactor-roadmap.md): `app/session/confirm/route.ts` UUID validation import cleanup.
- Run the scoped validation listed in the refactor roadmap before marking any slice complete.

## Historical Notes

Completed phases are summarized here to keep this file small:

- Phase 1 defined the public launch message system.
- Phase 01.1 refreshed `/forecast/santa-cruz`, `/learn`, and learn child pages with shared zine primitives and Brand-Vault sticker assets.
- Phase 2 verified founding-offer and entitlement truth, keeping public pricing waitlist-safe.
- Phase 3 updated active landing copy, iOS CTA language/events, and landing visuals.
- Phase 4 shipped the waitlist-safe `/pricing` route and landing integration.
- Phase 5 prepared the finite blog platform for multiple launch posts.
- Phase 6 added founder-note and dawn-patrol launch blog content.
- Phase 7 aligned App Store/TestFlight status and iOS launch assets.
- Phase 8 produced approval-gated outreach and social kit drafts.
- Phase 9 added campaign analytics/reporting paths using existing event primitives.
- Phase 10 completed local go-live verification and documented remaining deploy approval gates.
- Phase 11 completed PBSC event route deploy and QR verification work.
- Phase 12 completed Sentry observability rollout work.
