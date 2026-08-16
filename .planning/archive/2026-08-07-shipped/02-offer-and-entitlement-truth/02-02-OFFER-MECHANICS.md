# 02-02 V1 Founding Offer Mechanics

## Executive Decision

Quiver's v1 paid web path should be RevenueCat Web Billing, not direct Stripe checkout. The public website remains waitlist-only until RevenueCat Web Billing products, checkout identity, webhook mirroring, and native entitlement visibility are proven end to end.

The v1 founding offer is therefore a hybrid:

1. **Public path now:** Founding Access Waitlist.
2. **Earned founder path:** early users can earn founder status through the product loop after 02-03 defines the beta/current-user rule.
3. **Paid founder path:** RevenueCat Web Billing only after checkout, webhook, Supabase mirror, native RevenueCat, and policy gates are proven.

## Public State Before Verification

Use one public offer:

> Founding Access Waitlist. Early members will get first access when plans open.

Allowed before checkout verification:

- Waitlist or interest CTA.
- No prices.
- No tier names.
- No live checkout claim.
- No lifetime purchase claim.
- No cross-platform unlock claim.
- No direct Stripe claim.
- No manual grant claim.

This remains the Phase 3 and Phase 4 default unless a later Phase 2 plan proves checkout and entitlement sync.

## Intended V1 Billing Path

Selected path:

1. RevenueCat Web Billing owns web products, prices, purchase UI, lifecycle, customer portal, emails, and subscription management.
2. Stripe is only the payment gateway behind RevenueCat Web Billing.
3. Quiver does not build direct Stripe Checkout for v1.
4. RevenueCat remains the entitlement source for both web and native paid access.
5. Supabase `user_entitlements` remains the backend mirror used by server-side web/API gates.

Default fallback path:

1. If RevenueCat Web Billing is not ready, the website ships a waitlist/interest flow only.
2. No paid manual lifetime grants are offered publicly.
3. Native App Store/TestFlight purchases may remain their own path, but website founding lifetime stays closed.

## Fallback Ladder

### Fallback A: Waitlist-Only Launch

Use if any checkout, entitlement, App Store policy, or native unlock gate is still incomplete.

- Public CTA remains Founding Access Waitlist.
- Capture intent without charging users.
- Do not show plan names or prices.
- Do not imply a purchase has reserved lifetime access.
- Use only the approved timing line: "Early members will get first access when plans open."

This is the default fallback for the three-week release window.

### Fallback B: Earned Founder Access

Use after 02-03 defines beta/current-user handling.

- Existing and early users can earn founder status through the product loop, such as logging rated sessions and giving feedback.
- No user is charged.
- Existing promotional Pro rows stay protected.
- Any manual grant remains approval-gated and must preserve an audit trail.
- Public copy can talk about joining early and helping shape Quiver, but not paid lifetime purchase.

### Fallback C: Private Manual Paid Founder Access

Avoid for v1 unless RevenueCat Web Billing is blocked and the user explicitly approves a separate operations plan.

Required before this is allowed:

- Written payment, refund, tax, and fulfillment owner.
- Per-user ledger with payment reference, Supabase user id, RevenueCat app user id, grant id, grant reason, and support contact.
- Manual RevenueCat grant proof that native `CustomerInfo` unlocks.
- Public copy reviewed for policy and support risk.

This fallback is riskier than waitlist because money collection and entitlement fulfillment become operationally coupled by hand.

## Purchase Identity Model

V1 paid checkout should require a signed-in Quiver account before purchase.

Rationale:

- Supabase `user_id` can be passed to RevenueCat as the app user id.
- Existing webhook code already expects `event.app_user_id` or `event.original_app_user_id` to map to an auth user.
- This avoids anonymous purchase redemption complexity during launch.
- It reduces support risk around mismatched email, Apple relay, TestFlight, and web account states.

Deferred:

- Anonymous web checkout.
- RevenueCat Redemption Links.
- Purchasing before account creation.
- Gift purchases.
- Team or school purchases.

## Planned Product Classes

These are planning identifiers, not approved dashboard products.

| Product class | Planning id | Billing model | Public before verification |
|---|---|---|---|
| Monthly Pro | `quiver_pro_web_monthly` | RevenueCat Web Billing subscription | Hidden |
| Annual Pro | `quiver_pro_web_annual` | RevenueCat Web Billing subscription | Hidden |
| Founding Lifetime Pro | `quiver_pro_web_founder_lifetime` | RevenueCat Web Billing one-time non-subscription product attached to `Quiver Pro` | Hidden |
| Standard Lifetime Pro | `quiver_pro_web_lifetime` | Later one-time non-subscription product or deferred reference | Hidden unless Phase 4 needs post-offer copy |

Product id rules for later implementation:

