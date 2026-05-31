# Roadmap: Quiver Go-Live Campaign

## Overview

This roadmap packages Quiver for public go-live without rebuilding the core product. The work starts by locking the launch message and current product/payment truth, then ships the conversion surfaces visitors will actually see: landing, founding offer pricing, blog expansion, iOS/App Store messaging, outreach/social assets, analytics, and final release validation.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions marked with INSERTED

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Launch Message System** - Define the public story and channel message map. (completed 2026-05-24)
- [x] **Phase 01.1: Learn And Forecast Zine Surface Refresh (INSERTED)** - Bring the beach-detail zine look and Brand-Vault sticker icons to the regional forecast and learn surfaces. (completed 2026-05-24)
- [x] **Phase 2: Offer And Entitlement Truth** - Verify the founding offer path before public pricing copy. (completed 2026-05-24)
- [x] **Phase 3: Landing Page Loop** - Update the landing page around iOS CTA and the Quiver loop. (completed 2026-05-24)
- [x] **Phase 4: Pricing And Founding Offer Surface** - Add the waitlist-safe pricing and founding access surface. (completed 2026-05-24)
- [x] **Phase 5: Blog Platform Expansion** - Prepare the finite blog system for multiple launch posts. (completed 2026-05-24)
- [x] **Phase 6: Launch Blog Content Batch** - Add founder-note and SEO launch posts. (completed 2026-05-24)
- [x] **Phase 7: iOS Store And Asset Alignment** - Align App Store/TestFlight copy, banners, and Brand-Vault assets. (completed 2026-05-24)
- [x] **Phase 8: Outreach And Social Kit** - Produce warm outreach, tracker rules, and reusable social assets. (completed 2026-05-24)
- [x] **Phase 9: Launch Analytics And Reporting** - Instrument and report campaign conversion signals. (completed 2026-05-24)
- [x] **Phase 10: Go-Live Verification** - Validate claims, routes, links, visuals, tests, and release gates. (completed 2026-05-24)
- [x] **Phase 11: PBSC Event Route Deploy And QR Verification** - PBSC event route deploy and QR verification. (completed 2026-05-31)
- [x] **Phase 12: Sentry Observability Rollout** - Turn Sentry startup credits into production debugging, release, replay, cron, and alerting leverage without runaway noise or spend. (completed 2026-05-31)
- [ ] **Phase 13: Controlled Refactor Completion** - Finish the remaining controlled refactor slices from `docs/refactor-roadmap.md` without a big-bang rewrite.

## Phase Details

### Phase 1: Launch Message System

**Goal**: Create the campaign message system that every public surface will use.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: [MESS-01, MESS-02, MESS-03, MESS-04]
**UI hint**: no
**Success Criteria** (what must be TRUE):

  1. Campaign copy explains one surf call and the forecast -> check -> log -> improve loop.
  2. Message map covers landing, pricing, blog, App Store/TestFlight, email, social, and outreach.
  3. Copy guardrails prevent fake release-delay framing, unsupported AI claims, and aggressive competitor positioning.
  4. Brand-Vault and Quiver story canon are listed as required inputs for later phases.

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 01-01: Audit current campaign copy, landing copy, blog canon, App Store constants, and Brand-Vault guidance.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02: Draft the go-live message map and claim guardrails.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03: Review message map against product truth and update PROJECT.md decisions if scope changes.

### Phase 01.1: Learn And Forecast Zine Surface Refresh (INSERTED)

**Goal:** Apply the beach-detail zine visual system to the public regional forecast page, the learn hub, and every learn article while reusing recent Brand-Vault sticker/icon assets.
**Mode:** mvp
**Requirements**: [ZINE-01, ZINE-02, ZINE-03, ZINE-04]
**Depends on:** Phase 1
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. `/forecast/santa-cruz` renders through the shared zine shell while preserving regional forecast data, links, schema, and CTA behavior.
  2. `/learn` and every `/learn/[slug]` article render with the zine field-guide treatment, including the requested Santa Cruz beginner and wind/swell education pages.
  3. Brand-Vault sticker/icon assets are referenced through typed local paths backed by `public/images/quiver-stickers/*`.
  4. Existing authenticated-user CTA guards, pre-auth analytics rules, metadata, schema, and crawlable content remain intact.

**Plans:** 1 plan

Plans:

