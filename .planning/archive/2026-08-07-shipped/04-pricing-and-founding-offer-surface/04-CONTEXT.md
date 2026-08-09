# Phase 4 Context: Pricing And Founding Offer Surface

## Status

Complete as a waitlist-safe implementation.

Phase 2 proved that public pricing must stay gated until RevenueCat Web Billing, product semantics, entitlement sync, and policy gates are verified. Phase 4 therefore shipped the public pricing route and landing integration without prices, checkout links, lifetime purchase claims, or App Store/web entitlement claims.

## Implemented Surface

- `/pricing` renders a server-first public page with WebPage schema and canonical metadata.
- `components/pricing/founding-offer-surface.tsx` explains Founding Access Waitlist status, beta protection, and the forecast -> check -> log -> adjust loop.
- `components/pricing/founding-access-cta.tsx` opens the signup modal for anonymous visitors with pricing attribution and suppresses pre-auth CTA events for signed-in users.
- `components/pricing/landing-pricing-teaser.tsx` adds a founding-access teaser near the active landing final CTA.
- `app/sitemap.ts` includes `/pricing`.

## Guardrails Preserved

- No public prices.
- No checkout link or purchase language.
- No monthly, annual, or lifetime availability claim.
- No claim that web purchases unlock native Pro.
- No claim that beta users become paid founders automatically.
- Beta users are told they will not be charged automatically and existing beta access will not be removed because pricing launches.

## Verification Evidence

- Scoped ESLint passed for pricing route/components/tests, sitemap, and new E2E.
- Targeted Jest passed for pricing CTA, pricing surface, landing teaser, pricing page metadata/schema, and sitemap.
- Targeted guest Playwright passed for `/pricing` and the landing teaser link.
- Node 22 typecheck passed.
- `VERCEL_ENV=preview` build passed.
- Desktop and mobile visual captures passed with no horizontal overflow.

## Next

Phase 5 starts with blog platform expansion inspection. The real pay scale and lifetime purchase language remain blocked until the payment release gate is verified.
