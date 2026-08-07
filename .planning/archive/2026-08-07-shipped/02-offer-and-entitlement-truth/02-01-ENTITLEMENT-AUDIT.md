# 02-01 Entitlement And Offer Truth Audit

## Executive Finding

RevenueCat is still the right v1 direction for web billing and unified Pro entitlement, but Quiver cannot truthfully sell or publicly claim monthly, annual, or lifetime web checkout yet. The current code can mirror RevenueCat events into `user_entitlements`, and native can read the same `Quiver Pro` entitlement from RevenueCat, but the web checkout product setup, founder-lifetime product semantics, and paid-lifetime replacement of promotional Pro are not proven end to end.

Until those are proven, the public offer remains:

> Founding Access Waitlist. Early members will get first access when plans open.

## Current Local Truth

### Backend Mirror

- `user_entitlements` is the web/backend mirror table.
- It is keyed by `user_id` and stores `is_pro`, `is_trialing`, `trial_ends_at`, `expires_at`, `product_id`, `will_renew`, `billing_issue`, `lapsed_at`, `previous_product_id`, `rc_raw`, timestamps, and RLS.
- `user_entitlements_failed_webhooks` is the DLQ table for failed RevenueCat webhook events.
- The webhook receiver requires `REVENUECAT_WEBHOOK_SECRET` and writes with the Supabase service-role client.
- The webhook treats the `user_entitlements` upsert as the load-bearing step and auto-enables similarity alerts only as best effort after entitlement writes.

### Event Mapping

Current `buildEntitlementUpdate` behavior:

| RevenueCat event | Current effect |
|---|---|
| `INITIAL_PURCHASE` | `is_pro=true`, trial flag from `period_type`, `will_renew=true`, expiry from RevenueCat |
| `RENEWAL` | same as initial purchase |
| `UNCANCELLATION` | same as initial purchase |
| `NON_RENEWING_PURCHASE` | `is_pro=true`, `will_renew=false`; no expiry means lifetime-style backend premium |
| `CANCELLATION` | `will_renew=false`; access remains until expiry |
| `EXPIRATION` | `is_pro=false`, `is_trialing=false`, `lapsed_at` set |
| `BILLING_ISSUE` | `billing_issue=true`; access is preserved by resolver |
| `PRODUCT_CHANGE` | updates `product_id` and `expires_at` |
| `TRANSFER` | sent to DLQ for manual reconciliation |
| `TEST` | acknowledged only |

### Promotional Pro Protection

- A lifetime promotional row is detected when `is_pro=true`, `expires_at=null`, and `product_id` starts with `rc_promo_`.
- Non-promotional updates do not overwrite that row.
- This protects beta/current users from accidental downgrade by sandbox or subscription events.
- It does not yet satisfy the desired founder rule that an existing user can later buy website lifetime and replace promotional Pro with a paid founder entitlement, unless the product semantics are explicitly designed and tested.

### Resolver Behavior

- `lib/alerts/entitlements.ts` resolves premium through:
  1. `ALERT_PREVIEW_MODE=true`
  2. `ALERT_BETA_USER_IDS`
  3. `user_entitlements`
- Expired active rows downgrade to free unless `billing_issue=true`.
- A no-expiry active row resolves premium.
- This resolver protects backend alert access but is not the native app's source of truth.

### Production Mirror Read-Only Check

Checked against production on 2026-05-24 without mutation:

- `user_entitlements` exists with RLS enabled and 7 rows.
- `user_entitlements_failed_webhooks` exists with RLS enabled and 0 rows.
- Production columns match the local migration shape: `user_id`, `is_pro`, `is_trialing`, `trial_ends_at`, `expires_at`, `product_id`, `will_renew`, `billing_issue`, `lapsed_at`, `previous_product_id`, `rc_raw`, `updated_at`, and `created_at`.
- Policies are present for user self-read and service-role management on `user_entitlements`; the DLQ is service-role managed.
- Product distribution currently shows:
  - 4 rows with `rc_promo_Quiver Pro_lifetime`
  - 2 rows with `app.quiversurf.surf.pro.annual` from `SANDBOX` / `APP_STORE`
  - 1 row with `app.quiversurf.surf.pro.monthly` from `SANDBOX` / `APP_STORE`
