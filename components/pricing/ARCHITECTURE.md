# Pricing Components Architecture

## Purpose

Pricing components render the public `/plans` native-app availability surface. They must point iPhone surfers to Apple for install and subscription details, frame Android as an open Google Play closed beta, and avoid separate web pricing until RevenueCat Web Billing, entitlement mapping, and release copy are verified.

## Current Rules

- Runtime copy routes iOS to the App Store and every public Android CTA to the
  canonical `/android-beta` guided handoff.
- Trial copy can mention the current 14-day App Store trial when it stays
  Apple-managed and does not hardcode plan amounts.
- High-level Pro benefits can appear here, but `/features` remains the fuller
  product marketing page.
- Do not render public prices, checkout links, or purchase availability.
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
  instructions and required Google-account email capture. Existing profile/lead
  records remain available for prior enrollment fulfillment, while new handoffs
  are tied to the captured visitor session.
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
