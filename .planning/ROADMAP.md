# Roadmap: Quiver Go-Live Campaign

## Current Goal

Keep the go-live campaign roadmap usable as a current planning tracker while prioritizing the measurable retention loop needed to turn broad web beach utility and native surf calls into repeated product use.

## Current Status

Status: Active
Last compressed: 2026-05-31
Full pre-cleanup history: [.planning/archive/2026-05-31-doc-cleanup/ROADMAP-full-history.md](archive/2026-05-31-doc-cleanup/ROADMAP-full-history.md)

Phases 1 through 20 are complete. Phase 13 closed the controlled refactor checkpoint tracked in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md); Phase 14 closed the Session Intelligence guardrails and template inventory. Phases 15-17 delivered the shared recommendation primitive, reusable UI components, and the limited Session Intelligence pilot surfaces. Phase 18 completed the allowlisted SEO-safe intent rollout. Phase 19 completed the forecast-accuracy trust page. Phase 20 completed exact app-link, analytics, baseline, and public QA foundations.

Phase 20.1 implementation and web release are complete; replacement native build 18 is valid in App Store Connect, while physical-device proof and mature retention evidence remain. Phase 21 implementation is integrated and serving only the exact Steven/Shapan allowlist. Its production integrity and ingestion-parity reports are verified; local-job retirement and outcome validation remain gated, and broad rollout stays dark.

## Active Requirements

- Preserve Phase 13 validation evidence in `docs/refactor-roadmap.md`.
- Preserve Phase 14 Session Intelligence inventory evidence in `docs/session-intelligence/phase-14-template-inventory.md`.
- Execute Phase 20.1 against BFR-01 through BFR-12 before broad worldwide/localization or major new engagement surfaces.
- Do not start broad cleanup, deletion, or risky route/API rewrites under this roadmap.
- Preserve launch, pricing, App Store, outreach, and Sentry history in archive unless a future phase needs exact detail.

## Open Gaps

- The web has broad one-off coastal utility traffic but almost no durable beach ownership, intent qualification, or repeat-use destination.
- Generic web traffic cannot be treated as native product health; the surf-qualified web-to-native funnel is not yet measurable end to end.
- Native Home can change mode or recommendation without enough continuity, and the all-user Week Scout stability rollout remains a required production/device proof.
- Watch/alert and session feedback adoption is too small to show that either currently drives return behavior.
- Phase 20 production web verification passed after approved deploy. Native `/app/spot/:slug` routing is simulator-verified; signed HTTPS handoff and App Store first-open context recovery remain device validation lanes in Phase 20.1.
- Phase 21 exactly-two-account allowlist, production integrity proof, canary activation, and production ingestion parity passed on 2026-09-01. Local-scraper retirement and outcome validation remain gated under MFA-08; broad rollout stays dark.
- Future refactor candidates are listed in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- Public go-live deployment/alias promotion and any outbound launch actions remain approval-gated.

## Decisions Already Made

- Web is a broad coastal utility and audience-qualification surface; native remains the dedicated surfing product.
- The durable cross-surface object is a beach. A surf recommendation/window is temporary context attached to that beach.
- A water-temperature, tide, weather, or beach-page view alone never qualifies a visitor as a surfer.
- The universal web ownership action is `Follow this beach`; the qualified surf handoff is `Open this exact call in Quiver`; the native ownership action is `Watch this call`.
- Native keeps the existing `Now`, `Best`, and `My spots` model. Phase 20.1 does not introduce Planning, Decision, or Execution stages.
- Week Scout stability must be enabled in the production client for all users after approved release and verified with physical-device telemetry.
- The launch campaign objective is iOS downloads from qualified demand, not generic web awareness.
- Public copy teaches the Quiver loop: forecast, check, watch/log, improve.
- Public pricing stays waitlist-safe until payment and entitlement release gates are proven.
- Brand-Vault remains the first source for launch visuals and campaign assets.
- Remaining production `@/lib/api-utils` imports outside wrapper internals were closed in Phase 13.
- Outbound sends, posts, DMs, tracker writes, Play Console actions, entitlement grants, production mutations, deploys, alias promotion, and payment changes require exact user approval.

## Next Actions

