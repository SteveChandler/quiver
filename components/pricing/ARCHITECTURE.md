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
- Email capture on `/android-beta` is optional and never gates the Google Group
  or Play opt-in links.
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
  instructions and optional email capture. Existing profile/lead records remain
  available for prior enrollment fulfillment, but they do not control access
  to the handoff links.
- `landing-pricing-teaser.tsx` adds a restrained landing-page link to `/plans`.
