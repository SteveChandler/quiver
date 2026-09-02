# Requirements: Quiver Go-Live Campaign

Defined: 2026-05-24
Last updated: 2026-09-01
Full pre-cleanup history: [.planning/archive/2026-05-31-doc-cleanup/REQUIREMENTS-full-history.md](archive/2026-05-31-doc-cleanup/REQUIREMENTS-full-history.md)

## Current Goal

Track active requirements for the go-live/refactor and retention planning state while preserving completed launch requirements in archive.

## Current Status

Phases 14-20 are complete. Phase 20.1 implementation and web release are complete; replacement native build 17 is valid in App Store Connect, while physical-device proof and mature retention evidence remain. Phase 21 implementation is integrated and active only for Steven/Shapan. Its production integrity report is verified; production parity and outcome validation remain gated, and broad rollout stays dark.

Earlier messaging, landing, pricing, blog, App Store, outreach, analytics, release-quality, PBSC, Sentry, and controlled-refactor work is historical for this tracker unless a future task reopens it.

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

### Durable Beach Follow And Surf-Call Retention

- **BFR-01**: Web visitor intent is represented as explicit, inferred, or unknown using safe enumerated evidence; a single water-temperature, tide, weather, or beach utility view never qualifies surfing.
- **BFR-02**: High-traffic beach, water-temperature, tide, and other utility pages deliver the original public answer before follow, signup, notification, comparison, or app-handoff actions and preserve canonical, schema, source-honesty, accessibility, and performance contracts.
- **BFR-03**: An anonymous visitor can follow a canonical beach and select relevant coastal topics using versioned, bounded, first-party local state without an account or blocking network write.
- **BFR-04**: Signed-in synchronization merges anonymous and account beach ownership idempotently without duplicate beaches/topics, silent data loss, automatic notification opt-in, or entitlement changes.
- **BFR-05**: My Coast gives followed-beach visitors a bounded, failure-tolerant view of relevant current values and defensible changes since prior visits; surf calls/rankings appear only for explicit or defensibly inferred surf intent.
- **BFR-06**: A surf-qualified web visitor can hand off the exact beach, window, source surface, and prior recommendation context through the existing universal/app-link route, App Store fallback, joined native first open, and truthful current-context resolution.
- **BFR-07**: Native Home preserves or explicitly expires the user's existing `Now`, `Best`, or `My spots` mode, prevents delayed startup context from silently replacing a settled hero, and attributes visible recommendation changes to the actual mode, location, candidate, filter, startup, or forecast cause.
- **BFR-08**: Week Scout stability is shipped enabled for all production users through the approved mobile build/configuration, retains incumbents through sub-margin revisions, replaces passed/missing/unsafe/unrideable/Skip or materially outscored incumbents, remains rollback-capable, and emits physical-production telemetry.
- **BFR-09**: An eligible native Home or Beach Detail call can be watched in one tap by extending the existing alert/watch infrastructure with known beach/window/mode/recommendation context; advanced tuning is optional and duplicate watches are idempotent.
- **BFR-10**: Watched-call delivery is limited to deduped, preference-respecting, capped, quiet-hour-aware `still on`, material-change, and clearly-better-nearby updates that open the exact context or a truthful current fallback; generic engagement and automatic post-window session prompts are not part of this retention hypothesis.
- **BFR-11**: The existing native quick-log/session flow is treated as shipped baseline behavior, not a new Phase 20.1 feature or success metric. Watched-call context may be passed into that existing flow only when a user independently chooses to log; Phase 20.1 does not add a second one-tap outcome surface, receipt, reminder, or session store.
- **BFR-12**: Team can evaluate general coastal utility, surf-qualified web conversion, existing-user web behavior, exact handoff, Home continuity, watch creation, meaningful-update eligibility/delivery/open, exact watched-call reopen, manual return, D1/D7 retention, notification quality, SEO/page-intent, and performance through reproducible segmented before/after/holdout queries with safe metadata, sample sizes, maturity rules, and test/emulator filters. Session starts/submits remain secondary diagnostics and guardrails, not the primary retention outcome.

### Multi-Forecaster Adjustment