- No production row currently proves RevenueCat Web Billing, Stripe-backed web checkout, or a paid founder lifetime product.

### Native RevenueCat Truth

- Native entitlement id is `Quiver Pro`.
- Native product ids are:
  - iOS monthly: `app.quiversurf.surf.pro.monthly`
  - iOS annual: `app.quiversurf.surf.pro.annual`
  - Android monthly: `app.quiversurf.surf.pro:monthly`
  - Android annual: `app.quiversurf.surf.pro:annual`
- Native paywall currently reads RevenueCat packages by `$rc_annual` and `$rc_monthly`.
- Native `SubscriptionProvider` reads RevenueCat `CustomerInfo`, not `user_entitlements`, for UI unlock.
- Native paid states are `trialing`, `pro`, and `billing_issue`.
- Native TODO says Maria's build 10 annual TestFlight sandbox purchase validated StoreKit -> RevenueCat -> webhook -> Supabase mirror on 2026-05-18, but that must be repeated before relying on it for launch.

## Public Store Status Checked 2026-05-24

### App Store

- `https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320` returned HTTP 200.
- iTunes lookup returned `resultCount=1`, track name `Surf Forecast: Quiver`, version `1.0`, bundle id `app.quiversurf.mobile`, seller `Steven Chandler`.
- Public App Store page still reports preorder state:
  - `isPreorder=true`
  - `offerLabelStyle=preorder`
  - expected release date: `2026-05-25T00:00:00.000Z`
  - current version release date from lookup: `2026-05-25T07:00:00Z`
- Page metadata says in-app purchases are present and the listing description mentions Quiver Pro at `$4.99/month` or `$39.99/year` with a 14-day free trial.
- The web page did not prove the individual product identifiers or RevenueCat attachment state.

### TestFlight

- `https://testflight.apple.com/join/G31D4XW6` returned HTTP 200.
- The public link title is `Join the Surf Forecast: Quiver beta`.
- The page shows a `View in TestFlight` link and does not show a closed or not-accepting-new-testers message.
- The public beta description mentions Quiver Pro at `$4.99/mo` or `$39.99/yr`, 14-day free trial, and asks testers to log sessions and send feedback.
- Apple TestFlight copy on the page states beta in-app purchases are free during beta testing and do not carry over to App Store versions.

## External Source Findings

### RevenueCat Web

- RevenueCat Web supports selling subscriptions and other purchases on the web while unlocking the same RevenueCat entitlements used on mobile.
- Web purchase surfaces include Web Purchase Links, Web SDK, Web Paywalls, Funnels, Web Purchase Button, and Redemption Links.
- RevenueCat Web Billing uses Stripe as the payment gateway, but RevenueCat manages the product catalog, lifecycle, customer portal, billing behavior, and transactional emails.
- RevenueCat docs explicitly support web purchases that unlock in-app entitlements, but that is a capability, not proof that Quiver has configured it.

### Supabase Current Caveat

- Supabase's current changelog includes a breaking-change rollout where new `public` schema tables are no longer automatically exposed to the Data API by default on new projects, with wider rollout dates later in 2026.
- The current `user_entitlements` and `user_entitlements_failed_webhooks` tables already exist and are reachable by the app's current server-side code paths.
- Any future Phase 2 migration that adds public-schema entitlement tables or functions should explicitly review Data API exposure, grants, and RLS rather than assuming new tables are API-visible.

### RevenueCat Entitlements

- Entitlements represent feature access and can be shared across apps in the same RevenueCat project.
- Products must be attached to entitlements to unlock access.
- Subscription products unlock for their duration.
- Non-consumable products can unlock forever, which is the likely product model for a paid lifetime/founder offer.
- Detaching or attaching products can retroactively affect customers who bought those products, so dashboard changes are approval-gated.

### Apple Policy Boundary

- Apple guideline 3.1.1 still says app functionality unlocked inside an app must use in-app purchase unless an allowed exception applies.
- Current guideline text says external purchase links/calls to action are allowed without special entitlement in United States storefront apps, but outside the United States storefront, apps and metadata generally cannot direct customers to purchase mechanisms other than in-app purchase unless using applicable Apple entitlements.
- Native app messaging and links to web checkout must stay Phase 7 approval-gated and likely geo/storefront-gated.