- Accept the internal TestFlight invitation, install valid build 18, complete signed physical-device proof for #312/#313, and begin #309 cohort collection.
- Use the Phase 20.1 validation scorecard and holdouts after D1/D7 maturity to decide expansion, continued pilot, revision, or rollback. Do not claim retention lift from raw event counts.
- Keep Phase 21 limited to Steven/Shapan while local-job retirement and outcome validation continue; broad rollout stays dark.
- Keep deploy, production mutation, outbound send, payment, entitlement, production flag, and native publication actions approval-gated.

## Session Intelligence v1 Addendum

This addendum is additive to the completed launch and refactor phases and must not replace, renumber, or rewrite previous phases.

Shared guardrails for Phases 14-20.1:

- Use GSD: ship small, safe, measurable slices.
- Do not overhaul the whole site or mass-change metadata/templates before a pilot proves value.
- Do not create duplicate thin SEO pages, retarget water-temp pages as surf reports, hide useful answers behind sign-in, add unsupported data-source claims, introduce a new ML model, or change canonical URLs.
- Ahrefs remains a sampled audit input. Do not pay to increase the crawl cap; confirm findings against GSC, Vercel, PostHog, direct template review, or code inspection.

### Phase 14: Guardrails, Data Inventory, And Template Safety

**Goal:** Make sure Session Intelligence can be added safely without hurting existing SEO pages, app CTAs, or page performance.
**Mode:** mvp
**Requirements**: SI-01, SI-07
**Depends on:** Phase 13
**UI hint:** no
**Success Criteria** (what must be TRUE):

  1. A guardrail note exists for Ahrefs sampling, fixed crawl cap, and required confirmation sources.
  2. Eligible templates are inventoried: spot, regional forecast, homepage, city/region, best-time, beginner, longboard, dawn patrol, sunset session, tide-window, less-crowded, water-temp, tide, and forecast-accuracy pages.
  3. Data availability is clear by template: forecast horizon, tide, water-temp, buoy, cam, user reports, local spot intel, and app CTA/deep-link support.
  4. Slow template risks are profiled or avoided before heavier UI is added, including `/for-surf-schools`, tide pages, and water-temp pages.
  5. Structured data is sampled on one tide page, one water-temp page, one US spot page, and one non-US/Baja spot page.
  6. Existing canonical URLs are unchanged.

**Plans:** 4/4 plans complete

Plans:

- [x] [14-01: Create Session Intelligence Guardrail And Template Inventory](phases/14-session-intelligence-addendum/14-01-PLAN.md)
- [x] [14-02: Map Data Availability And Source Claims By Template](phases/14-session-intelligence-addendum/14-02-PLAN.md)
- [x] [14-03: Document Performance And Structured Data Safety Checks](phases/14-session-intelligence-addendum/14-03-PLAN.md)
- [x] [14-04: Verify App-Link, Deeplink, Analytics, And Phase Evidence](phases/14-session-intelligence-addendum/14-04-PLAN.md)

### Phase 15: Shared Recommendation Primitive

**Goal:** Create the shared `SurfWindowRecommendation` model and deterministic recommendation helper that returns the top 3 surf windows from existing forecast rows.
**Mode:** mvp
**Requirements**: SI-02, SI-07
**Depends on:** Phase 14
**UI hint:** no
**Success Criteria** (what must be TRUE):

  1. The helper returns top 3 windows for a beach or region with forecast rows.
  2. It prefers 14 days when available and falls back to 7 days when only 7 days exists.
  3. It uses deterministic v1 scoring only; no new ML model is introduced.
  4. Scores use only surf-relevant inputs: wave height range, swell period, swell direction fit when available, wind direction/strength, tide phase/trend, skill fit, board fit, local spot intel when available, and confidence/buoy alignment when available.
  5. Each recommendation includes score, verdict, headline, wave/wind/tide summary, best-for tags, reasons, confidence, app deep link, universal link, and canonical web URL.
  6. Missing tide, buoy, cam, or user-report data is handled gracefully and never displayed as an available source.
  7. Unit tests cover normal scoring, no tide data, no buoy data, sparse rows, only 7-day horizon, low-confidence output, and no recommendation available.

