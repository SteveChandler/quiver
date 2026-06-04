# App Store Components Architecture

## Purpose

`components/app-store/` owns iPhone-specific web install surfaces that route visitors to Apple's native install surfaces without mixing them into web checkout or pricing flows.

## Source Of Truth

- `lib/constants/app-store.ts` owns the shared App Store app id, App Store URL, CTA text, destination status, smart banner argument, and Android beta landing/group/contact constants.
- Landing, forecast, final CTA, iPhone banner, and iOS CTA analytics read these constants instead of hardcoding destination copy.
- Android beta remains a separate web landing path. Web pricing and founding access copy must not imply Android closed-beta access is the same as the public iOS install path.

## Current Status Check

Last checked: 2026-06-03 UTC.

- App Store page: HTTP 200 at `https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320`.
- iTunes lookup: `trackName` is `Surf Forecast: Quiver`, `version` is `1.0`, and `releaseDate` / `currentVersionReleaseDate` are `2026-05-25T07:00:00Z`.
- App Store page metadata serves live app state (`offerType=app`, `isPreorder=false`, button title `Get`), so public web CTAs use `Open App Store` with `app_store_live` analytics status.
- iOS is no longer routed through TestFlight prompts in web UX.
- Android closed testing now routes through `/android-beta`, which points testers to the Google Group gate and `steven@quiversurf.app` contact path until a public tester install URL exists.

## Component Boundaries

- `IphoneAppBanner` renders only for eligible iPhone non-Safari browsers and suppresses itself for Safari so Apple's native smart banner can own the install affordance.
- `HeroSection`, `ForecastSection`, and `CTASection` are landing components, but they share the same App Store constants and iOS CTA analytics helper.

## Asset Guidance

Use Brand-Vault before generating new app-store visuals:

- 6.7 App Store screenshots: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/quiver-native/docs/app-store-screenshots/6.7/*.png`
- 6.1 fallback screenshots: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/quiver-native/docs/app-store-screenshots/6.1/*.png`
- Landing hero source render: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/launch-video/renders/quiver-landing-hero.mp4`
- App icon source: `/Users/stevenchandler/Desktop/dev/Brand-Vault/logos/web/quiver-app-icon.png`

Recheck the live App Store page and iTunes lookup before changing `IOS_APP_STORE_DESTINATION_STATUS`.
