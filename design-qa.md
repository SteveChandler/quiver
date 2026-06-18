# Landing + Download Zine Design QA

Date: 2026-06-17

## Reference Use

- Reference: `https://dispersedapp.com/`
- Used as structural inspiration only: direct app-download hero, short proof band, product feature sections, and repeated download CTA.
- No Dispersed copy, images, logos, app screenshots, icons, or brand assets were copied.

## Quiver Fit

- Anonymous `/` now uses Quiver's beach-ID/zine visual system: mastheads, paper sheets, stickers, halftone photo, tape, notebook panels, and hand arrow treatment.
- Product claims are defensible and specific: `10-day forecasts`, `Every 3 hours`, and `1-tap session logging`.
- Desktop download CTAs render the send-to-phone/QR handoff inside dark zine cards, with App Store fallback links and Android beta links.
- Mobile download CTAs collapse to direct App Store buttons plus Android beta links.
- `/app` remains the app handoff route; the new pages use the existing `NativeAppFunnelCta` wrapper rather than replacing the attribution path.

## Visual QA

Captured screenshots:

- `test-results/landing-download-zine/guest-home-desktop.png`
- `test-results/landing-download-zine/guest-home-mobile.png`
- `test-results/landing-download-zine/download-desktop.png`
- `test-results/landing-download-zine/download-mobile.png`

Checks completed:

- Guest `/` desktop: zine pages are centered, above-the-fold CTA is visible, no Dispersed assets/copy are present.
- Guest `/` mobile: hero copy, App Store CTA, Android beta link, product proof, feature cards, walkthrough, and final CTA stack without text overlap.
- `/download` desktop: app screenshot, send-to-phone CTA, feature screenshots, platform notes, and final CTA are visible and aligned.
- `/download` mobile: App Store CTAs, Android beta links, screenshots, and footer remain readable without horizontal overflow.

Blocked:

- Authenticated `/` screenshot could not be captured locally because the configured `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` credentials fail Supabase login with `Invalid login credentials`.

## Claim QA

- Production read-only check against `enhanced_forecasts` on 2026-06-17T20:19:04.257Z found future rows through `2026-06-29T15:00:00+00:00`, a sampled horizon of 11.78 days.
- The sampled beach had 95 future forecast rows from `2026-06-17T21:00:00+00:00` through `2026-06-29T15:00:00+00:00`; all 94 adjacent row deltas were exactly 3 hours.
- This supports the public claims `10-day forecasts` and `Every 3 hours`.

## Remaining Notes

- The branch includes an existing migration, `supabase/migrations/20260616120000_add_app_handoff_events.sql`, for app handoff analytics event types. Target environments need that migration applied before release; otherwise desktop QR/send-to-phone event inserts will be rejected by `user_events_event_type_check`.