**Plans:** 4/4 plans complete

Plans:

- [ ] [15-01: Add Shared Session Intelligence Recommendation Model](phases/15-shared-recommendation-primitive/15-01-PLAN.md)
- [ ] [15-02: Add Deterministic Top Window Selection](phases/15-shared-recommendation-primitive/15-02-PLAN.md)
- [ ] [15-03: Build Shared Surf Window Recommendation Helper](phases/15-shared-recommendation-primitive/15-03-PLAN.md)
- [ ] [15-04: Add Source Flags, Links, And Final Verification](phases/15-shared-recommendation-primitive/15-04-PLAN.md)

### Phase 16: Reusable Session Intelligence UI Components

**Goal:** Build reusable UI once, then drop it into existing surfaces.
**Mode:** mvp
**Requirements**: SI-03, SI-07
**Depends on:** Phase 15
**UI hint:** yes
**Success Criteria** (what must be TRUE):

  1. `BestSurfWindows` renders 1-3 recommendations with local time, score, verdict, wave/wind/tide summary, best-for tags, confidence badge, `Open this window in Quiver`, and `Why this call?`.
  2. `WhyThisCall` exposes positives, watchouts, confidence, and source chips in an accessible mobile/desktop drawer, modal, or accordion.
  3. `SourceConfidenceBadge` shows supported confidence/source labels without inventing unavailable sources.
  4. `AppDeepLinkCTA` generates exact beach/window deep links and universal links, with a safe App Store fallback if app-link config is unavailable.
  5. Components render at 360px, 390px, 412px, tablet, and desktop.
  6. Components work with missing tide, buoy, cam, or user-report data.
  7. Component tests exist for `BestSurfWindows` and `WhyThisCall`.

**Plans:** 4/4 plans complete

Plans:

- [x] [16-01: Add Source Badge And Deep-Link CTA](phases/16-reusable-session-intelligence-ui-components/16-01-PLAN.md) (completed 2026-06-02)
- [x] [16-02: Add Accessible WhyThisCall Disclosure](phases/16-reusable-session-intelligence-ui-components/16-02-PLAN.md) (completed 2026-06-02)
- [x] [16-03: Add BestSurfWindows Composition Component](phases/16-reusable-session-intelligence-ui-components/16-03-PLAN.md) (completed 2026-06-02)
- [x] [16-04: Add Dev Preview And Final Responsive Verification](phases/16-reusable-session-intelligence-ui-components/16-04-PLAN.md) (completed 2026-06-02)

### Phase 17: Limited Session Intelligence Pilot

**Goal:** Prove Session Intelligence on a small surface before rollout.
**Mode:** mvp
**Requirements**: SI-04, SI-07
**Depends on:** Phase 16
**UI hint:** yes
**Success Criteria** (what must be TRUE):

  1. One major spot page shows the top 3 upcoming surf windows.
  2. One regional forecast page shows `Best windows this week` while preserving the current outlook.
  3. The homepage includes a compact `Find your next best surf window` module that works without user location.
  4. Each pilot window explains why through the shared `WhyThisCall` format.
  5. Existing spot/forecast content is not removed.
  6. Existing app CTAs still work.
  7. No pilot route becomes noticeably slower.

**Plans:** 5/5 plans executed

Plans:

- [x] [17-01: Add Pilot Recommendation Adapters](phases/17-limited-session-intelligence-pilot/17-01-PLAN.md) (completed 2026-06-02)
- [x] [17-02: Add Spot Page Pilot](phases/17-limited-session-intelligence-pilot/17-02-PLAN.md) (completed 2026-06-02)
- [x] [17-03: Add Regional Forecast Pilot](phases/17-limited-session-intelligence-pilot/17-03-PLAN.md) (completed 2026-06-02)
- [x] [17-04: Add Homepage Compact Module](phases/17-limited-session-intelligence-pilot/17-04-PLAN.md) (completed 2026-06-02)
- [x] [17-05: Final Pilot QA And Evidence](phases/17-limited-session-intelligence-pilot/17-05-PLAN.md) (completed 2026-06-02)

### Phase 18: SEO-Safe Intent Rollout

