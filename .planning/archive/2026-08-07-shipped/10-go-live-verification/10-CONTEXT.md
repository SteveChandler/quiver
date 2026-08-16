# Phase 10 Context: Go-Live Verification

## Goal

Validate the launch campaign code and release gates before any commit, push,
deployment, outbound send, App Store action, RevenueCat action, or production
mutation.

## Verification Scope

- Local routes: `/`, `/pricing`, `/blog`, and
  `/blog/why-quiver-is-built-around-one-surf-call`.
- Local guest E2E: Apple beta prompt, blog analytics, and pricing.
- Local build: `VERCEL_ENV=preview yarn build`.
- Live checks: App Store listing, iTunes lookup, TestFlight public beta link,
  and deployed `www`/`dev` pricing route status.

## Key Findings

- Local launch routes render on desktop and mobile with no horizontal overflow.
- Local pricing copy remains waitlist-only and has no monthly, annual,
  lifetime, checkout, buy-now, or dollar-price claims.
- Local blog cross-link analytics emits `cta_family=launch_blog_cross_link`.
- App Store lookup returns `Surf Forecast: Quiver`, version `1.0`, bundle
  `app.quiversurf.mobile`, release date `2026-05-25T07:00:00Z`.
- App Store listing is HTTP 200 and no longer exposes `offerType=preorder`, but
  the exact iTunes release timestamp is still the release truth gate.
- TestFlight public link is HTTP 200 and still shows the beta join page.
- Deployed `www.quiversurf.app/pricing` and `dev.quiversurf.app/pricing` return
  404, so launch routes are code-ready locally but not live until a deploy
  updates the Vercel aliases.