**Wave 1**

- [x] 01.1-01: Build shared zine primitives, apply them to forecast and learn routes, add targeted public-route E2E coverage, and run scoped validation.

### Phase 2: Offer And Entitlement Truth

**Goal**: Verify what the founding lifetime membership can truthfully promise before public pricing work.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: [PRIC-03, PRIC-04, PRIC-05]
**UI hint**: no
**Success Criteria** (what must be TRUE):

  1. Actual v1 purchase or interest path is identified: RevenueCat, Stripe, manual grant, waitlist, or hybrid.
  2. Lifetime promotional Pro preservation and beta/current-user handling are verified in the existing entitlement code.
  3. Any required env, App Store, RevenueCat, Stripe, or migration work is separated as approval-gated.
  4. Public offer language is blocked from claiming unavailable checkout or entitlement behavior.

**Plans**: 4 plans

Plans:

- [x] 02-01: Audit current entitlement tables, RevenueCat webhook behavior, App Store status, and local monetization docs.
- [x] 02-02: Decide the v1 founding offer mechanics and fallback if purchase flow is not ready.
- [x] 02-03: Define beta/current-user founder-status handling and no-auto-billing rule.
- [x] 02-04: Write the implementation constraints for pricing copy and release gates.

### Phase 3: Landing Page Loop

**Goal**: Make the landing page drive iOS action while teaching the Quiver loop.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: [LAND-01, LAND-02, LAND-04, LAND-05]
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. The landing hero and supporting sections lead with iOS action and one surf call.
  2. The landing page explains forecast -> check -> log -> improve with real product visuals.
  3. CTA/event changes preserve authenticated-user guards and pre-auth event rules.
  4. Mobile and desktop layouts remain crawlable, performant, non-overlapping, and visually consistent.

**Plans**: 5 plans

Plans:

- [x] 03-01: Inspect landing architecture, current hero video/CTA tracking, and mobile/desktop behavior.
- [x] 03-02: Update landing copy hierarchy and loop section content.
- [x] 03-03: Update iOS CTA copy, event names/properties, and auth-aware CTA guards.
- [x] 03-04: Validate visuals with Brand-Vault or current app screenshots.
- [x] 03-05: Run scoped landing tests, typecheck, and browser checks.

### Phase 4: Pricing And Founding Offer Surface

**Goal**: Add the waitlist-safe pricing and founding offer surface without overclaiming payment readiness.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: [LAND-03, PRIC-01, PRIC-02]
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. Public pricing surface shows current founding access status while the pay scale remains release-gated.
  2. Founding access copy explains early access, beta protection, and no automatic charges.
  3. Pricing CTA path matches the verified v1 offer mechanics from Phase 2.
  4. Pricing/founding offer appears near a landing CTA without weakening the surf-call value proposition.

**Plans**: 5 plans

Plans:

- [x] 04-01: Choose route/component shape for pricing based on existing landing and App Router patterns.
- [x] 04-02: Build pricing/founding offer UI copy and responsive layout.
- [x] 04-03: Wire CTA path to the verified purchase, App Store, manual-interest, or waitlist flow.
- [x] 04-04: Add metadata/schema/docs updates required for the pricing surface.
- [x] 04-05: Run scoped tests and browser validation for pricing and landing integration.

### Phase 5: Blog Platform Expansion

**Goal**: Make the finite blog system ready for multiple launch posts while preserving schema, sitemap, and docs.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: [BLOG-01, BLOG-04, BLOG-05]
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. Blog hub supports multiple posts with stable latest/all-post display.
  2. Each post uses human titles plus SEO metadata fields, keywords, schema, and related links.
  3. Sitemap and schema output include every post.
  4. Docs describe the founder-notes/product-transparency boundary and implementation pattern.

**Plans**: 4 plans

Plans:

- [x] 05-01: Inspect blog data model, route pages, schema components, sitemap, and docs.
- [x] 05-02: Add or adjust blog data helpers needed for multiple launch posts.
- [x] 05-03: Update blog hub presentation only where needed for a larger finite list.
- [x] 05-04: Add tests or assertions for static params, metadata, schema, and sitemap behavior.

### Phase 6: Launch Blog Content Batch

