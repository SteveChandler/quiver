# Go-Live Checklist

## Ready Locally

- Landing route renders locally and uses `Open App Store`.
- Pricing route renders locally and stays waitlist-only.
- Blog hub and launch posts render locally with launch page-view and cross-link
  click metadata.
- App Store CTA, pricing CTA, blog, sitemap, and launch analytics unit coverage
  passed.
- Guest Apple prompt, pricing, and blog analytics E2E coverage passed.
- `VERCEL_ENV=preview yarn build` passed and includes `/pricing`, `/blog`, and
  all three blog post routes.

## Live Truth

- App Store listing: HTTP 200.
- iTunes lookup: `Surf Forecast: Quiver`, version `1.0`, bundle
  `app.quiversurf.mobile`, release timestamp `2026-05-25T07:00:00Z`.
- TestFlight public link: HTTP 200 and beta page available.
- Deployed `www.quiversurf.app/pricing`: HTTP 404.
- Deployed `dev.quiversurf.app/pricing`: HTTP 404.

## Blockers Before Public Claim

- Do not claim `/pricing` is live on production until a deployment updates the
  Vercel aliases and the route returns 200.
- Do not claim App Store release is fully live until a post-`2026-05-25T07:00:00Z`
  check confirms the listing state.
- Do not publish monthly, annual, lifetime, checkout, or cross-platform purchase
  claims until RevenueCat Web Billing, product semantics, entitlement sync,
  webhook filtering, and native unlock are verified end to end.

## Approval-Gated Actions

- Commit and push.
- Vercel deployment or alias promotion.
- Production database migration or mutation.
- RevenueCat product, entitlement, webhook, or checkout change.
- App Store Connect metadata, price, availability, or release action.
- Outbound email, DM, social post, Reddit comment/post, or tracker write.
- Manual entitlement grant or founder lifetime status change.

## Recheck Commands

```bash
curl -fsS "https://itunes.apple.com/lookup?id=6759300320&country=us"
curl -I -L "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320"
curl -I -L "https://testflight.apple.com/join/G31D4XW6"
curl -I -L "https://www.quiversurf.app/pricing"
curl -I -L "https://dev.quiversurf.app/pricing"
```
