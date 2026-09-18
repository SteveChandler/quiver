# Web → app handoff via `go.quiversurf.app`

## Flow

In words: a web CTA creates a fresh UUID, sends the user to
`https://go.quiversurf.app/app/handoff`, and records the same `handoff_id` in
the web click event. Installed iOS builds open the universal link and emit
`app_handoff_native_open`. Without the app, the web handoff page records the
redirect and sends iOS visitors to the App Store (or Android visitors to the
Android beta page). Desktop visitors see the QR/email handoff page.

The join key across web click, web redirect, and native open is `handoff_id`.

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
