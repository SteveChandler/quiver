# 03-01 Landing Architecture And CTA Audit

## Verdict

The active landing page is a solid hybrid foundation: `app/page.tsx` keeps metadata, structured data, poster preload, and SSR beach links server-side, while `AuthAwareLandingWrapper` switches anonymous visitors into the launch landing and authenticated users into the app dashboard.

The next Phase 3 work should not start from the older `components/landing-page.tsx` path. The active anonymous path is:

`app/page.tsx` -> `AuthAwareLandingWrapper` -> `Navbar` + `HeroSection` + `LandingInteractiveSections` -> `LandingPageSSRSection`

The main gap is message hierarchy. The current page is video/App Store pre-order led, but the active route does not clearly teach the loop `forecast -> check -> log -> improve` with the concise launch language. That loop has to be added to the components actually rendered by `/`.

## Active Route Map

### Server Route

- `app/page.tsx`
  - `revalidate = 600`
  - renders `<HomePageStructuredData />`
  - preloads `/images/hero/quiver-landing-hero-poster.jpg`
  - renders `<AuthAwareLandingWrapper />`
  - renders `<LandingPageSSRSection />`
  - metadata still uses iPhone pre-order language and imports `IOS_APP_STORE_PREORDER_URL`

### Anonymous Client Route

- `components/landing-page/auth-aware-landing-wrapper.tsx`
  - if no Supabase auth cookie exists, skips the anonymous loading skeleton and shows landing immediately
  - renders `Navbar position="static"`
  - renders `HeroSection`
  - renders `LandingInteractiveSections`
  - adds `js-loaded` to the body so the SSR beach section can be hidden from the hydrated visual landing

### Authenticated Route

- `components/landing-page/auth-aware-landing-wrapper.tsx`
  - lazy-loads `OracleHomeScreen`
  - does not render anonymous landing CTA sections for authenticated users

### Server SEO Fallback

- `components/landing-page/landing-page-ssr-section.tsx`
  - fetches featured beaches server-side
  - renders `QuiverFAQSchema`
  - renders crawler-visible beach links in `#ssr-beach-links`
  - renders server-side popular beach cards in `#ssr-beach-section`

## Hero Video And CTA

### Assets

- Poster: `public/images/hero/quiver-landing-hero-poster.jpg` at 94 KB.
- Mobile video: `public/videos/quiver-landing-hero-720.mp4` at 475 KB.
- Desktop video: `public/videos/quiver-landing-hero-1280.mp4` at 1.3 MB.

### Behavior

- `HeroSection` shows the poster first.
- Video is delayed until after page load plus idle timeout.
- `prefers-reduced-motion` keeps the poster-only experience.
- Mobile and desktop video sources are selected with media queries.

### CTA Placement Risk

The hero CTA is a transparent absolute link over the baked-in video button:

`left-[9.8%] top-[80.9%] h-[6.2%] w-[13.4%] min-h-9 min-w-[112px]`

That keeps the visual artifact untouched, but it is fragile. It depends on the poster/video button position staying exactly aligned across rendered aspect ratios, mobile widths, localization, and future asset replacements. Later Phase 3 work should either replace it with a real visible CTA layer or explicitly browser-validate the hit target on mobile and desktop in 03-05.

## CTA And Event Map

### Current App Store CTA Events

- `HeroSection`
  - view: `app_store_preorder_view`
  - click: `app_store_preorder_click`
  - source: `hero-video-download-button`
  - placement: `hero_video_overlay`
  - destination: `IOS_APP_STORE_PREORDER_URL`
- `ForecastSection`
  - view: `app_store_preorder_view`
  - click: `app_store_preorder_click`
  - source: `forecast-section`
  - surface: `landing-page`
- `CTASection` with `variant="app-store-preorder"`
  - view: `app_store_preorder_view`
  - click: `app_store_preorder_click`
  - source: `landing-final-cta`
  - surface: `landing-page`

### Analytics Gap

The App Store CTA events use the client `track()` helper. `app_store_preorder_view` and `app_store_preorder_click` were not found in `app/api/events/route.ts` allowlists, so they are not currently mirrored to the internal `user_events` table.

That is acceptable only if launch reporting intentionally uses PostHog/GA for iOS CTA attribution. If campaign reporting needs Supabase `user_events`, 03-03 or Phase 9 needs to add explicit server event support and update tests.

### Pre-Auth Signup CTA Events

