# Summary 03-01: Landing Architecture And CTA Audit

## Status

Complete.

## Completed

- Created Phase 3 context from the Phase 1 message spine and Phase 2 pricing truth gates.
- Inspected the active `/` route architecture, including server metadata/structured data, auth-aware rendering, anonymous landing composition, authenticated dashboard routing, and SSR beach links.
- Audited the current hero poster/video path, asset sizes, App Store CTA overlay, CTA event payloads, and view/click tracking coverage.
- Mapped active landing sections versus older inactive landing components so later work edits the route users actually see.
- Reviewed existing landing unit tests and `e2e/guest-landing.spec.ts` for coverage and gaps.
- Identified the main Phase 3 risks: the active landing does not yet teach the full loop, pre-order wording is truth-gated, transparent hero CTA placement needs browser validation, and App Store CTA events are not mirrored into internal `user_events`.

## Key Findings

- Active route: `app/page.tsx` -> `AuthAwareLandingWrapper` -> `Navbar` + `HeroSection` + `LandingInteractiveSections` -> `LandingPageSSRSection`.
- The older `components/landing-page/how-it-works-section.tsx` is not active on `/`.
- The hero uses a poster-first video path with a transparent absolute App Store CTA overlay.
- App Store CTA events are client analytics events only unless a later plan adds `/api/events` support.
- App Store/pre-order language remains a Phase 7 truth gate.

## Next Plan

03-02: Update landing copy hierarchy and loop section content.

## Approval Boundary

No production code, pricing UI, checkout wiring, App Store/TestFlight setup, RevenueCat dashboard changes, env changes, Supabase migrations, production data, outbound messaging, commits, or pushes were made.
