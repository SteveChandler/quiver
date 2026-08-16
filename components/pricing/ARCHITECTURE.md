# Pricing Components Architecture

## Purpose

Pricing components render the public `/plans` acquisition and purchase surface. They point iPhone surfers to Apple for install and subscription details, frame Android as an open Google Play closed beta, and expose verified RevenueCat web checkout only after the production configuration is verified.

## Current Rules

- Runtime copy routes iOS to the App Store and every public Android CTA to the
  canonical `/android-beta` guided handoff.
- Trial copy can mention the current 14-day App Store trial when it stays
  Apple-managed and does not hardcode plan amounts.
- High-level Pro benefits can appear here, but `/features` remains the fuller
  product marketing page.
- `NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL` must be an HTTPS production
  RevenueCat Web Purchase Link or published Funnel URL. Purchase Links receive
  the signed-in Supabase user ID as a URL-encoded App User ID path segment;
  Funnels receive the signed-in ID as the encoded `app_user_id` query parameter
  and carry it into checkout. Both modes fail closed for missing, malformed, or
  non-HTTPS configuration.
- Do not render public prices or purchase availability without the
  corresponding verified RevenueCat configuration. Anonymous visitors are
  sent to sign in before an identified web checkout link is exposed.
- Do not imply App Store and web purchases are interchangeable.
- Pre-auth signup analytics must only fire for anonymous users.
- The Google account email on `/android-beta` is required before the Google
  Group, Play opt-in, or QR handoff links unlock.
- The plans page can use Quiver sticker-sheet assets for zine texture, but
  those visuals must stay decorative and must not introduce pricing or checkout
  claims before RevenueCat Web Billing is verified.
- Do not put plan amounts on the web plans page. Point iPhone surfers to the
  App Store for current Apple-managed details.

## Active Components

- `founding-offer-surface.tsx` renders the `/plans` page content.
- `founding-access-cta.tsx` chooses the signed-in vs anonymous Android beta wrapper.
- `android-waitlist-cta.tsx` preserves the shared acquisition CTA API while
  routing anonymous and authenticated visitors to `/android-beta` with source,
  surface, placement, auth-state, and destination analytics.
- `/android-beta` owns the ordered Google Group → Play opt-in → install
  instructions and required Google-account email capture. Canonical
  `android_waitlist_entries` records own enrollment state, while
  `android_beta_leads` remains the sendable-address book. Signed-in CTA status
  is read through the private, no-store `/api/android-beta/status` endpoint.
- Once the handoff is unlocked, `/android-beta` requests a short-lived,
  single-use attributed Play Store link. The browser sends only the bounded
  source, surface, placement, and campaign dimensions; identity is not bound to
  the install token.
- Public Android acquisition copy leads with current product value and does not
  promise free Pro, founding pricing, or queue priority. Earlier incentive
  eligibility is handled through
  [`docs/android-beta-legacy-offer-runbook.md`](../../docs/android-beta-legacy-offer-runbook.md),
  not public copy; tester identities remain in the private fulfillment ledger.
- `landing-pricing-teaser.tsx` adds a restrained landing-page link to `/plans`.