**Goal:** Improve SEO and click-around by adding surfer decision value after the pilot is validated, not by chasing keywords blindly.
**Mode:** mvp
**Requirements**: SI-05, SI-07
**Depends on:** Phase 17
**UI hint:** yes
**Success Criteria** (what must be TRUE):

  1. Rollout starts only after pilot validation.
  2. Page intent remains clean on longboard, beginner, dawn patrol, sunset, tide-window, less-crowded, city best-time, selected water-temp, selected tide, and selected high-impression spot pages.
  3. Basic useful answers remain visible without sign-in; alerts or personalization may be gated.
  4. Selected water-temp pages add surfer decision value without being retargeted as surf-report pages.
  5. Malibu First Point is enriched without cannibalizing the dedicated surf-report route.
  6. Selected best-time pages keep best-time intent and link to live conditions where appropriate.
  7. Contextual internal links connect spot, tide, water-temp, dawn patrol, longboard/beginner, forecast, and exact spot/window pages.
  8. No canonical changes or unsupported data-source claims ship.
  9. CTR and multi-page behavior are measured before/after, and sister pages do not lose impressions through cannibalization.

**Plans:** 5/5 plans executed

Plans:

- [x] [18-01: Add Rollout Guards And Eligibility Policy](phases/18-seo-safe-intent-rollout/18-01-PLAN.md) (completed 2026-06-02)
- [x] [18-02: Make Generic And Beginner Intent Answers Public](phases/18-seo-safe-intent-rollout/18-02-PLAN.md) (completed 2026-06-02)
- [x] [18-03: Add Dedicated Utility Intent Handoffs](phases/18-seo-safe-intent-rollout/18-03-PLAN.md) (completed 2026-06-02)
- [x] [18-04: Enrich Best-Time Pages And Malibu Spot Safely](phases/18-seo-safe-intent-rollout/18-04-PLAN.md) (completed 2026-06-02)
- [x] [18-05: Final SEO Rollout QA And Measurement Evidence](phases/18-seo-safe-intent-rollout/18-05-PLAN.md) (completed 2026-06-02)

### Phase 19: Forecast Accuracy Trust Page

**Goal:** Upgrade `/forecast-accuracy` into a visible proof/trust page.
**Mode:** mvp
**Requirements**: SI-06, SI-07
**Depends on:** Phase 18
**UI hint:** yes
**Success Criteria** (what must be TRUE):

  1. If live metrics exist, the page renders beach, Quiver MAE, NOAA baseline MAE, improvement percentage, validated-pair count, last updated, and confidence.
  2. If metrics are not ready, the page renders graceful building/in-progress rows and does not claim accuracy improvements.
  3. The page explains how the score works, data sources used, when Quiver trusts buoy/observed data, known limits, and last updated.
  4. Confidence/source language matches the recommendation UI.
  5. `/forecast-accuracy` never looks empty.

**Plans:** 4 plans

Plans:

- [x] [19-01: Build The Accuracy Report And Claim Policy](phases/19-forecast-accuracy-trust-page/19-01-PLAN.md) (completed 2026-06-02)
- [x] [19-02: Render The Non-Empty Trust Page](phases/19-forecast-accuracy-trust-page/19-02-PLAN.md) (completed 2026-06-02)
- [x] [19-03: Tighten Methodology, Limits, And SEO Copy](phases/19-forecast-accuracy-trust-page/19-03-PLAN.md) (completed 2026-06-02)
- [x] [19-04: Add Guest E2E And Final Verification](phases/19-forecast-accuracy-trust-page/19-04-PLAN.md) (completed 2026-06-02)

### Phase 20: Domain, App Links, Analytics, And QA

**Goal:** Make web-to-native handoff measurable and reliable while validating the full Session Intelligence rollout.
**Mode:** mvp
**Requirements**: SI-07
**Depends on:** Phase 19
**UI hint:** yes
**Success Criteria** (what must be TRUE):

  1. Canonical web domain `www.quiversurf.app` is verified.
  2. `apple-app-site-association`, `assetlinks.json`, universal links for `/app/spot/:slug?window=:id`, and App Store fallback are validated.
  3. No placeholder team IDs or certificate fingerprints ship.
  4. Analytics exist for `surf_window_impression`, `surf_window_click`, `why_this_call_opened`, `app_deeplink_clicked`, `forecast_accuracy_table_viewed`, `save_alert_clicked`, and `seo_intent_page_window_clicked`.
  5. GSC CTR, GSC average position, GSC impressions, multi-page rate, app CTA clicks, app deep-link conversion, bounce rate, and route performance are measured before/after.
  6. QA covers mobile, tablet, desktop, missing-source states, app-not-installed fallback, canonical tags, schema, and slow-route regression.

