---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-08-24"
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 42
  completed_plans: 31
  percent: 74
---

# Project State

## Current Goal

Turn broad web beach utility and native surf calls into a measurable repeat-use loop without assuming every web visitor is a surfer or introducing duplicate ownership, alert, routing, or session systems.

## Current Status

Phase: 20.1
Plan: 20.1-01
Status: Planned — ready to execute
Full pre-cleanup history: [.planning/archive/2026-05-31-doc-cleanup/STATE-full-history.md](archive/2026-05-31-doc-cleanup/STATE-full-history.md)

Progress: 20 of 22 roadmap phases complete. Phase 20.1 execution progress: 0 of 6 planned plans complete, 0%. Phase 21 remains planned with 0 of 5 plans complete and is sequenced after Phase 20.1.

## Active Requirements

- Execute BFR-01 through BFR-12 from `.planning/REQUIREMENTS.md`.
- Preserve Phase 13 controlled refactor evidence in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- Preserve Phase 20 app-link, attribution, baseline, and QA foundations rather than creating a second handoff system.
- Preserve approval gates for deploys, production mutations, production flags, outbound sends, native releases, payment actions, and entitlement changes.
- Update planning state only with durable decisions, current gaps, validation outcomes, and next actions.

## Open Gaps

- The web receives broad coastal utility traffic but has almost no durable beach ownership, intent qualification, or owned return destination.
- Many web visitors may not be surfers; a surf-qualified denominator and exact handoff-through-first-open funnel do not yet exist.
- Native Home can silently reset or rerank context, and the all-user Week Scout stability rollout requires current build/configuration and physical telemetry proof.
- Alert/watch and session feedback adoption is too low to establish that either currently drives retention.
- Phase 20.1 has context, research, validation, and six executable plans, but no implementation or production/device evidence yet.
- Native `/app/spot/:slug` routing is simulator-verified through the app scheme. Full HTTPS universal-link and App Store first-open context recovery remain signed physical validation lanes in Phase 20.1.
- Phase 21 is fully researched/planned but queued until Phase 20.1 has an explicit evidence-backed rollout disposition.
- Phase 13 is complete. Future refactor candidates are listed in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- Public launch deploy/alias status may have changed outside the repo and must be checked live before public claims.

## Decisions Already Made

- Web is a broad coastal utility and audience-qualification surface; native remains the dedicated surfing product.
- The durable object is a beach. A surf recommendation/window is temporary context attached to that beach.
- The universal web action is `Follow this beach`; the surf-qualified handoff is `Open this exact call in Quiver`; the native action is `Watch this call`.
- A water-temperature, tide, weather, or beach-page view alone never qualifies a visitor as a surfer.
- Web utility retention and surf-qualified web-to-native activation are measured separately from native product retention.
- Native keeps `Now`, `Best`, and `My spots`; Phase 20.1 does not add Planning, Decision, or Execution stages.
- Week Scout stability must be enabled for all production users after approved release, with rollback, device, and PostHog evidence.
- Home changes must identify their real cause: mode, location, candidate set, filter, startup refinement, or forecast shift.
- The first watched-call action reuses existing alert infrastructure; the first outcome reuses existing recommendation/session feedback and can be completed without a full log.
- No generic beach native app, new ML model, generic streak system, broad social feed, worldwide rollout, or localization is included in Phase 20.1.
- Launch objective remains iOS downloads from qualified demand, not generic web awareness.
- Product story is forecast -> check -> watch/log -> improve.
- Founding access remains waitlist-safe until RevenueCat Web Billing and entitlement sync are proven.
- Brand-Vault is the source of truth for public launch visuals.
- Session Intelligence UI should use Brand-Vault visual assets, especially the mirrored sticker-sheet assets in `public/images/quiver-stickers`, before inventing new decorative art.
- Reddit remains comment-first unless explicitly reopened.
- Launch reporting uses existing event primitives extended with safe BFR events.
- Sentry cron monitor ownership and critical alert routing were completed in Phase 12.
- Remaining production `@/lib/api-utils` imports outside wrapper internals were closed in Phase 13.

## Next Actions

- Execute Phase 20.1 Plan 20.1-01 to publish the cross-repository reuse audit and locked implementation patterns.
- Execute Plan 20.1-02 to define beach ownership, intent, exact-handoff, watch, outcome, analytics, and experiment contracts.
- After the contract wave passes, execute 20.1-03 web ownership, 20.1-04 exact handoff, and 20.1-05 native continuity/watch in parallel where file ownership permits.
- Complete 20.1-06 with one-tap outcome feedback, approved physical-device/production validation, segmented before/after/holdout analysis, and a requirement-by-requirement rollout decision.
- Resume Phase 21 only after Phase 20.1 is verified as expand, continued pilot, revise, or roll back.
- Preserve approval gates for deployment, schema mutation, production flags, outbound sends, native publication, payment, and entitlement actions.

## Accumulated Context

### Roadmap Evolution

- Phase 20.1 added on 2026-08-24 as an urgent cross-repository insertion after Phase 20: durable anonymous beach follow, My Coast, conservative intent qualification, exact surf handoff, Home continuity, all-user Week Scout stability, one-tap watched calls, bounded updates, lightweight outcomes, and causal/guardrail evidence.
- Phase 21 added: Multi-Forecaster Forecast Adjustment and Production Ingestion, coordinated by Quiver with Seaside as the production-ingestion workstream; it now follows Phase 20.1.
- Phases 14-20 added the Session Intelligence v1 addendum.
- Phase 14 completed documentation-only guardrails, template inventory, data availability, risk/schema checks, app-link/deeplink checks, and analytics validation.
- Phase 15 planned the recommendation model, top-window selection, shared helper, source flags, links, and verification.
- Phase 16 completed reusable Session Intelligence UI components, dev-only preview route, component tests, and responsive guest Playwright coverage.
- Phase 17 completed the limited pilot on spot, regional forecast, and authenticated homepage surfaces. Focused unit/guest/auth checks passed; the full auth Playwright bundle remained locally unstable under three workers because regional forecast and homepage fetches timed out under parallel load.
- Phase 18 completed rollout eligibility/source guards, generic/beginner public answers, utility handoffs, best-time plus Malibu enrichment, guest browser QA, and measurement docs.
- Phase 19 completed the forecast-accuracy trust page, including live/building states, claim gating, methodology/limits, Dataset structured data, and guest browser coverage.
- Phase 20 plan 20-01 completed app-link route alignment, AASA/assetlinks handling, exact `/app/spot/{slug}?window=...` links, and noindex fallback.
- Phase 20 plan 20-02 completed seven Session Intelligence measurement events, anonymous allowance, zero implicit-preference weighting, additive event constraints, and production allowlist migration verification.
- Phase 20 plan 20-03 documented GSC, PostHog, Vercel, app CTA, deep-link, multi-page, bounce, route-performance, and after-check baselines without claiming lift.
- Phase 20 plan 20-04 completed public QA and guest browser coverage for app-link fallback, sampled Session Intelligence surfaces, canonical/schema checks, and required viewports.
- Phase 20 plan 20-05 closed the live AASA and `/app/spot/*` production blocker after approved deploy. Simulator native app-scheme evidence was accepted; signed iOS HTTPS handoff remained deferred.

## Historical Notes

The previous state file held detailed accumulated decisions from Phases 1-12. That history is archived because it is useful for audit but too large for future Codex sessions to load by default. Current sessions should read this file, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, the Phase 20.1 folder, and [docs/refactor-roadmap.md](../docs/refactor-roadmap.md) first.