## Gaps Before Public Pricing Or Checkout Claims

1. RevenueCat Web Billing is not verified for Quiver.
   - Need dashboard proof of Web Billing app/provider, Stripe gateway state, products, prices, currencies, customer portal, lifecycle emails, and test mode.

2. Website checkout identity mapping is not designed.
   - Logged-in web checkout can use Supabase `user_id` as RevenueCat app user id.
   - Anonymous checkout requires Redemption Links or another account-linking flow.

3. Lifetime/founder product semantics are missing in local code.
   - Current code treats non-expiring `NON_RENEWING_PURCHASE` as premium.
   - There is no explicit source/store/purchase-type/founder flag.
   - A paid lifetime web product could be confused with promotional lifetime if only `expires_at=null` is used.

4. Promotional Pro replacement is not implemented.
   - Current merge logic intentionally blocks non-promotional updates from replacing lifetime promotional Pro.
   - That is correct for beta protection, but not enough for paid founder lifetime replacement.

5. Webhook filtering is broad.
   - Current mapping does not require `entitlement_ids` to contain `Quiver Pro`.
   - Current mapping does not restrict product ids to known Quiver Pro product ids.
   - This is acceptable only while the RevenueCat project is single-entitlement/single-product-family, but it becomes risky once web lifetime products and any future add-ons exist.

6. Current mirror is latest-state only.
   - `rc_raw` stores the latest raw event on the entitlement row.
   - There is no append-only entitlement event audit table.
   - DLQ only captures failures, not successful history.

7. App Store status is time-sensitive.
   - Public App Store is currently preorder with expected date 2026-05-25.
   - Phase 7 still must re-check live status before landing/App Store copy changes.

## Go/No-Go For Downstream Phases

### Public Landing/Pricing Copy

| Claim | Status after 02-01 |
|---|---|
| Founding Access Waitlist | Go |
| Early members get first access when plans open | Go |
| Monthly/annual/lifetime prices on public web | No-go until 02-02/02-04 |
| Web checkout available | No-go |
| Lifetime purchase available | No-go |
| Website purchase unlocks native Pro | No-go until test purchase proves it |
| Existing beta users keep access | Go as a local-code claim only; not public pricing copy |
| Existing beta users can replace promo with paid founder lifetime | No-go |
| Direct Stripe checkout | No-go; not v1 path |
| Native app links to web checkout | No-go until Apple policy/storefront review |

### RevenueCat/Env/DB Approval Checklist

Approval is required before any of these:

- Create or edit RevenueCat web billing provider/app, products, offerings, packages, customer portal, discounts, lifecycle emails, or web purchase links.
- Connect or modify Stripe gateway/tax/payment settings for RevenueCat Web Billing.
- Add or edit production Vercel env such as `REVENUECAT_WEBHOOK_SECRET` or any RevenueCat web SDK secrets/keys.
- Add Supabase migrations for entitlement source, founder status, product allowlists, event history, or backfills.
- Grant, revoke, or backfill production user entitlements.
- Change App Store/TestFlight copy, subscription products, native paywall copy, or native links to web checkout.

## Recommended 02-02 Decision Inputs

1. Use RevenueCat Web Billing as intended, not direct Stripe checkout, unless dashboard verification proves it cannot support the required lifetime/monthly/annual model.
2. For public pre-verification web, keep one waitlist CTA and no prices.
3. Define exact web product ids before implementation, probably separate from native product ids:
   - monthly web Pro subscription
   - annual web Pro subscription
   - founder lifetime non-consumable
4. Add local implementation constraints for:
   - product id allowlist
   - `entitlement_ids` check for `Quiver Pro`
   - source/store/environment fields
   - founder/lifetime product classification
   - promotional Pro protection with explicit paid-lifetime replacement path
   - append-only successful webhook event history
5. Require an end-to-end test purchase before any lifetime sales:
   - RevenueCat web checkout test purchase
   - webhook received
   - `user_entitlements` row correct
   - web/backend paid gate correct
   - native `CustomerInfo` shows `Quiver Pro`
   - restore/refresh path works
   - cancellation/expiration/lapse behavior understood

## Decision

02-01 completes as an audit. It does not authorize public pricing, checkout, lifetime sale copy, native external checkout links, migrations, env changes, or dashboard configuration.
