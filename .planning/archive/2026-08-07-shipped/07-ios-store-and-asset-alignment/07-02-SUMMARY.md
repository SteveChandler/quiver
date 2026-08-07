# Summary 07-02: iOS Constants And Copy Update

## Completed

- Changed `IOS_APP_STORE_CTA` from `Download Quiver` to `Open App Store`.
- Changed `IOS_APP_STORE_DESTINATION_STATUS` from `app_store_listing` to `app_store_preorder` to match Apple's current live offer metadata.
- Removed stale `app-store-preorder` variant support from `CTASection` and the older composed landing component call site.
- Updated `HeroSection` to render the visible CTA label as a live overlay sourced from `IOS_APP_STORE_CTA`, covering the baked media button label.
- Added `__tests__/lib/constants/app-store.test.ts` for the shared iOS source of truth.

## Result

Public web CTAs now point to the App Store listing without claiming a completed download path before Apple flips the offer state from preorder to live download.