- Keep web product ids distinct from native App Store and Play product ids.
- Attach every paid product to the same RevenueCat entitlement id: `Quiver Pro`.
- Add a local product allowlist before accepting webhook events as paid access.
- Treat founder lifetime and promotional lifetime as different classes even though both may have no expiry.

## Founding Lifetime Mechanics

The founding lifetime offer should be a paid web one-time product that unlocks `Quiver Pro` without expiry after verified purchase.

Rules:

- It must not be sold until end-to-end sync is proven.
- It should be separate from App Store purchase mechanics.
- It should use the same RevenueCat `Quiver Pro` entitlement.
- It should unlock backend/web gates through `user_entitlements`.
- It should unlock native through RevenueCat `CustomerInfo`.
- It should have an explicit founder classification in local mirror logic or schema.

Do not infer founder status from `expires_at=null` alone.

## Required Local Implementation Constraints

These are not approved to implement in 02-02, but 02-04 should carry them into the release-gate plan.

1. Add a RevenueCat product allowlist for all purchase events that can mutate `user_entitlements`.
2. Require RevenueCat webhook events to include `Quiver Pro` in `entitlement_ids` before granting Pro.
3. Store purchase source, store, environment, event id, product id, and product class in the entitlement mirror.
4. Classify products separately as native subscription, web subscription, paid founder lifetime, and promotional lifetime.
5. Preserve promotional lifetime rows by default.
6. Allow promotional lifetime to be replaced only by an explicitly recognized paid founder lifetime event for the same user.
7. Add append-only successful entitlement event history, not just latest `rc_raw` and failure DLQ.
8. Keep RLS enabled and restrict writes to service-role/server paths.
9. Add tests that prove invalid products, missing entitlements, sandbox/prod mismatches, duplicate events, and promo replacement behavior.
10. Keep native `SubscriptionProvider` and RevenueCat `CustomerInfo` as the native unlock proof.

## Existing Beta And Current Users

02-02 selects the mechanics, while 02-03 owns the final eligibility rule.

Interim rule:

- Existing beta/current users keep their current promotional Pro access.
- No existing user is auto-billed.
- No existing user loses promotional Pro because pricing launches.
- If an existing user later buys paid founder lifetime, that paid purchase should replace promotional Pro with a founder lifetime classification.

Required implementation implication:

- Current merge logic blocks non-promotional updates from overwriting lifetime promotional Pro.
- Later implementation must add an explicit paid-founder-lifetime replacement path instead of weakening promotional Pro protection globally.

## Required Go/No-Go Tests Before Sales

Selling lifetime is blocked until all pass:

1. RevenueCat Web Billing product and price exist for monthly, annual, and founder lifetime.
2. Stripe gateway/tax/account requirements are configured for RevenueCat Web Billing.
3. Web checkout can start only for a signed-in Supabase user.
4. RevenueCat event arrives with the expected app user id.
5. Webhook accepts only allowlisted products attached to `Quiver Pro`.
6. `user_entitlements` records correct source, product, lifetime/founder class, expiry, and raw event history.
7. Web/backend paid gates resolve premium.
8. Native RevenueCat `CustomerInfo` resolves `Quiver Pro` for the same user.
9. Restore/refresh behavior works on native.
10. Cancellation, billing issue, expiration, and non-renewing lifetime events are understood and tested.
11. Promotional Pro users are not downgraded by subscription events.
12. Paid founder lifetime can intentionally replace promotional Pro.

## Approval-Gated Work

Requires explicit approval:

- RevenueCat Web Billing setup.
- RevenueCat product, offering, package, purchase link, portal, lifecycle email, or entitlement edits.
- Stripe gateway, tax, account, or payment-method setup for RevenueCat Web Billing.
- Vercel env changes.
- Supabase migrations or backfills.
- Production entitlement grants/revokes.
- Native app links to web checkout.
- App Store/TestFlight metadata or subscription product changes.

## Downstream Instructions

### Phase 3 Landing Page

- Use waitlist-only offer copy unless Phase 2 later verifies checkout.
- Keep pricing near CTA lightweight and subordinate to the surf-call loop.
- Do not display monthly, annual, or lifetime prices yet.

### Phase 4 Pricing Surface

- Build pricing UI against the selected mechanics.
- Until checkout is proven, wire CTAs to waitlist/interest.
- When checkout is proven, use product allowlist and entitlement proof from Phase 2 before enabling purchase CTAs.

### Phase 7 iOS Store Alignment

- Do not add native app-to-web checkout links until Apple storefront policy is reviewed.
- U.S. storefront rules are more permissive than other storefronts, so any native web-checkout messaging needs eligibility gating or a separate approval decision.

## Decision Status

02-02 is complete as a mechanics decision. It approves planning around RevenueCat Web Billing and waitlist fallback only. It does not approve public prices, live checkout, lifetime sales, env changes, migrations, or dashboard edits.
