# Pricing Components Architecture

## Purpose

Pricing components render the public founding-access surface while checkout is still gated. They must stay conservative until RevenueCat Web Billing, entitlement mapping, and release copy are verified.

## Current Rules

- Runtime copy is waitlist-only.
- Do not render public prices, checkout links, or purchase availability.
- Do not imply App Store and web purchases are interchangeable.
- Pre-auth analytics must only fire for anonymous users.
- Authenticated users should see an opt-in status message, not another signup prompt.
- The pricing page can use Quiver sticker-sheet assets for zine texture, but
  those visuals must stay decorative and must not introduce pricing or checkout
  claims before RevenueCat Web Billing is verified.
- Lifetime Pro copy must be framed as the earned founding offer: log 5 surf
  sessions in Quiver to qualify for Pro for lifetime. Do not frame it as a
  live purchase path.

## Active Components

- `founding-offer-surface.tsx` renders the `/pricing` page content.
- `founding-access-cta.tsx` opens the auth modal for anonymous waitlist interest and suppresses pre-auth tracking for signed-in users.
- `landing-pricing-teaser.tsx` adds a restrained landing-page link to `/pricing`.
