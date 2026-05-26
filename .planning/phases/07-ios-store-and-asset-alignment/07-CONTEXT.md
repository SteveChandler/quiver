# Phase 7 Context: iOS Store And Asset Alignment

## Status

In progress.

Phase 7 aligns the web iOS CTA source of truth with the current live Apple surfaces and documents the Brand-Vault assets that should back App Store, landing, and launch campaign visuals.

## Live Status

Checked on 2026-05-24 UTC:

- App Store URL returned HTTP 200: `https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320`.
- iTunes lookup returned one result for `Surf Forecast: Quiver`, version `1.0`, bundle id `app.quiversurf.mobile`, release date `2026-05-25T07:00:00Z`.
- The App Store page still served preorder offer metadata (`offerType=preorder`, `isPreorder=true`, expected release date 2026-05-25).
- TestFlight URL returned HTTP 200 and still displays `Join the Surf Forecast: Quiver beta`.

## Source Of Truth

- `lib/constants/app-store.ts` owns the App Store app id, URL, CTA, destination status, smart banner argument, TestFlight URL, and TestFlight CTA.
- Landing, final CTA, iPhone banner, and analytics surfaces should import from that file.
- Public web pricing remains waitlist-only and separate from native App Store/TestFlight purchase language.

## Asset Sources

- App Store screenshots: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/quiver-native/docs/app-store-screenshots/6.7/*.png`
- App Store screenshot fallback set: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/quiver-native/docs/app-store-screenshots/6.1/*.png`
- Landing hero source render: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/launch-video/renders/quiver-landing-hero.mp4`
- App icon source: `/Users/stevenchandler/Desktop/dev/Brand-Vault/logos/web/quiver-app-icon.png`

## Guardrails

- Do not claim the web tap downloads the app while Apple's live offer metadata still says preorder.
- Do not imply TestFlight sandbox purchases carry into App Store production purchases.
- Do not publish web monthly, annual, lifetime, checkout, or cross-platform unlock claims until the Phase 2 pricing gates are verified.
- Recheck Apple status before changing `app_store_preorder` to a live listing/download status.
