# Summary 03-03: iOS CTA And Event Normalization

## Status

Complete.

## Completed

- Removed active `pre-order` / `app_store_preorder_*` references from app code, tests, and the current changelog entry.
- Centralized App Store listing copy in `lib/constants/app-store.ts` with `IOS_APP_STORE_URL`, `IOS_APP_STORE_CTA`, and `IOS_APP_STORE_DESTINATION_STATUS`.
- Added `trackIosAppCtaView` and `trackIosAppCtaClick` so public analytics use `ios_app_cta_view` / `ios_app_cta_click` while internal reporting receives existing anonymous-allowed `cta_impression` / `cta_click` events.
- Updated landing hero, forecast CTA, final CTA, metadata app links, PBSC links, and the iPhone app banner to use the normalized constants and destination metadata.
- Preserved authenticated-user landing guards and kept pre-auth signup events on their existing signup-only path.
- Added focused Jest coverage for the CTA helper and updated landing/app-store component tests.
- Ran local desktop and mobile visual review against `http://localhost:3000`; no DOM-visible pre-order copy, console errors, or page errors were found.

## Preserved

- Pricing, checkout, lifetime, RevenueCat Web Billing, cross-platform unlock, and purchase claims remain blocked.
- App Store/TestFlight live status verification remains Phase 7.
- No Supabase migrations, env changes, RevenueCat dashboard changes, production data changes, outbound sends, commits, or pushes were made.
- The existing hero poster/video assets were reused; the CTA constant stays aligned to the baked "Download Quiver" hero button.

## Validation

- `git diff --check` passed for touched files.
- Scoped ESLint passed for touched TypeScript/TSX files.
- Targeted Jest passed: 7 suites, 29 tests.
- `corepack yarn typecheck` passed.
- Local Playwright visual script passed for desktop and mobile CTA checks.
- Targeted Playwright guest landing checks passed: smoke plus ML showcase mobile/desktop.

## Next Plan

03-04: Validate visuals with Brand-Vault or current app screenshots.

## Approval Boundary

No App Store/TestFlight setup, RevenueCat dashboard changes, env changes, Supabase migrations, production data, pricing/founding-offer UI, outbound messaging, commits, or pushes were made.
