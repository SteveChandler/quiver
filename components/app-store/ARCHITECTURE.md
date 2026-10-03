# App Store Components Architecture

## Purpose

`components/app-store/` owns iPhone-specific web install surfaces that route visitors to Apple's native install surfaces without mixing them into web checkout or pricing flows.

## Source Of Truth

- `lib/constants/app-store.ts` owns the shared App Store app id, App Store URL, CTA text, destination status, smart banner argument, and Android beta landing/group/contact constants.
- Browser install CTAs use the shared `https://go.quiversurf.app/app/handoff` URL with a per-click `handoff_id`. `/app-store?ct=...` remains a bookmark-compatible alias that server-mints an ID before redirecting to the handoff route. The handoff route and server-rendered Smart App Banner metadata use `IOS_APP_STORE_PROVIDER_TOKEN`; client bundles never read that environment variable directly.
- Apple campaign labels are deliberately limited to `web`, `email`, and `partner_qr`; Quiver source/surface/placement/UTM fields retain their own higher-resolution attribution.
- Landing, forecast, final CTA, iPhone banner, and iOS CTA analytics read these constants instead of hardcoding destination copy.
- Android beta remains a separate web landing path. Web pricing and founding access copy must not imply Android closed-beta access is the same as the public iOS install path.

## Current Status Check

Last checked: 2026-06-29 UTC from the 2026-06-28 SEO weekly report and live App Store URL spot-check.

- App Store page: HTTP 200 at `https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320`.
- SEO report snapshot: live title is `Surf Forecast: Quiver`, current iOS version is `1.0.1`, and the listing is live.
- Brand Vault now treats `Surf Forecast: Quiver` as the canonical iOS title. `Quiver: Personal Surf Forecast` is archived as a future ASO test candidate, not active listing copy.
- App Store page metadata serves live app state (`offerType=app`, `isPreorder=false`, button title `Get`), so public web CTAs use `Open App Store` with `app_store_live` analytics status.
- iOS is no longer routed through TestFlight prompts in web UX.
- Android closed testing routes through `/android-beta`, which unlocks the ordered Google Group → Play opt-in → install handoff after capturing the visitor's Google account email. The contact path remains available for access problems.

## Component Boundaries

- `IphoneAppBanner` renders only for eligible iPhone non-Safari browsers and suppresses itself for Safari so Apple's native smart banner can own the install affordance.
- Apple's native Smart App Banner owns Safari on iPhone and iPad; `IphoneAppBanner` owns non-Safari iPhone. The flagged beach sub-page `InstallAppCtaSection` serves only Safari iOS visitors with no in-page ask, derived from `getIphoneAppBannerDecision` so the two custom surfaces cannot both fire on that page.
- That exclusion is enforced by `shouldShowBeachSubPageInstallCta` (sub-pages, flag-gated + iOS-only) and by `iphoneBannerOwnsInstallAsk` (beach detail's after-tabs section, ungated, decided in the browser by `BeachDetailInstallCta` because beach detail HTML is shared at the CDN). Both derive from the same `getIphoneAppBannerDecision` call, so a change to the banner's browser rules moves both surfaces together. The beach-detail section is deliberately **not** flag-gated and **not** iOS-only — Android and desktop still receive it; only the non-Safari iPhone duplicate is suppressed.
- `InstallBar` (`install-bar.tsx`, mounted lazily by `StickyInstallAsk`) is the fixed-bottom install ask for **every iPhone visitor on any browser** on beach detail, `/water-temp/[city]` and city hub (`/beaches/[country]/[state]/[city]`) pages. It is off unless `NEXT_PUBLIC_INSTALL_BAR_ENABLED=true` (build-time, so changing it needs a redeploy; the CDN-shared HTML never depends on it). There is no split test: when the flag is on, every eligible visitor gets the bar.
- **One install ask at a time.** `lib/app-store/install-bar.ts` holds the shared client-side predicates (`getInstallBarOwnedSurface`, `installBarOwnsInstallAsk`, `iphoneInstallAskOwnedElsewhere`). Where the bar owns a page for a visitor it replaces the page's `StickySignupBar` (`StickyInstallAsk`; after dismissal the signup bar returns, sequentially), `IphoneAppBannerGate` stops mounting `IphoneAppBanner`, `BeachDetailInstallCta` renders nothing, and `HideWhenInstallBarOwns` drops the server-rendered `ContentPageAppHandoffCta`. All of these decide after mount, so the server HTML is identical for every visitor. As a safety net the bar also hides while any in-flow ask matching `INSTALL_ASK_SELECTORS` is on screen. Apple's Smart App Banner (Safari) is a meta tag we do not suppress.
- Clicks go through `trackIosAppCtaClick` with `placement=install_bar` and `surface` = `beach_detail | water_temp | city_hub` (a `cta_click` row in `user_events` plus PostHog `ios_app_cta_click`); `install_bar_view` and `install_bar_dismiss` are PostHog-only.

### Install bar readout (before/after, not a split test)

Pick a flag-flip timestamp and compare equal windows before and after (at least 4 weeks each; volume is small, so report counts, not rates):

- Taps: `cta_click` rows with `metadata->>'cta_family' = 'ios_app'` by `metadata->>'surface'` and `metadata->>'placement'`. Judge the sum over all install surfaces, so taps the bar takes from the in-page sections or the iPhone banner are netted out; `placement = 'install_bar'` shows how much came from the bar itself.
- Corroboration: App Store Connect, Analytics > Acquisition > Sources > Web Referrer, weekly Product Page Views and First-Time Downloads, same windows.
- Rule: a tap lift with no movement in web-referrer first-time downloads stays `shipped_unvalidated`. Safari taps on Apple's own banner are invisible to us, so the bar can look like a lift by absorbing them. Do not claim a return or retention effect: iOS installs cannot be tied back to a web visitor.
- Guardrails: signup bar views/clicks on the same pages (the bar displaces it for iPhone visitors), `install_bar_dismiss` rate, route p75 CLS/INP/LCP, JS errors.

- `HeroSection`, `ForecastSection`, and `CTASection` are landing components, but they share the same App Store constants and iOS CTA analytics helper.

## Asset Guidance

Use Brand-Vault before generating new app-store visuals:

- 6.7 App Store screenshots: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/quiver-native/docs/app-store-screenshots/6.7/*.png`
- 6.1 fallback screenshots: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/quiver-native/docs/app-store-screenshots/6.1/*.png`
- Landing hero source render: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/launch-video/renders/quiver-landing-hero.mp4`
- App icon source: `/Users/stevenchandler/Desktop/dev/Brand-Vault/logos/web/quiver-app-icon.png`

Recheck the live App Store page and iTunes lookup before changing `IOS_APP_STORE_DESTINATION_STATUS`.