**Goal**: Publish launch-relevant founder and SEO blog content that supports downloads and trust.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: [BLOG-02, BLOG-03]
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. Founder note explains the Quiver loop and session-log signal with honest product limits.
  2. SEO-oriented content is useful on its own and links into real Quiver product/forecast/beach pages.
  3. Blog posts avoid generic lifestyle content and unsupported product claims.
  4. Related links move readers toward iOS, pricing, forecast, or beach surfaces naturally.

**Plans**: 5 plans

Plans:

- [x] 06-01: Draft founder-note post content from message map and existing session-log canon.
- [x] 06-02: Draft SEO launch post content tied to real Quiver route inventory.
- [x] 06-03: Add posts to the blog data model with metadata, images, tags, and links.
- [x] 06-04: Review copy for brand, SEO, product truth, and no lifestyle-blog drift.
- [x] 06-05: Run blog route, schema, sitemap, and browser validation.

### Phase 7: iOS Store And Asset Alignment

**Goal**: Keep App Store/TestFlight, smart banner, landing, and asset language current and consistent.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: [STORE-01, STORE-02, STORE-03, STORE-04]
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. iOS destination, status wording, smart banner copy, and landing metadata use one current source of truth.
  2. App Store/TestFlight messaging repeats the surf-call and learning-loop story accurately.
  3. Brand-Vault asset choices are documented before new visuals are created.
  4. Mobile-first visuals show the app/product clearly enough for an iPhone user to understand the tap outcome.

**Plans**: 4 plans

Plans:

- [x] 07-01: Verify current App Store/TestFlight/live status, URLs, screenshots, and app metadata.
- [x] 07-02: Update shared iOS constants/copy and any stale pre-order/download wording.
- [x] 07-03: Select and document Brand-Vault screenshots/video/icon assets for launch surfaces.
- [x] 07-04: Validate iPhone banner, metadata, hero, and mobile rendering.

### Phase 8: Outreach And Social Kit

**Goal**: Produce the launch communication kit while keeping sends and posts approval-gated.
**Mode:** mvp
**Depends on**: Phase 1, Phase 7
**Requirements**: [OUTR-01, OUTR-02, OUTR-03, OUTR-04]
**UI hint**: no
**Success Criteria** (what must be TRUE):

  1. Warm email/outreach drafts are useful, surf-first, client-facing, and unsent.
  2. Social captions/scripts/asset briefs are reusable across launch posts, stories, reels, and founder-account posts.
  3. Channel plan respects prior Reddit pause and prioritizes warm users, reviewers, useful replies, and comment-first paths.
  4. Tracker and suppression rules are documented for recipient state, reply state, Apple relay/bounces, and audit logs.

**Plans**: 5 plans

Plans:

- [x] 08-01: Inspect active Brand-Vault/growth/outreach docs and tracker conventions.
- [x] 08-02: Draft warm email and reviewer/founder outreach templates.
- [x] 08-03: Draft social captions, short scripts, and visual briefs tied to Brand-Vault assets.
- [x] 08-04: Define channel rules, suppression checks, and tracker update protocol.
- [x] 08-05: Review all outbound copy for no-send boundary and no release-delay framing.

### Phase 9: Launch Analytics And Reporting

**Goal**: Instrument the campaign and define how launch performance will be read.
**Mode:** mvp
**Depends on**: Phase 3, Phase 4, Phase 6, Phase 8
**Requirements**: [ANLY-01, ANLY-02, ANLY-03, ANLY-04]
**UI hint**: no
**Success Criteria** (what must be TRUE):

  1. iOS CTA events include source, placement, platform, destination, and auth context where appropriate.
  2. Pricing/founding offer events capture surface, plan/offer intent, and destination.
  3. Blog views/cross-link clicks can be attributed to launch content and downstream surfaces.
  4. Launch report path combines web analytics, App Store/TestFlight signal, email/social tracker state, and conversion notes.

**Plans**: 5 plans

Plans:

- [x] 09-01: Audit existing analytics event allowlists and campaign-related events.
- [x] 09-02: Add or align landing, pricing, iOS CTA, and blog event tracking.
- [x] 09-03: Add reporting script/dashboard notes for launch metrics.
- [x] 09-04: Validate event ingestion against allowlists and pre-auth/auth guards.
- [x] 09-05: Run scoped analytics tests and dry-run report commands where safe.

### Phase 10: Go-Live Verification

