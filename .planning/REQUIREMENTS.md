# Requirements: Quiver Go-Live Campaign

**Defined:** 2026-05-24
**Core Value:** Drive iOS downloads by making the Quiver loop obvious and compelling: forecast, check, log, and improve.

## v1 Requirements

Requirements for the go-live campaign. Each requirement maps to exactly one roadmap phase.

### Public Zine Surface Refresh

- [x] **ZINE-01**: Visitors can use `/forecast/santa-cruz` in the same beach-detail zine visual family while still seeing the current regional forecast data, links, schema, and CTA behavior.
- [x] **ZINE-02**: Visitors can use `/learn` and every `/learn/[slug]` child page in the zine field-guide treatment without losing crawlable headings, metadata, schema, article content, related links, or FAQ content.
- [x] **ZINE-03**: The refresh uses recent Brand-Vault sticker/icon assets through typed app-local paths backed by `public/images/quiver-stickers/*`, not runtime imports from Brand-Vault.
- [x] **ZINE-04**: Public signup CTAs on refreshed forecast and learn surfaces preserve authenticated-user guards, pre-auth event rules, and targeted E2E/browser visual validation.

### Messaging

- [x] **MESS-01**: First-time visitors can understand that Quiver gives one surf call instead of forcing them to compare several forecast tools.
- [x] **MESS-02**: First-time visitors can understand the learning loop: Quiver forecasts, the surfer checks, the surfer logs the session, and Quiver improves over time.
- [x] **MESS-03**: Public copy avoids fake release-delay framing, unsupported "AI" hype, overbroad accuracy claims, and direct Surfline conquest language.
- [x] **MESS-04**: Campaign operators have a reusable message map for landing page, pricing, blog, App Store/TestFlight, email, social, and outreach.

### Landing Page

- [x] **LAND-01**: Anonymous iPhone-focused visitors can reach the current iOS download, pre-order, or TestFlight destination from the landing hero with tracked CTA clicks.
- [x] **LAND-02**: Anonymous visitors can see the forecast -> check -> log -> improve loop on the landing page using concrete product language and real Quiver visuals.
- [x] **LAND-03**: Anonymous visitors can see a founding membership offer near a primary app CTA without losing the landing page's surf-call value proposition.
- [x] **LAND-04**: Authenticated users do not receive pre-auth signup CTA events or irrelevant anonymous-user app prompts while the landing experience changes.
- [x] **LAND-05**: The landing page remains server-first, crawlable, performant, and visually sound across mobile and desktop viewports.

### Pricing And Offer

- [x] **PRIC-01**: Visitors can see a waitlist-safe public pricing status surface that explains plans are not open yet and avoids pay-scale claims until verification.
- [x] **PRIC-02**: Founding access copy explains early access, beta protection, no automatic charges, and that existing beta access will not be removed because pricing launches.
- [x] **PRIC-03**: The public pricing surface only claims checkout, App Store purchase, or lifetime entitlement behavior that has been verified against current RevenueCat/App Store/product wiring.
- [x] **PRIC-04**: Existing beta/current users have an explicit founder-status handling rule that avoids auto-billing and prevents accidental loss of lifetime promotional Pro.
- [x] **PRIC-05**: Pricing implementation plans identify whether web Stripe, native RevenueCat, manual grant, or waitlist capture is the actual v1 purchase path.

### Blog And Content

- [x] **BLOG-01**: Visitors can browse a blog hub with multiple launch-relevant posts while preserving the finite founder-notes/product-transparency model.
- [x] **BLOG-02**: Visitors can read a founder note that explains the Quiver loop and why session logs become useful signal over time.
- [x] **BLOG-03**: Visitors can read SEO-oriented surf content that is useful on its own and links naturally into real Quiver forecast/beach/product pages.
- [x] **BLOG-04**: Every new blog post has human visible title text plus separate SEO title, description, keywords, metadata, schema, sitemap inclusion, and related links.
- [x] **BLOG-05**: Blog expansion updates the supporting documentation and schema surface together with route/data changes.

### App Store And Mobile Messaging

- [x] **STORE-01**: App Store, TestFlight, smart banner, metadata, and landing-page CTA language use one current source of truth for iOS destination and launch status.
- [x] **STORE-02**: App Store/TestFlight messaging repeats the surf-call and learning-loop story without overstating model behavior or implying unavailable native features.
- [x] **STORE-03**: Campaign assets use Brand-Vault screenshots, videos, icon, colors, and type guidance before generating or sourcing new media.
- [x] **STORE-04**: Mobile-first surfaces show the app/product itself clearly enough for a visitor to understand what they will get after tapping the iOS CTA.

### Outreach And Social

