# 02-04 Pricing Copy And Release Gates

## Executive Decision

Phase 2 closes with a conservative public posture:

> Founding Access Waitlist. Early members will get first access when plans open.

Until the gates below pass, public web surfaces may explain interest, waitlist, beta protection, and the product loop, but must not publish prices, live checkout, paid lifetime purchase language, or cross-platform unlock claims.

RevenueCat Web Billing remains the intended paid web path. Stripe is only the payment gateway behind RevenueCat Web Billing. Direct Stripe Checkout is not the v1 path. Native App Store purchase copy and native links to web checkout remain Phase 7 approval-gated.

## Current Truth After Phase 2

| Topic | Truth state | Downstream action |
|---|---|---|
| Public pre-verification offer | Waitlist/interest only | Safe for Phase 3 and Phase 4 |
| V1 paid web path | RevenueCat Web Billing intended | Do not enable until verified |
| Direct Stripe Checkout | Not selected for v1 | Do not claim or implement in launch copy |
| Founder lifetime | Planned paid web one-time product | Hidden until checkout and entitlement sync pass |
| Monthly/annual web | Planned RevenueCat Web Billing subscriptions | Hidden until dashboard/product proof exists |
| Existing promo Pro | Preserve | Safe to say beta access will not be removed because pricing launches |
| Auto-billing | Forbidden | Safe to say beta/current users will not be charged automatically |
| Native unlock from web | Supported by RevenueCat as a capability, not proven for Quiver | Do not claim until test purchase proves native `CustomerInfo` |
| App Store/TestFlight status | Time-sensitive | Recheck in Phase 7 |

## Allowed Copy Before Checkout Verification

Use these exact or near-exact concepts:

- "Founding Access Waitlist"
- "Early members will get first access when plans open."
- "Beta users will not be charged automatically."
- "Existing beta access will not be removed because pricing launches."
- "Join early and help shape the surf-call loop."
- "Quiver gives one surf call and gets more useful when surfers log what happened."

Allowed CTA destinations:

- Waitlist or interest form.
- iOS destination only after Phase 7 verifies the current App Store/TestFlight state.
- Blog or founder-note content.
- Existing product surfaces that do not imply paid checkout.

## Blocked Copy Before Checkout Verification

Do not ship any public claim that says or implies:

- A monthly plan is available on the website.
- An annual plan is available on the website.
- A lifetime purchase is available.
- A price is final or purchasable.
- A user can buy now.
- A user can lock in lifetime access by joining the waitlist.
- Website checkout exists.
- Direct Stripe checkout exists.
- App Store purchases and web purchases are interchangeable.
- TestFlight sandbox purchases carry forward.
- Web purchases unlock native Pro.
- RevenueCat Web Billing is configured for Quiver.
- Manual paid lifetime grants are available.
- Existing beta users become paid founder members automatically.
- Any user will be charged without explicit checkout consent.

## Conditional Copy After Gates Pass

Only after the relevant gate passes:

| Claim | Required gate |
|---|---|
| Monthly web plan | Web product, price, checkout, webhook, mirror, cancellation/expiration tests |
| Annual web plan | Web product, price, checkout, webhook, mirror, cancellation/expiration tests |
| Founder lifetime purchase | Founder lifetime product, one-time purchase test, mirror classification, native unlock proof |
| Website purchase unlocks Pro | RevenueCat event, Supabase mirror, web/backend gate, native `CustomerInfo`, restore/refresh proof |
| Existing users keep access | Current promotional preservation tests and production mirror audit |
| Existing users can replace promo with paid founder | Explicit paid-founder replacement implementation and tests |
| Native app can link to web checkout | Phase 7 Apple storefront/policy review and any required geo/storefront gating |

## Release Gates Before Any Paid Web Sales

### Gate 1: RevenueCat Dashboard

Must prove:

- RevenueCat Web Billing is configured for Quiver.
- Stripe gateway and any tax requirements are configured inside the RevenueCat Web Billing flow.
- Monthly, annual, and founder lifetime products exist with final product ids.
- Products are attached to the `Quiver Pro` entitlement.
- Offerings/packages/purchase links or Web SDK purchase surfaces are configured.
- Customer portal, lifecycle emails, failed payment behavior, refunds, and receipts are understood.
- Test mode and production mode boundaries are documented.

Approval-gated:

- Creating or editing products, prices, offerings, packages, web purchase links, entitlement attachments, customer portal, lifecycle emails, discounts, or Stripe gateway settings.

### Gate 2: Web Checkout Identity

Must prove:

- Checkout starts only for a signed-in Supabase user in v1.
- Supabase `user_id` is the RevenueCat app user id.
- Anonymous purchase, Redemption Links, gifts, and account-creation-after-purchase are deferred.
- Checkout failure, cancel, and return states are handled without granting access.
- No pre-auth funnel events fire for authenticated users while pricing CTAs change.

### Gate 3: Webhook And Mirror