- `Navbar` uses `trackSignupCtaView`, `trackSignupCtaClick`, and `trackSigninCtaClick`.
- `MLPipelineShowcase` uses `trackSignupCtaView` and `trackSignupCtaClick`.
- `CTASection` signup variant uses the same pre-auth helpers.

The active app-store CTA surfaces guard views for authenticated users in component state where checked. The pre-auth helpers still need to keep their existing self-guard pattern when landing copy changes.

## Active And Inactive Loop Surfaces

### Active

- `ForecastSection`
  - shows app screenshots and the rails `Your Surf Call`, `Session Journal`, and `Local Intel`
  - includes copy like "Log sessions. Unlock better forecasts."
  - currently emphasizes feature value more than the full loop
- `MLPipelineShowcase`
  - explains data sources, forecast checks, and beach-specific calls
  - does not include the surfer action loop in sequence
- `FeatureBentoSection`
  - includes "Tuned to You", "Session Tracking", and "Community"
  - supports the story but does not teach the loop as the main landing spine

### Inactive Or Legacy For `/`

- `components/landing-page.tsx` appears to be an older composed landing component and is not the active `/` route.
- `components/landing-page/how-it-works-section.tsx` is not currently rendered by the active anonymous path.
- `HeroVideoBackground` is not the active hero implementation.

This matters for 03-02: updating only the old `HowItWorksSection` would not change the real landing page.

## Copy And Truth Gate Risks

- `app/page.tsx`, `CTASection`, `ForecastSection`, and `HeroSection` still use pre-order/App Store language from `lib/constants/app-store.ts`.
- `IOS_TESTFLIGHT_BETA_CTA` says "Log 5 sessions and get Quiver for lifetime"; that wording should remain out of public landing work unless Phase 2/4/7 gates explicitly approve it.
- Final App Store status, smart banner status, and destination wording are Phase 7 responsibilities.
- Phase 3 can improve the CTA hierarchy, but should not claim live checkout, lifetime purchase, RevenueCat Web Billing, App Store purchase semantics, or cross-platform Pro unlock.

## Mobile And Desktop Risks

- The hero is `aspect-video`; on narrow mobile screens, the visual poster/video may be short relative to the landing message and the transparent CTA hit area.
- Several sections rely on client-side animation with `framer-motion`; browser validation should include reduced-motion and loaded-video paths if possible.
- The landing architecture doc is partially stale or mixed: it references `LandingPageSSRSection` in `app/layout.tsx`, while the current route renders it from `app/page.tsx`; it also contains historical "no Framer Motion" guidance alongside later Framer Motion reintroduction notes.
- The final layout still needs 03-05 screenshots or browser evidence on mobile and desktop before shipping visual claims.

## Test Inventory

### Unit Tests Reviewed

- `__tests__/components/landing/hero-section.test.tsx`
  - covers poster-first render, App Store link, view/click tracking, lazy video lifecycle, and reduced-motion behavior.
- `__tests__/components/landing-page/cta-section.test.tsx`
  - covers signup and app-store preorder variants.
- `__tests__/components/landing-page.test.tsx`
  - covers the older `components/landing-page.tsx` composition, which is not the current `/` route entry point.

### E2E Reviewed

- `e2e/guest-landing.spec.ts`
  - covers anonymous landing load, auth modal behavior, SSR beach links, ML showcase, search, and image-fallback behavior.
  - does not currently assert hero overlay alignment, App Store CTA click behavior, mobile hero framing, or launch CTA event persistence.

## Handoff To 03-02

03-02 should update the active landing copy hierarchy in `HeroSection`, `LandingInteractiveSections`, `ForecastSection`, `MLPipelineShowcase`, or a new active section imported by `LandingInteractiveSections`.

Required copy outcome:

- first screen: one surf call plus iOS action
- support: forecast -> surfer checks -> logs session -> model adjusts
- proof: real Quiver visuals, not generic AI language
- limits: no checkout, lifetime, or final App Store status claims beyond current verified truth

## Handoff To 03-03

03-03 should decide whether `app_store_preorder_*` becomes a status-neutral iOS CTA event name or stays as-is until Phase 7. It should also decide whether those events need `/api/events` support for internal launch reporting.

Any event change must preserve:

- anonymous/authenticated guards
- source and placement attribution
- destination URL
- no pre-auth signup events for authenticated users
- tests proving the events would fail if removed

## Handoff To 03-05

03-05 must include actual browser validation for:

- mobile hero CTA hit target
- desktop hero CTA hit target
- video/poster load path
- no overlapping text or CTAs
- SSR beach section/crawlability expectations
- authenticated user path does not show anonymous landing prompts