**Plans:** 5/5 plans executed

Plans:

- [x] [20-01: Align App-Link Route, Manifests, And Fallback](phases/20-app-links-analytics-and-qa/20-01-PLAN.md) (completed 2026-06-02)
- [x] [20-02: Add Session Intelligence Analytics Events](phases/20-app-links-analytics-and-qa/20-02-PLAN.md) (completed 2026-06-02)
- [x] [20-03: Capture Before Baselines And Measurement Protocol](phases/20-app-links-analytics-and-qa/20-03-PLAN.md) (completed 2026-06-02)
- [x] [20-04: Expand Public QA Matrix](phases/20-app-links-analytics-and-qa/20-04-PLAN.md) (completed 2026-06-02)
- [x] [20-05: Final Live Verification And Closeout](phases/20-app-links-analytics-and-qa/20-05-PLAN.md) (completed 2026-06-02; simulator native evidence accepted)

### Phase 20.1: Durable Beach Follow And Surf-Call Retention Loop

**Goal:** Let broad web visitors follow beaches without being treated as surfers, qualify surf intent conservatively, preserve exact surf context into native, and turn native Home into a trustworthy watch -> useful update -> lightweight outcome loop.
**Mode:** standard
**Requirements**: BFR-01, BFR-02, BFR-03, BFR-04, BFR-05, BFR-06, BFR-07, BFR-08, BFR-09, BFR-10, BFR-11, BFR-12
**Depends on:** Phase 20
**UI hint:** yes
**Context:** [20.1-CONTEXT.md](phases/20.1-durable-beach-follow-and-surf-call-retention-loop/20.1-CONTEXT.md)
**Research:** [20.1-RESEARCH.md](phases/20.1-durable-beach-follow-and-surf-call-retention-loop/20.1-RESEARCH.md)
**Validation:** [20.1-VALIDATION.md](phases/20.1-durable-beach-follow-and-surf-call-retention-loop/20.1-VALIDATION.md)
**Success Criteria** (what must be TRUE):

  1. Selected high-traffic beach and water-temperature pages keep the original answer public, preserve intent/canonical/schema/performance, and offer `Follow this beach` without requiring an account.
  2. Anonymous beach follows are durable, topic-aware, bounded, corruption-safe, and merge into signed-in ownership idempotently without duplicate or lost beaches.
  3. Web intent is explicit, inferred, or unknown; a single water-temperature or beach utility view never qualifies surfing.
  4. My Coast shows followed-beach changes relevant to selected topics, with surf rankings/calls only for defensibly surf-qualified visitors.
  5. Surf-qualified handoffs preserve exact beach/window/source context through installed app, App Store fallback, first-open join, and truthful native resolution.
  6. Native preserves or explicitly expires `Now`, `Best`, and `My spots`; it explains changes by actual mode, location, candidate, filter, startup, or forecast cause.
  7. Week Scout stability is enabled for all production users after approved release, retains small revisions, replaces invalid/material incumbents, and emits verified telemetry.
  8. `Watch this call` creates a useful monitor in one tap by reusing existing alert infrastructure; advanced tuning remains optional.
  9. Notifications are limited to still-on, material-change, better-nearby, and post-window feedback categories and open exact context.
  10. A watched window can be rated 1-5 in one tap with known context prefilled, the full session log remains optional, and the learning receipt describes only actual persisted effects.
  11. Segmented before/after/holdout evidence shows whether follow, exact handoff, watching, updates, and outcomes improve useful repeat behavior with sample sizes and maturity rules.
  12. Web SEO/performance/page-intent, notification quality, attribution, Home trust, and existing session-log guardrails pass before broader rollout.

**Plans:** 6 plans

Plans:

**Wave 1**

