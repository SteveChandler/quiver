# Summary 02-02: V1 Founding Offer Mechanics And Fallback

## Status

Complete - decision and constraints only.

## Completed

- Selected RevenueCat Web Billing as the intended v1 paid web path.
- Rejected direct Stripe Checkout as the v1 path unless RevenueCat Web Billing fails a later dashboard verification.
- Kept public web offer posture as waitlist-only until checkout and entitlement sync are proven.
- Preserved the earned founder path as a non-payment fallback after 02-03 defines eligibility.
- Chose signed-in-only web checkout for v1 to keep RevenueCat app user id aligned with Supabase `user_id`.
- Defined planned product classes for monthly Pro, annual Pro, founder lifetime Pro, and deferred standard lifetime Pro.
- Confirmed founder lifetime should be a paid one-time web product attached to the same `Quiver Pro` entitlement.
- Preserved the rule that beta/current users keep promotional Pro and are never auto-billed.
- Identified that paid founder lifetime replacement must be implemented explicitly instead of weakening promotional Pro protection.
- Added the implementation constraints 02-04 must inherit: product allowlist, `Quiver Pro` entitlement check, source/store/environment fields, paid-founder classification, append-only event history, RLS/service-role write boundary, and native `CustomerInfo` proof.

## Key Decisions

- Public pre-verification copy: `Founding Access Waitlist. Early members will get first access when plans open.`
- V1 billing path: RevenueCat Web Billing.
- Stripe role: gateway behind RevenueCat Web Billing only.
- V1 checkout identity: signed-in Supabase user only.
- Anonymous purchase/redemption: deferred.
- Manual paid lifetime grant: not public v1 fallback.
- Native web-checkout links: blocked until App Store/storefront policy review.

## Verification

- Refreshed official RevenueCat Web, Web Purchase Links, Web Billing product setup, RevenueCat entitlement, Apple App Review, and Supabase RLS references.
- Re-read 02-01 audit findings and Phase 2 context before deciding mechanics.
- Re-read Brand-Vault founding offer guidance and kept the public posture aligned with commitment/feedback-first launch guidance.
- No code, external configuration, production data, public copy, migration, or release change was made.

## Next Plan

02-03: Define beta/current-user founder-status handling and no-auto-billing rule.

## Approval Boundary

No RevenueCat dashboard, Stripe, App Store Connect, Vercel env, Supabase migration, production data, or public pricing copy changes were made.