**Goal**: Prove the launch campaign is ready without hidden claims, broken CTAs, or unapproved production actions.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, Phase 9
**Requirements**: [QA-01, QA-02, QA-03, QA-04]
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. Typecheck, scoped lint, relevant unit tests, and relevant Playwright/browser checks pass or blockers are documented exactly.
  2. Landing, pricing, and blog routes are validated on mobile and desktop with working CTAs and visible assets.
  3. Public claims are verified against current product behavior, entitlement code, App Store/TestFlight state, and live links.
  4. Release checklist calls out all approval-gated migrations, env changes, App Store/RevenueCat changes, outbound sends, and deploy steps.

**Plans**: 4 plans

Plans:

- [x] 10-01: Run full local launch QA gate and collect command evidence.
- [x] 10-02: Run browser validation for landing, pricing, blog, and iOS CTA paths.
- [x] 10-03: Verify product claims, payment/entitlement claims, App Store/TestFlight links, and Brand-Vault asset provenance.
- [x] 10-04: Produce go-live checklist, unresolved risks, and approval-gated release steps.

### Phase 11: PBSC Event Route Deploy And QR Verification

**Goal:** Make `https://www.quiversurf.app/pbsc` a production-verified PBSC QR scan route that sends iOS visitors to the App Store, sends every non-iOS visitor to the Android waitlist, removes the web fallback, and preserves approval gates before deploy/print/send actions.
**Requirements**: [PBSC-01, PBSC-02, PBSC-03, PBSC-04, PBSC-05]
**Depends on:** Phase 10
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. `/pbsc` chooses the first-paint primary CTA by OS: iOS gets tracked App Store, and Android/desktop/tablet/unknown visitors get tracked Android waitlist.
  2. The PBSC scan route no longer renders `Use Quiver on web`, `/map` fallback, or copy that implies immediate unavailable platform access.
  3. Anonymous Android waitlist clicks on `/pbsc` store PBSC-specific intent, open signup, return to `/pbsc`, and preserve event attribution.
  4. Local focused Jest, scoped lint/typecheck, and guest Playwright coverage prove iOS, Android, and desktop route behavior.
  5. After explicit approval, production `https://www.quiversurf.app/pbsc` returns HTTP 200, matches `/pbsc`, and has desktop/mobile browser proof before QR materials are treated as usable.

**Plans:** 2 plans

Plans:

**Wave 1**

- [x] 11-01: Implement PBSC OS-specific CTAs, remove the web fallback, preserve waitlist return behavior, and add focused Jest/guest Playwright coverage.

**Wave 2** *(blocked on Wave 1 completion and explicit release approval)*

- [x] 11-02: Capture approval-gated production QR verification, live browser proof, and print/send guardrails.

### Phase 12: Sentry Observability Rollout

**Goal:** Use the Sentry for Startups credit to upgrade Quiver from basic error capture into controlled production observability across web, native, and critical jobs while keeping privacy, sampling, source maps, and alert noise under control.
**Requirements**: [OBS-01, OBS-02, OBS-03, OBS-04, OBS-05]
**Depends on:** Phase 11
**UI hint**: no
**Success Criteria** (what must be TRUE):

  1. Web, native, and any future service projects have separate Sentry project/DSN ownership, correct production/preview/development environment tagging, and clean release/dist mapping.
  2. Production web and native releases upload source maps/debug symbols so Sentry, Seer, and alert emails show readable Quiver stack traces instead of minified bundle frames.
  3. Tracing, replay, logs, and issue alerts are sampled and filtered by Quiver-critical flows: auth, onboarding, RevenueCat, push/notification delivery, forecast freshness, cron failures, and launch conversion routes.
  4. Sentry Cron monitors cover critical production jobs while the existing `cron_runs` table remains the internal operational ledger.
  5. Startup-credit usage is monitored with a monthly budget/check cadence and no high-volume replay/log/tracing setting ships without an explicit sampling cap.

**Plans:** 5 plans

Plans:

- [x] 12-01: Audit live Sentry org/project/settings, current web/native SDK versions, DSNs, source-map upload paths, alert rules, and recent issue volume.
- [x] 12-02: Design the target project split, release/source-map strategy, environment tags, alert ownership, and Sentry/GitHub/Seer workflow.
- [x] 12-03: Implement web sampling, source-map/release hygiene, issue filtering, and critical-flow tags without changing unrelated observability surfaces.
- [x] 12-04: Implement native release/source-map hygiene, user/release context, critical-flow breadcrumbs/tags, and any replay/profiling pilot behind conservative sampling.
- [x] 12-05: Add Sentry Cron monitors, budget/usage review notes, verification commands, and a runbook for triaging the top weekly Sentry issues.