- [x] **OUTR-01**: Campaign operators have warm email/outreach drafts that are useful, surf-first, client-facing, and explicitly unsent until the user approves sending.
- [x] **OUTR-02**: Campaign operators have reusable social captions, short scripts, and visual-asset briefs for launch posts, story/reel formats, and founder-account posts.
- [x] **OUTR-03**: Outreach plans prioritize warm users, reviewers, useful replies, and comment-first paths instead of Reddit user-acquisition launch posts unless the user reopens that channel.
- [x] **OUTR-04**: Outreach execution plans include tracker updates, suppression checks, Apple relay/bounce hygiene, recipient state, reply state, and audit logs.

### Analytics And Reporting

- [x] **ANLY-01**: Campaign operators can measure iOS CTA views/clicks by source, placement, platform, and destination.
- [x] **ANLY-02**: Campaign operators can measure founding-offer and pricing-page views/clicks, including the selected purchase or interest path.
- [x] **ANLY-03**: Campaign operators can measure blog launch content views and cross-link clicks into the app, App Store, pricing, forecast, and beach surfaces.
- [x] **ANLY-04**: Campaign operators have a launch reporting path that combines web analytics, App Store/TestFlight signals, email/social tracker state, and conversion notes.

### Release Quality

- [x] **QA-01**: Launch implementation passes Node 22 typecheck plus scoped lint/tests for touched surfaces before commit.
- [x] **QA-02**: Landing, pricing, and blog routes receive browser validation on mobile and desktop with screenshots or equivalent evidence for CTAs, layout, and asset loading.
- [x] **QA-03**: Public claims are checked against current product behavior, entitlement code, App Store/TestFlight state, and live links before go-live.
- [x] **QA-04**: Release notes identify approval-gated items including migrations, env changes, App Store/RevenueCat changes, outbound sends, and production deploy steps.

### PBSC Event Route

- [ ] **PBSC-01**: Visitors scanning the PBSC QR at `/pbsc` get an OS-specific primary action: iOS visitors see the App Store path and every non-iOS visitor sees the Android waitlist.
- [ ] **PBSC-02**: The non-iOS PBSC path uses the existing Android waitlist intent flow in-page and preserves anonymous signup return to `/pbsc`.
- [ ] **PBSC-03**: The PBSC scan path removes the web fallback and avoids copy that overpromises immediate Tourmaline, web, or Android install access.
- [ ] **PBSC-04**: Local and live verification prove the PBSC route behavior across iOS, Android, desktop, and the canonical production QR URL.
- [ ] **PBSC-05**: Production deploy, alias promotion, printing, outbound sends, social posts, tracker writes, and payment actions remain approval-gated.

### Sentry Observability

- [ ] **OBS-01**: Quiver has a Sentry project/DSN ownership model that separates web, native, and future services enough for clean alert routing, issue grouping, releases, and environment filtering.
- [ ] **OBS-02**: Production web and native releases upload source maps or debug symbols so Sentry issue stacks are readable and tied to the correct release/dist.
- [ ] **OBS-03**: Tracing, replay, logs, and issue alerts are sampled and filtered around Quiver-critical flows without letting routine route volume, expected fallbacks, or preview/local traffic burn credit.
- [ ] **OBS-04**: Critical production cron jobs have Sentry monitors and alerts, while `cron_runs` remains the source for internal run summaries and stale-run diagnostics.
- [ ] **OBS-05**: Startup-credit usage, monthly spend risk, alert ownership, Seer/GitHub workflow, and weekly top-issue triage are documented before expanding replay/log/tracing volume.

### Controlled Refactor Completion

- [ ] **REF-01**: Remaining production `@/lib/api-utils` imports outside wrapper internals are migrated or intentionally retained with documented rationale.
- [ ] **REF-02**: API wrapper compatibility exports and wrapper-internal dependencies have clear ownership, with no `app/api/**/route.ts` regression to direct legacy helper imports.
- [ ] **REF-03**: Each refactor slice is behavior-preserving, PR-sized, and backed by focused characterization, source-guard, or unit coverage before risky edits.
- [ ] **REF-04**: `docs/refactor-roadmap.md` stays current after each completed slice with progress, validation status, current risks, open questions, rollback, and the next recommended slice.
- [ ] **REF-05**: Refactor validation includes targeted Jest, scoped ESLint, `yarn typecheck`, and preview build when runtime, route, middleware, or build-sensitive surfaces are touched.

## v2 Requirements

Deferred to future release. Tracked but not in the current roadmap.

### Monetization