- [x] [20.1-01: Audit Existing Ownership, Intent, Handoff, Watch, And Feedback Primitives](phases/20.1-durable-beach-follow-and-surf-call-retention-loop/20.1-01-PLAN.md)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] [20.1-02: Define Beach Follow, Intent, Handoff, Watch, Outcome, And Measurement Contracts](phases/20.1-durable-beach-follow-and-surf-call-retention-loop/20.1-02-PLAN.md)

**Wave 3** *(blocked on Wave 2 completion; plans may execute in parallel)*

- [x] [20.1-03: Ship Follow This Beach And My Coast On Selected Web Utility Surfaces](phases/20.1-durable-beach-follow-and-surf-call-retention-loop/20.1-03-PLAN.md) (implemented, then withdrawn and removed before release)
- [x] [20.1-04: Preserve Exact Beach And Surf-Call Context Through Web-To-Native Handoff](phases/20.1-durable-beach-follow-and-surf-call-retention-loop/20.1-04-PLAN.md)
- [x] [20.1-05: Ship Native Home Continuity, All-User Stability, And One-Tap Watch This Call](phases/20.1-durable-beach-follow-and-surf-call-retention-loop/20.1-05-PLAN.md) (implemented; release/device evidence remains)

**Wave 4** *(blocked on Waves 1-3 completion)*

- [ ] [20.1-06: Add One-Tap Outcome Feedback, Learning Receipt, And Release Evidence](phases/20.1-durable-beach-follow-and-surf-call-retention-loop/20.1-06-PLAN.md) (Tasks 1-2 complete; release/device and cohort gates remain)

## Historical Notes

Completed phases are summarized here to keep this file small:

- Phase 1 defined the public launch message system.
- Phase 01.1 refreshed selected forecast/learn pages with shared zine primitives and Brand-Vault sticker assets.
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
- Phase 13 completed controlled refactor import cleanup, wrapper compatibility ownership, and final local validation.

### Phase 21: Multi-Forecaster Forecast Adjustment and Production Ingestion

**Goal:** Replace the local 17-endpoint forecast scraper with reliable production Seaside ingestion and use normalized human forecasts to apply bounded, coverage-aware adjustments to Quiver's displayed face heights.
**Mode:** standard
**Requirements**: MFA-01, MFA-02, MFA-03, MFA-04, MFA-05, MFA-06, MFA-07, MFA-08
**Depends on:** Phase 20.1
**UI hint:** no
**Success Criteria** (what must be TRUE):

  1. Seaside ingests all 10 WaveCast regions and seven additional forecast endpoints every six hours with source-specific parsers and immutable issue identity.
  2. Normalized issues retain issue time, local valid window, region or beach, exposure, direction, period, breaking-face-height range, measurement basis, parser version, source hash, and independent provider lineage.
  3. WaveCast leads covered regions; validated regional casters can lead uncovered regions; mirrors count once; model and buoy evidence never count as human consensus.
  4. Independent overlapping casters corroborate the primary range or block the adjustment when nearest-edge range separation exceeds 1.00 ft.
  5. Eligible adjustments move exactly 0.25 or 0.50 ft toward the selected range, never exceed ±0.50 ft, do not stack session-feedback adjustments, and apply only at forecast horizons from 0 through 168 hours.
  6. Decisions, applications, alerts, prediction snapshots, and server-verified build receipts persist atomically; unresolved ambiguous commits return a retriable error rather than serving unaudited output.
  7. Private forecaster ranges, narratives, URLs, attribution, evidence, and internal identifiers never appear in public APIs, UI payloads, or client analytics.
  8. Focused and full Seaside, Quiver, database, privacy, and live-ingestion verification passes before default-on serving, and the local launchd job is retired only after production parity is verified.

**Plans:** 4 implemented/integrated; 1 partial rollout plan

Plans:

- [x] 21-01 — Production Multi-Source Ingestion
- [x] 21-02 — Immutable Trusted-Forecast Storage
- [x] 21-03 — Coverage-Aware Decision Engine
- [x] 21-04 — Forecast Builder Integration and Privacy
- [ ] 21-05 — Verification and Default-On Rollout (read-only verification complete; canary activation and outcome validation remain)
