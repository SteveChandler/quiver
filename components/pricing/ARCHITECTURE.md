# Pricing Components Architecture

## Purpose

Pricing components render the public `/plans` native-app availability surface. They must point iPhone surfers to Apple for install and subscription details, collect Android interest while Android is not public, and avoid separate web pricing until RevenueCat Web Billing, entitlement mapping, and release copy are verified.

## Current Rules

- Runtime copy routes iOS to the App Store and Android to the waitlist.
- Trial copy can mention the current 14-day App Store trial when it stays
  Apple-managed and does not hardcode plan amounts.
- High-level Pro benefits can appear here, but `/features` remains the fuller
  product marketing page.
- Do not render public prices, checkout links, or purchase availability.
- Do not imply App Store and web purchases are interchangeable.
- Pre-auth signup analytics must only fire for anonymous users.
- Authenticated users should be able to confirm Android interest without seeing another signup prompt.
- The plans page can use Quiver sticker-sheet assets for zine texture, but
  those visuals must stay decorative and must not introduce pricing or checkout
  claims before RevenueCat Web Billing is verified.
- Do not put plan amounts on the web plans page. Point iPhone surfers to the
  App Store for current Apple-managed details.

## Active Components

- `founding-offer-surface.tsx` renders the `/plans` page content.
- `founding-access-cta.tsx` chooses the signed-in vs anonymous Android waitlist wrapper.
- `android-waitlist-cta.tsx` stores anonymous Android intent through signup, then confirms the profile flag after auth.
- `landing-pricing-teaser.tsx` adds a restrained landing-page link to `/plans`.