- **MFA-01**: Seaside ingests all 10 WaveCast regions and seven additional forecast endpoints every six hours with source-specific freshness, retry, redirect, and parser-failure controls.
- **MFA-02**: Normalized issues are immutable and retain independent provider lineage, issue time, local valid date/window, region or beach, exposure, direction, period, face-height range, measurement basis, parser version, and source hash.
- **MFA-03**: Provider identity prevents mirrors or shared upstream content from counting as independent evidence; model and buoy pages never count as human forecaster votes.
- **MFA-04**: Coverage-aware authority prefers spot WaveCast, then regional WaveCast, then a validated regional caster when WaveCast has no fresh compatible issue; overlapping independent sources corroborate or block separations over 1.00 ft.
- **MFA-05**: Eligible forecasts move exactly 0.25 or 0.50 ft toward the authority range, remain unchanged inside the range or below the 0.50 ft deadband, never exceed +/-0.50 ft, and apply only at 0-168 hour horizons.
- **MFA-06**: Decisions, applications, alerts, prediction snapshots, and server-verified build receipts persist atomically without violating first-write-wins prediction history; unresolved ambiguous commits return a retriable error instead of unaudited output.
- **MFA-07**: Source ranges, narratives, URLs, attribution, parser metadata, evidence, and internal decision identities remain absent from public APIs, UI payloads, and client analytics.
- **MFA-08**: Focused and full Seaside, Quiver, database, privacy, and live-ingestion gates pass before default-on serving; the local launchd scraper is retired only after production parity is verified.

## Open Gaps

- Phase 20.1 implementation and web release are complete; replacement native build 17 is valid in App Store Connect, while physical-device proof and mature retention evidence remain.
- Current web ownership is too weak to determine whether broad utility visitors will return after following a beach.
- The surf-qualified web-to-native funnel lacks complete handoff-through-first-open/context-resolution coverage.
- Native Home continuity and Week Scout stability are in internal-TestFlight build 17 but need release verification and physical production telemetry.
- Watch and alert adoption is too small to support a retention claim.
- Native one-tap quick logging already exists and did not materially change product retention or sales; additional session-friction work is not an open Phase 20.1 hypothesis.
- Phase 21 research and implementation are integrated. Exactly-two-account allowlist proof, the production integrity report, and canary activation passed on 2026-09-01. Production parity, local-scraper retirement, and outcome validation remain open under MFA-08; broad rollout stays dark.
- Future candidates are listed in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- Wrapper-internal helper collapse remains future work outside the completed Phase 13 checkpoint.

## Decisions Already Made

- Completed launch requirements remain preserved in the full-history archive, not repeated in this active tracker.
- Web serves broad coastal utility; native remains surf-specialized.
- The durable object is a beach; temporary surf calls/windows attach to it.
- General web visitors are not treated as failed app conversions. Surf-qualified conversion is measured with its own denominator.
- Phase 20.1 extends existing favorites/follows, alert/watch, app-link, attribution, recommendation, and analytics primitives before creating anything new.
- Existing native quick log/session logging is retained as an optional downstream action but is not the Phase 20.1 retention bet, north-star metric, or justification for a new outcome prompt.
- The native retention hypothesis is that Quiver remembers the accepted call, notices a decision-relevant change, and brings the surfer back with a clear explanation.
- No generic beach native app, Planning/Decision/Execution state machine, new ML model, generic streak system, broad social feed, worldwide rollout, or localization is included in Phase 20.1.
- Monetization, CMS-style blog management, broad automated lifecycle nurture, and dedicated launch dashboards remain deferred unless the retention loop proves need and value.
- Production database migrations, deploys, aliases, production flags, outbound sends, native builds/OTA updates, entitlement changes, and payment actions require explicit approval.
- Ahrefs crawl limit remains fixed; treat Ahrefs as a sampled audit and confirm findings against GSC, Vercel, PostHog, direct template review, or code inspection.
- Session Intelligence and Phase 20.1 surfaces should pull visual direction from Brand-Vault before adding new decorative art.

## Next Actions

- Distribute the reviewed build containing native #312/#313 and the #309 deterministic two-arm release; then collect signed physical-device attribution evidence.
- Keep Phase 20.1 delivery and Phase 21 forecast adjustments limited to the exact Steven/Shapan allowlist while production evidence accrues.
- Complete Phase 20.1 Plan 20.1-06 only after the D1/D7 windows mature; do not claim retention lift from raw event counts.
- Keep #309 `INCONCLUSIVE` until both experiment arms reach at least 50 eligible viewers with complete telemetry.
- Preserve approval gates for deploys, production mutations, production flags, outbound sends, native releases, payment actions, and entitlement changes.

## Historical Notes

The full pre-cleanup requirements file included 54 v1 requirements mapped across launch messaging, public zine refresh, landing page, pricing, blog, App Store/mobile messaging, outreach/social, analytics/reporting, release quality, PBSC route verification, Sentry observability, and controlled-refactor completion. Completed sections were compressed because they are no longer the active planning surface.