Must prove:

- RevenueCat webhook auth uses the correct `REVENUECAT_WEBHOOK_SECRET`.
- Event handling requires `Quiver Pro` in `entitlement_ids` before granting Pro.
- Product ids are allowlisted before mutating `user_entitlements`.
- Product class is recorded distinctly: `web_subscription`, `native_subscription`, `paid_founder_lifetime`, `promotional_lifetime`, `earned_founder_lifetime`, `trial`, or `billing_grace`.
- Source/store/environment/event id are recorded.
- Successful events are append-only audited, not only kept as latest `rc_raw`.
- Failed events still write to `user_entitlements_failed_webhooks`.
- Duplicate events are idempotent.
- Invalid product, missing entitlement, wrong environment, and transfer events are rejected or quarantined.

Approval-gated:

- Supabase migrations, backfills, event-history tables, product-class fields, production grants, revokes, or data repairs.

### Gate 4: Access Resolution

Must prove:

- Web/backend paid gates resolve premium from the mirror.
- Promotional lifetime rows are preserved by default.
- Paid founder lifetime intentionally replaces promotional or earned access only through the approved allowlisted event path.
- Expiration and cancellation downgrade subscriptions correctly.
- Billing issue grace preserves access only for the intended retry state.
- Trialing resolves premium only while appropriate.

### Gate 5: Native Unlock

Must prove:

- The same RevenueCat customer resolves active `Quiver Pro` in native `CustomerInfo`.
- Native `SubscriptionProvider` displays paid/trial/billing issue state correctly.
- Restore and refresh behavior work after web purchase.
- Native does not depend on Supabase `user_entitlements` alone for UI unlock.
- Native App Store subscription products remain distinct from web product ids.

### Gate 6: Policy And Storefront

Must prove:

- Phase 7 rechecks live App Store and TestFlight status on the execution date.
- Any native app-to-web checkout link is reviewed against current Apple storefront policy.
- U.S. storefront-only behavior is gated if needed.
- Non-U.S. app metadata and UI do not direct users to external purchase mechanisms unless a valid entitlement/exception applies.
- TestFlight copy does not imply sandbox purchases carry over.

### Gate 7: Analytics And QA

Must prove:

- Waitlist/founding-offer views and clicks are tracked without leaking pre-auth events for authenticated users.
- Paid CTA events are added to the same allowlist layers before emission.
- Pricing/landing/blog routes pass scoped lint, typecheck, relevant unit tests, and browser checks.
- Mobile and desktop layouts show copy, CTAs, and assets without overlap.
- No route ships paid copy in metadata, schema, FAQ JSON-LD, sitemap-adjacent content, or Open Graph fields that contradicts the gates.

## Implementation Constraints For Phase 3 And Phase 4

### Phase 3 Landing Page

- Lead with the iOS action and one surf call.
- Explain the loop lightly: forecast -> check -> log -> improve.
- If the offer appears near the CTA, use waitlist-only language.
- Do not show prices, tier cards, checkout buttons, or lifetime purchase claims.
- Authenticated users must not receive anonymous pre-auth CTA events.

### Phase 4 Pricing Surface

- Build the UI so it can show candidate pay scale later, but default all CTAs to waitlist/interest while checkout is unverified.
- It may show "plans opening soon" or "founding access waitlist."
- It may explain no-auto-billing and beta access preservation.
- It must not publish monthly, annual, standard lifetime, or founder lifetime prices until Gate 1 and Gate 2 pass.
- It must not enable purchase CTAs until all paid-sales gates pass.

### Phase 7 iOS Store Alignment

- Recheck App Store page, iTunes lookup, TestFlight page, and shared constants on the execution date.
- Keep TestFlight sandbox/no-charge/carryover language accurate.
- Do not add native web-checkout links until policy review is complete.

### Phase 9 Analytics

- Track waitlist and founding-offer interest separately from paid checkout.
- Track selected path explicitly: `waitlist`, `revenuecat_web_billing`, `native_app_store`, `manual_approval`, or `blocked`.
- Keep event names in sync across TypeScript unions, API allowlists, DB constraints, and tests.

### Phase 10 QA

- Treat pricing, payment, App Store, TestFlight, and entitlement claims as release blockers.
- Re-run official-doc and live-link checks before go-live.
- Include all approval-gated systems in release notes.

## Phase 2 Closeout Verdict

Phase 2 satisfies PRIC-03, PRIC-04, and PRIC-05 as planning and release-gate requirements:

- PRIC-03: Public pricing/payment claims are constrained to verified behavior.
- PRIC-04: Existing beta/current-user handling is explicit and protects promotional Pro.
- PRIC-05: The v1 path is waitlist now, RevenueCat Web Billing later, with direct Stripe and manual paid grants rejected for v1 unless separately approved.

Phase 2 does not approve checkout, prices, sales, grants, migrations, env changes, dashboard edits, native external checkout links, App Store metadata edits, or outbound messaging.