- **PRIC-V2-01**: User can complete fully unified cross-platform subscription management across web Stripe, native RevenueCat, and account settings.
- **PRIC-V2-02**: User can manage subscription, restore purchase, and update billing from a complete in-app account center.
- **PRIC-V2-03**: After RevenueCat Web Billing checkout and entitlement sync are verified, public pricing can publish monthly, annual, standard lifetime, and founding lifetime plan details.
- **PRIC-V2-04**: After paid lifetime semantics are verified, public copy can explain lifetime eligibility, limits, grant behavior, and post-offer behavior.

### Content

- **BLOG-V2-01**: Operator can author blog posts through a CMS-like workflow instead of editing `lib/data/blog-posts.ts`.
- **BLOG-V2-02**: Visitor can browse content by topic/tag archives if the finite blog list grows large enough to need navigation.

### Campaign

- **OUTR-V2-01**: Operator can run automated lifecycle nurture sequences from production cohorts without manual draft/tracker handling.
- **ANLY-V2-01**: Operator can view a dedicated launch dashboard inside the product instead of assembling launch evidence from scripts and external dashboards.

## Out of Scope

Explicitly excluded to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Core forecast-pipeline rebuild | The launch campaign explains and packages the existing product loop; it does not restart forecast architecture. |
| Broad paywall enforcement across all protected routes | Current objective is public go-live campaign and founding offer clarity; full subscription gating is larger than this launch scope. |
| Production database migration without separate approval | Pricing/entitlement changes may need schema work, but production mutations require the repo migration protocol and explicit approval. |
| Generic lifestyle blog | Quiver is not a media company; blog content must support surf decisions, session memory, product transparency, or search demand tied to useful Quiver pages. |
| Reddit launch-post user acquisition | Prior campaign learning says this channel is paused unless explicitly reopened. Useful replies remain allowed. |
| Fake release-delay narrative | No public release date was advertised, so launch messaging cannot imply a slipped or delayed launch. |
| New generated visual identity | Brand-Vault is the source of truth; generated or external assets are fallback only. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MESS-01 | Phase 1 | Complete |
| MESS-02 | Phase 1 | Complete |
| MESS-03 | Phase 1 | Complete |
| MESS-04 | Phase 1 | Complete |
| ZINE-01 | Phase 01.1 | Complete |
| ZINE-02 | Phase 01.1 | Complete |
| ZINE-03 | Phase 01.1 | Complete |
| ZINE-04 | Phase 01.1 | Complete |
| PRIC-03 | Phase 2 | Complete |
| PRIC-04 | Phase 2 | Complete |
| PRIC-05 | Phase 2 | Complete |
| LAND-01 | Phase 3 | Complete |
| LAND-02 | Phase 3 | Complete |
| LAND-04 | Phase 3 | Complete |
| LAND-05 | Phase 3 | Complete |
| LAND-03 | Phase 4 | Complete |
| PRIC-01 | Phase 4 | Complete |
| PRIC-02 | Phase 4 | Complete |
| BLOG-01 | Phase 5 | Complete |
| BLOG-04 | Phase 5 | Complete |
| BLOG-05 | Phase 5 | Complete |
| BLOG-02 | Phase 6 | Complete |
| BLOG-03 | Phase 6 | Complete |
| STORE-01 | Phase 7 | Complete |
| STORE-02 | Phase 7 | Complete |
| STORE-03 | Phase 7 | Complete |
| STORE-04 | Phase 7 | Complete |
| OUTR-01 | Phase 8 | Complete |
| OUTR-02 | Phase 8 | Complete |
| OUTR-03 | Phase 8 | Complete |
| OUTR-04 | Phase 8 | Complete |
| ANLY-01 | Phase 9 | Complete |
| ANLY-02 | Phase 9 | Complete |
| ANLY-03 | Phase 9 | Complete |
| ANLY-04 | Phase 9 | Complete |
| QA-01 | Phase 10 | Complete |
| QA-02 | Phase 10 | Complete |
| QA-03 | Phase 10 | Complete |
| QA-04 | Phase 10 | Complete |
| PBSC-01 | Phase 11 | Planned |
| PBSC-02 | Phase 11 | Planned |
| PBSC-03 | Phase 11 | Planned |
| PBSC-04 | Phase 11 | Planned |
| PBSC-05 | Phase 11 | Planned |
| OBS-01 | Phase 12 | Planned |
| OBS-02 | Phase 12 | Planned |
| OBS-03 | Phase 12 | Planned |
| OBS-04 | Phase 12 | Planned |
| OBS-05 | Phase 12 | Planned |
| REF-01 | Phase 13 | Planned |
| REF-02 | Phase 13 | Planned |
| REF-03 | Phase 13 | Planned |
| REF-04 | Phase 13 | Planned |
| REF-05 | Phase 13 | Planned |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0

---
*Requirements defined: 2026-05-24*
*Last updated: 2026-05-30 during Phase 13 controlled refactor planning*
