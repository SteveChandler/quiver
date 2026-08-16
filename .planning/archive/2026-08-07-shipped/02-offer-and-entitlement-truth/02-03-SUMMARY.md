# Summary 02-03: Beta And Current-User Founder Handling

## Status

Complete - decision and constraints only.

## Completed

- Defined beta/current users as protected users, not billable leads.
- Defined the no-auto-billing rule: no charge, subscription, paid conversion, or paid founder replacement without explicit checkout consent.
- Defined earned founder eligibility as at least five rated real completed sessions plus a captured feedback signal.
- Required earned lifetime fulfillment to be RevenueCat-first, because native unlock reads RevenueCat `CustomerInfo`.
- Preserved existing `rc_promo_` no-expiry Pro rows and kept current overwrite protection intact.
- Classified TestFlight/App Store sandbox purchases as test/native access evidence, not paid founder status or production billing consent.
- Defined that paid founder lifetime may replace promotional lifetime only after verified paid checkout and explicit replacement logic.
- Added production read-only cohort evidence for current real users, native users, rated-session users, protected promo rows, and sandbox Pro rows.

## Key Decisions

- Existing promotional lifetime users keep access.
- Current users can earn founder lifetime with five rated real completed sessions plus feedback.
- Earned founder grants require RevenueCat promotional `Quiver Pro` fulfillment and audit tracking.
- Supabase-only entitlement writes are not enough for native earned lifetime access.
- Sandbox/TestFlight purchases do not carry to production and cannot be treated as paid founder consent.
- Public paid pricing and broad lifetime sale copy remain blocked until 02-04 gates.

## Verification

- Refreshed RevenueCat API v1/v2 promotional entitlement and CustomerInfo references.
- Refreshed Apple In-App Purchase/TestFlight billing reference.
- Refreshed Supabase changelog and RLS reference.
- Re-read Phase 2 context, 02-01 audit, 02-02 mechanics, entitlement webhook code, entitlement resolver, migrations, and Brand-Vault founding crew docs.
- Ran production read-only checks in a `BEGIN READ ONLY` transaction.
- No code, external configuration, production data, public copy, migration, send, or release change was made.

## Next Plan

02-04: Write the implementation constraints for pricing copy and release gates.

## Approval Boundary

No RevenueCat dashboard/API grant, Stripe, App Store Connect, Vercel env, Supabase migration, production data, public pricing copy, native checkout link, outreach send, or release action was changed.
