# Web → app handoff via `go.quiversurf.app`

## Flow

In words: a web CTA creates a fresh UUID, sends the user to
`https://go.quiversurf.app/app/handoff`, and records the same `handoff_id` in
the web click event. Installed iOS builds open the universal link and emit
`app_handoff_native_open`. Without the app, the web handoff page records the
redirect and sends iOS visitors to the App Store (or Android visitors to the
Android beta page). Desktop visitors see the QR/email handoff page.

The join key across web click, web redirect, and native open is `handoff_id`.

## W5 inventory (2026-09-18)

The source inventory was checked with:

```bash
rg -n -S --glob '!node_modules/**' --glob '!__tests__/**' --glob '!e2e/**' \
  '(apps\.apple\.com|play\.google\.com|quiver://|/app-store|app/handoff)' \
  app components lib actions scripts config
```

| Surface | Entry point | W5 status | Attribution path |
| --- | --- | --- | --- |
| Shared iOS CTA spine | `NativeAppFunnelCta` → `IosAppStoreCta` | Tracked | Click mints `handoff_id` and opens `go.quiversurf.app/app/handoff`; Android uses its beta attribution path; desktop uses the QR/email handoff. |
| Landing hero, nav, platform strip, interactive sections, download page | `NativeAppFunnelCta` | Tracked before W5 | All device-aware CTAs use the shared spine. |
| Landing final CTA and forecast section | `CTASection`, `ForecastSection` | Fixed in W5 | Existing `createClientAppHandoffLink` now supplies the click URL and the same ID to `ios_app_cta_click`. |
| Features, SEO content, city/beach pages, learn pages, session/post-session surfaces | `IosAppStoreCta`, `ContentPageAppHandoffCta`, `InstallAppCtaSection` | Tracked | Shared builder and per-click `handoff_id`; no direct store CTA remains in these components. |
| Plans/founding offer and `/app/spot/[slug]` fallback | `FoundingOfferSurface`, `AppSpotHandoffPage` | Fixed in W5 | Uses `IosAppStoreCta`; click opens the go-host handoff with source/surface/placement. |
| Desktop QR and email handoff | `SendToPhoneCta`, `/app/handoff`, `/api/app-link-email` | Tracked before W5 | QR/email share the generated ID; the “Open App Store anyway” fallback now uses the go-host builder and mints a fresh click ID. |
| Legacy `/app-store` bookmark/shortcut | `app/app-store/route.ts` | Fixed in W5 | Keeps the URL working, but server-mints a UUID and redirects to `/app/handoff` with source/surface/placement and normalized campaign. |
| iPhone custom banner | `IphoneAppBanner` | Fixed in W5 | Click mints a UUID and sends it in the banner event and go-host URL. |
| Safari Smart App Banner | `app/layout.tsx` → `apple-itunes-app` | Platform limitation retained | `app-argument` is now `https://go.quiversurf.app/app/handoff?...&surface=smart_banner`; Safari controls the click and cannot carry a per-click ID. |
| App Links metadata | `app/page.tsx` → `appLinks.ios.url` | Fixed in W5 | Points at a go-host handoff URL with `surface=metadata`; metadata itself cannot mint a click ID, while a request to the URL is handled by the tracked route. |
| Comparison-page Quiver source link | `/best-surf-forecast-app` | Fixed in W5 | Visible source link uses `/app-store` compatibility routing; JSON-LD keeps the canonical App Store listing URL for search metadata. |
| Android handoff/install | `AndroidWaitlistCta`, `/app/handoff` Android branch, `/android-beta` | Preserved | Handoff lands on `/android-beta`; the install action calls `/api/install-attribution/issue` and adds the existing short-lived token as Play `referrer`. |
| Android tester group and closed-test opt-in | `/android-beta`, Android beta email | Intentional exception | These are prerequisite Google Group/closed-test links, not the final Play install listing; they remain direct so tester access continues to work. The final install link remains tokenized. |
| Partner/invite QR landing pages | `/p/[partnerCode]`, `/invite/[token]` | iOS path fixed in W5 | QR opens the landing page; its iOS CTA uses the shared go-host builder. The “already have the app” action remains a route-specific `quiver://` deep link so partner/invite context is not lost. |
| Route-specific native links | invite/partner deep links, session bridge, offer/settings links | Preserved intentionally | These carry native-only payloads (`invite`, partner code, session data, or settings). Replacing them with generic `/app/handoff` would drop context; changing them requires a native handoff payload contract. |
| Store destination constants and server consumers | `lib/constants/app-store.ts`, install-attribution server, Android mailer | Source of truth | The iOS listing URL and Play URLs remain centralized. They are final destinations or Play attribution inputs, not client-side generic CTA shortcuts. |

Hard-coded third-party competitor/store-reference URLs in SEO audit tooling and
comparison evidence are not Quiver acquisition CTAs and are excluded from the
handoff funnel. The remaining direct Quiver native schemes are the
route-specific exceptions listed above.

## Events and funnel

- Web CTA: `cta_click` or the existing `ios_app_cta_click`, with
  `handoff_id`; QR/email surfaces also emit their existing
  `app_handoff_*` events with the same ID.
- Redirect: `app_handoff_link_opened`, server-side in PostHog and Supabase,
  with `handoff_id`, `source`, `surface`, `placement`, `host`, `platform`,
  `ua_family`, and any `utm_*` values.
- Native: `app_handoff_native_open`, with `handoff_id`, `source`, `surface`,
  `placement`, `utm_campaign`, and `native_install_id`.

PostHog funnel: count unique `handoff_id` on web CTA events →
`app_handoff_link_opened` → `app_handoff_native_open`, split by `source`,
`surface`, `placement`, and `platform`. Do not treat App Store campaign totals
as person-level joins.

## Production steps

1. Add `go.quiversurf.app` to the Vercel production project
   `v0-prd-design-concept`.
2. Add the DNS record for `go.quiversurf.app`.
3. Verify
   `https://go.quiversurf.app/.well-known/apple-app-site-association` returns
   HTTP 200, `application/json`, and no redirect.
4. Verify Apple's CDN check at
   `https://app-site-association.cdn-apple.com/a/v1/go.quiversurf.app`.