Cross-cutting constraints:

- Do not print, commit, or paste `SENTRY_AUTH_TOKEN`, private DSN values beyond existing public DSNs, raw stack traces, IPs, or raw emails in planning artifacts.
- No Sentry dashboard/project/DSN/env, GitHub/Seer, billing, Vercel, Expo/EAS, App Store, Firebase, deploy, or release-script mutation happens without explicit approval.
- `cron_runs` remains the internal run ledger; Sentry Cron monitors only supplement external fire/finish alerting.
- No broad Replay, Logs, Profiling, or tracing expansion ships without numeric sampling caps and monthly usage review.

### Phase 13: Controlled Refactor Completion

**Goal:** Finish the remaining controlled refactor slices from `docs/refactor-roadmap.md`, starting with the post-Slice-81 API utility wrapper cleanup, while preserving behavior and keeping every change independently reviewable.
**Requirements**: [REF-01, REF-02, REF-03, REF-04, REF-05]
**Depends on:** Phase 12
**UI hint**: no
**Success Criteria** (what must be TRUE):

  1. Remaining production `@/lib/api-utils` imports outside wrapper internals are migrated or explicitly retained with rationale: `app/session/confirm/route.ts`, `lib/cron/observability.ts`, `lib/validation/middleware.ts`, and `lib/middleware/bot-blocker.ts`.
  2. API wrapper compatibility exports and wrapper-internal dependencies have clear ownership, and no `app/api/**/route.ts` callers regress to direct legacy helper imports.
  3. Each implementation slice stays behavior-preserving, has a focused safety net or source guard where useful, and records files changed, validation, risk, rollback, and next slice.
  4. `docs/refactor-roadmap.md` remains the source of truth for completed slices, current risks, validation status, open questions, and the recommended next slice.
  5. Validation includes targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` when runtime, route, middleware, or build-sensitive surfaces are touched.

**Plans:** 5 plans

Plans:

- [ ] 13-01: Resume at Slice 82 and migrate the `app/session/confirm/route.ts` UUID helper import with focused coverage and source-guard validation.
- [ ] 13-02: Migrate the remaining non-route production helper imports one at a time: cron observability, validation middleware, and bot blocker.
- [ ] 13-03: Review wrapper internals and compatibility shim exports, then collapse or document remaining `lib/api-utils` dependencies without changing public route behavior.
- [ ] 13-04: Run import-guard checks, targeted unit coverage, scoped lint, typecheck, and preview build for the completed wrapper-cleanup set.
- [ ] 13-05: Close the refactor checkpoint by updating `docs/refactor-roadmap.md`, recording residual risks, and selecting the next non-API refactor candidate only as a future phase or plan.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 1.1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Launch Message System | 3/3 | Complete | 2026-05-24 |
| 01.1. Learn And Forecast Zine Surface Refresh | 1/1 | Complete | 2026-05-24 |
| 2. Offer And Entitlement Truth | 4/4 | Complete | 2026-05-24 |
| 3. Landing Page Loop | 5/5 | Complete | 2026-05-24 |
| 4. Pricing And Founding Offer Surface | 5/5 | Complete | 2026-05-24 |
| 5. Blog Platform Expansion | 4/4 | Complete | 2026-05-24 |
| 6. Launch Blog Content Batch | 5/5 | Complete | 2026-05-24 |
| 7. iOS Store And Asset Alignment | 4/4 | Complete | 2026-05-24 |
| 8. Outreach And Social Kit | 5/5 | Complete | 2026-05-24 |
| 9. Launch Analytics And Reporting | 5/5 | Complete | 2026-05-24 |
| 10. Go-Live Verification | 4/4 | Complete | 2026-05-24 |
| 11. PBSC Event Route Deploy And QR Verification | 2/2 | Complete | 2026-05-31 |
| 12. Sentry Observability Rollout | 5/5 | Complete | 2026-05-31 |
| 13. Controlled Refactor Completion | 0/5 | Planned | - |
