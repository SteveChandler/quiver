# App Store Components Architecture

## Purpose

`components/app-store/` owns iPhone-specific web install surfaces that route visitors to Apple's native install surfaces without mixing them into web checkout or pricing flows.

## Source Of Truth

- `lib/constants/app-store.ts` owns the shared App Store app id, App Store URL, CTA text, destination status, smart banner argument, and Android beta landing/group/contact constants.
- Browser install CTAs use the shared `https://go.quiversurf.app/app/handoff` URL with a per-click `handoff_id`. `/app-store?ct=...` remains a bookmark-compatible alias that server-mints an ID before redirecting to the handoff route. The handoff route and server-rendered Smart App Banner metadata use `IOS_APP_STORE_PROVIDER_TOKEN`; client bundles never read that environment variable directly.
- Apple campaign labels are deliberately limited to `web`, `email`, `partner_qr`, and `share` (one label for every shared beach or forecast-window link; the share id rides in `utm_content`); Quiver source/surface/placement/UTM fields retain their own higher-resolution attribution.
- Landing, forecast, final CTA, iPhone banner, and iOS CTA analytics read these constants instead of hardcoding destination copy.
- Android beta remains a separate web landing path. Web pricing and founding access copy must not imply Android closed-beta access is the same as the public iOS install path.

## Install Tap Event Contract

Route hits are not taps. A request to `/app` or `/app/handoff` is logged for measurement, but only a click event counts as a visitor choosing to install.

| Layer | Event | Written by | Means |
|---|---|---|---|
| `user_events` | `cta_click` (`cta_family` `ios_app` or `app_handoff`) | every install anchor `onClick`, via `trackIosAppCtaClick` | A tap on a web install CTA. This is the canonical tap |
| `user_events` | `invite_app_store_clicked` | invite and partner QR landing pages | Same, different surface |
| `user_events` | `app_handoff_link_opened` with `source = 'exact_call'` | `trackExactCallHandoffLinkOpened` | Exact-call tap. Unchanged |
| `user_events` | `app_handoff_link_opened` with `metadata.hit_kind = 'route_hit'` | `/app` server route | A request reached the route. Not a tap. `bot_flagged = true` for known bots, link-preview fetchers and prefetch |
| PostHog | `app_handoff_link_opened` (server) | `/app` server route | Same route hit, now carrying `traffic_class`, `hit_kind` and `bot_flagged`. The name is unchanged on purpose so existing insights keep receiving it; filter on `traffic_class` |
| `user_events` | `app_handoff_native_open` | native app | Joined to the tap by `handoff_id` |

Rules:

- The stored `user_events` event name `app_handoff_link_opened` is kept. No migration, CHECK-constraint change or view change is needed: `growth_app_handoff_v1` already excludes `bot_flagged` rows.
- Route-hit `traffic_class` is `known_bot`, `preview_fetcher`, `prefetch`, `human_candidate` or `unverified`. Only the first three set `bot_flagged`. `unverified` is stored but not flagged until a few days of data show whether it matches the daily crawler burst.
- Verified-tap rule: an iOS route hit is a confirmed store redirect only when its `handoff_id` equals the `handoff_id` of a click row. Click handlers mint the id in the browser at click time, so crawlers fetching the server-rendered href cannot match.
- Clicks include people who already have the app (universal links open it directly), so a tap is install intent or app open intent, not a confirmed install.
- Apple comparison is one-sided: our click-confirmed taps should be at or below App Store Connect Web Referrer product page views. Smart App Banner taps on Safari are visible to Apple but not to us, so the gap is expected and is reported, not alarmed on.
- New install anchors must write a click event. `__tests__/lib/analytics/install-cta-click-coverage.test.ts` fails when a file builds a handoff link without one.
- Known gaps (server-rendered anchors, no click row yet): the comparison page `/best-surf-forecast-app`, `/vs/surfline/free`, and the redeem install fallback.

Weekly queries: `docs/analytics/app-handoff-weekly-funnel.sql`.

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
- `HeroSection`, `ForecastSection`, and `CTASection` are landing components, but they share the same App Store constants and iOS CTA analytics helper.

## Asset Guidance

Use Brand-Vault before generating new app-store visuals:

- 6.7 App Store screenshots: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/quiver-native/docs/app-store-screenshots/6.7/*.png`
- 6.1 fallback screenshots: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/quiver-native/docs/app-store-screenshots/6.1/*.png`
- Landing hero source render: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/launch-video/renders/quiver-landing-hero.mp4`
- App icon source: `/Users/stevenchandler/Desktop/dev/Brand-Vault/logos/web/quiver-app-icon.png`

Recheck the live App Store page and iTunes lookup before changing `IOS_APP_STORE_DESTINATION_STATUS`.
