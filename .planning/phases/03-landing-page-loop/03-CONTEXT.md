# Phase 3: Landing Page Loop - Context

**Gathered:** 2026-05-24T21:38:21Z
**Status:** Complete

<domain>
## Phase Boundary

This phase updates the landing page so anonymous visitors understand the Quiver loop and have a clear iOS action path while preserving the existing server-first route shape, authenticated-user handling, SEO crawlability, and analytics rules.

This phase may change landing page copy, CTA wiring, launch-event naming, tests, and supporting documentation. It must not make pricing, lifetime purchase, checkout, App Store, or RevenueCat claims beyond the Phase 2 verified waitlist boundary unless a later truth-gate phase proves the claim first.

</domain>

<decisions>
## Carry-Forward Decisions

- Lead with one surf call plus the loop: forecast -> surfer checks -> logs session -> model adjusts.
- Public pricing and founding-offer language remains waitlist-only until Phase 2 release gates prove checkout and entitlement sync.
- App Store/TestFlight wording and destination status are time-sensitive and must be verified in Phase 7 before final public claims.
- Authenticated users must not receive pre-auth signup CTA events or irrelevant anonymous-user app prompts.
- Brand-Vault and existing Quiver app visuals are the first source for landing visuals before generating or sourcing new assets.

</decisions>

<canonical_refs>
## Canonical References

### Planning Source
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/01-launch-message-system/01-MESSAGE-MAP.md`
- `.planning/phases/02-offer-and-entitlement-truth/02-04-PRICING-RELEASE-GATES.md`

### Landing Route And Components
- `app/page.tsx`
- `components/landing-page/auth-aware-landing-wrapper.tsx`
- `components/landing-page/hero-section.tsx`
- `components/landing-page/landing-interactive-sections.tsx`
- `components/landing-page/forecast-section.tsx`
- `components/landing-page/ml-pipeline-showcase.tsx`
- `components/landing-page/cta-section.tsx`
- `components/landing-page/navbar.tsx`
- `components/landing-page/landing-page-ssr-section.tsx`
- `components/landing-page/ARCHITECTURE.md`

### Shared Copy, Analytics, And Tests
- `lib/constants/app-store.ts`
- `lib/constants/features.ts`
- `lib/analytics/signup-conversion-tracking.ts`
- `lib/analytics.ts`
- `app/api/events/route.ts`
- `__tests__/components/landing/hero-section.test.tsx`
- `__tests__/components/landing-page/cta-section.test.tsx`
- `__tests__/components/landing-page.test.tsx`
- `e2e/guest-landing.spec.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

- `/` is a hybrid App Router route. `app/page.tsx` renders metadata, poster preload, `HomePageStructuredData`, `AuthAwareLandingWrapper`, and `LandingPageSSRSection`.
- Anonymous users see `Navbar`, `HeroSection`, and `LandingInteractiveSections`. Authenticated users are routed into the lazy `OracleHomeScreen` dashboard instead of anonymous landing CTAs.
- The active anonymous landing flow is video-led and App Store CTA led. It does not render the older `components/landing-page/how-it-works-section.tsx` path.
- `LandingInteractiveSections` currently renders `SurfHighlightsSection`, `ForecastSection`, `MLPipelineShowcase`, `ActivitiesSection`, `FeatureBentoSection`, and final `CTASection`.
- `LandingPageSSRSection` renders crawlable beach links/cards server-side after the auth-aware client wrapper.
- Current iOS CTA constants use the App Store listing URL, `Download Quiver` CTA text, and `app_store_listing` destination status. Phase 7 must verify current App Store/TestFlight status before final go-live claims.
- App Store CTA events now use client `ios_app_cta_view` / `ios_app_cta_click` and dual-fire to existing internal `/api/events` `cta_impression` / `cta_click` rows with iOS destination metadata.

</code_context>

<specifics>
## Phase 3 Specifics

- 03-01 is an audit and architecture inspection only.
- 03-02 should update active landing copy and loop explanation in the components actually rendered by `/`.
- 03-03 normalized iOS CTA copy/event semantics and preserved auth guards.
- 03-04 validated and documented current app visuals and Brand-Vault/source asset choices.
- 03-05 ran landing tests, typecheck, and browser/mobile/desktop validation.

</specifics>

<deferred>
## Deferred Ideas

- Founding offer UI belongs to Phase 4 and must remain waitlist-only unless Phase 2 release gates are completed.
- App Store/TestFlight, smart banner, and final iOS status copy belong to Phase 7.
- Launch dashboard/reporting belongs to Phase 9.
- Final claim, visual, and release validation belongs to Phase 10.

</deferred>

---

*Phase: 3-Landing Page Loop*
*Updated: 2026-05-24T23:32:00Z*
