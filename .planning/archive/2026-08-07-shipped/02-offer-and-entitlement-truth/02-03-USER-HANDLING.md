# 02-03 Beta And Current-User Founder Handling

## Executive Decision

Beta and current users are protected users, not billable leads. Existing access stays intact, no user is charged or converted into a paid plan without an explicit checkout, and earned founder lifetime status requires a real eligibility event plus an approved RevenueCat grant path.

The v1 rule is:

1. Keep all existing no-expiry promotional Pro access.
2. Treat TestFlight and sandbox purchases as test access, not payment consent.
3. Let current users earn founder lifetime status by logging at least five rated real completed sessions and giving feedback.
4. Fulfill earned lifetime through RevenueCat `Quiver Pro` promotional entitlement, not a Supabase-only row.
5. Let paid founder lifetime replace promotional lifetime only after the user explicitly checks out through the verified paid path.

## Definitions

| Term | Definition |
|---|---|
| Current user | Any real Quiver account created before the paid founding offer opens, plus manually tracked warm leads or beta testers already in the founding-crew tracker. |
| Beta user | A current user with TestFlight/Firebase/native beta access, native device evidence, beta outreach, or App Store/TestFlight sandbox purchase history. |
| Protected promotional lifetime | An active `user_entitlements` row with `is_pro=true`, `expires_at=null`, and `product_id` starting with `rc_promo_`. |
| Native sandbox Pro | A RevenueCat/App Store sandbox monthly or annual entitlement from TestFlight or sandbox purchase testing. It is access/test evidence, not a real paid purchase. |
| Earned founder eligible | A real non-mock current user with at least five rated real completed sessions plus a captured feedback signal. |
| Earned founder granted | An earned founder eligible user who has received the approved lifetime `Quiver Pro` RevenueCat promotional entitlement and whose grant is recorded in the tracker or future founder-status table. |
| Paid founder | A user who explicitly completes the verified paid founder lifetime checkout after paid gates pass. |

## No-Auto-Billing Rule

No beta or current user may be billed unless they intentionally complete a checkout that displays the price, product, and billing terms.

These are not billing consent:

- Creating a Quiver account.
- Joining TestFlight or Firebase App Distribution.
- Installing the native app.
- Using Apple Sign-In.
- Replying to a founding-crew email.
- Joining a waitlist.
- Logging five sessions.
- Receiving a promotional lifetime grant.
- Completing a TestFlight sandbox purchase.
- Having an existing `user_entitlements` row.

Disallowed without explicit checkout:

- Converting promotional Pro into a paid subscription.
- Importing a user into Stripe or RevenueCat with an active paid product.
- Starting a web or native subscription on behalf of the user.
- Treating a sandbox/TestFlight purchase as a production purchase.
- Charging a saved card or app-store account from prior beta activity.
- Replacing promotional lifetime with paid founder lifetime unless the user completes the verified paid founder checkout.

## Access And Founder Handling Matrix

| User state | Access handling | Founder handling | Billing handling |
|---|---|---|---|
| Existing protected `rc_promo_` lifetime | Keep lifetime Pro. Current code already blocks normal subscription/sandbox overwrites. | Mark as protected legacy promotional lifetime. If they also meet earned criteria, mark earned founder without needing a second access grant. | Never auto-bill or auto-convert. |
| Current user with at least five rated sessions plus feedback | Eligible for earned founder lifetime. | Grant via RevenueCat promotional `Quiver Pro` lifetime only after approval and verification. | No charge. |
| Current user with at least five rated sessions but no captured feedback | Eligible pending feedback. | Ask for one feedback signal before grant. | No charge. |
| Current user near threshold | Keep current tier/access. | Nudge toward rated sessions and feedback. | No charge. |
| TestFlight sandbox monthly or annual Pro | Preserve current RevenueCat state while sandbox entitlement is active. | Does not by itself create founder status. Can earn or buy founder separately. | Sandbox/TestFlight purchases are free test transactions and do not carry into production. |
| Real native beta user with no sessions | Keep current free or promotional access. | Not founder yet. Can earn through the same five-rated-session path. | No charge. |
| Warm web user or waitlist user | Keep current free access. | Interest only until they meet earned criteria or later choose paid founder checkout. | No charge. |
| Existing promo user who voluntarily buys paid founder lifetime | Paid founder event may replace promotional classification only through the explicit paid-founder product path. | Mark paid founder and preserve lifetime access. | Explicit checkout required. |

## Earned Founder Eligibility

An earned-founder candidate must satisfy all of these:

1. Real, non-mock user.
2. Current user or beta/warm lead before the paid founding offer opens.
3. At least five rated real completed sessions.
4. At least one captured feedback signal.
5. No support, abuse, duplicate-account, or cleanup blocker.

Rated real completed sessions should be counted as:

- `sessions.status = 'completed'`
- `sessions.rating IS NOT NULL`
- `sessions.deleted_at IS NULL`
- seeded/test/mock sessions excluded by `source IN ('seed', 'test', 'mock')` or known seed markers

Feedback signals can include:

- Email reply with product, beach, bug, session, or forecast feedback.
- Tracker note from a real conversation.
- In-app feedback or forecast-feedback submission after that surface exists.
- Bug report with enough detail to shape the product.
- Founder/manual note tied to a specific user id and timestamp.

## Grant Fulfillment Rule

Earned founder access must be fulfilled RevenueCat-first.

Approved fulfillment path:

1. Verify the user id and rated-session count.
2. Verify feedback evidence.
3. Check current RevenueCat `CustomerInfo` for the same app user id.
4. Grant a lifetime `Quiver Pro` promotional entitlement in RevenueCat through the dashboard or REST API.
5. Confirm native `CustomerInfo` shows active `Quiver Pro`.
6. Confirm the RevenueCat webhook or reconciliation path mirrors the grant into `user_entitlements`.
7. Record the grant in the founding tracker or future founder-status table.

Do not use a Supabase-only `user_entitlements` upsert as fulfillment for native users. Native reads RevenueCat `CustomerInfo`; a backend-only grant can leave the app showing locked UI.

## Production Snapshot Evidence

Read-only production check on 2026-05-24:

| Signal | Count |
|---|---:|
| Real non-mock profiles | 81 |
| Real onboarded profiles | 42 |
| Real users with native device rows | 14 |
| Real users with completed sessions | 8 |
| Real users with at least one rated session | 5 |
| Real users with at least five rated sessions | 2 |
| Real protected `rc_promo_` lifetime rows | 3 |
| Real non-promotional Pro rows | 3 |

Current observed entitlement distribution:

| Product id | Real rows |
|---|---:|
| `rc_promo_Quiver Pro_lifetime` | 3 |
| `app.quiversurf.surf.pro.annual` | 2 |
| `app.quiversurf.surf.pro.monthly` | 1 |

This supports the rule: protect existing promo rows, do not treat sandbox native Pro as paid founder status, and keep earned-founder grants explicit.

## Copy Boundaries

Allowed for targeted beta/current-user messaging after 02-03:

- "Log five rated sessions and send feedback to become eligible for earned founder lifetime access."
- "No one is charged unless they choose a checkout path."
- "If you already have promotional Pro, that access stays protected."

Allowed only after grant workflow is approved:

- "You earned lifetime Quiver Pro."
- "Your founder lifetime access is active."

Still blocked on public pricing or landing pages until 02-04 gates:

- Published paid lifetime price.
- Paid founder checkout link.
- "Buy lifetime now."
- "Website purchase unlocks native Pro."
- Any implication that TestFlight sandbox purchases become paid production access.

## Required 02-04 Carry-Forward

02-04 should turn this rule into implementation constraints:

1. Add a founder-status ledger or table separate from `user_entitlements`.
2. Store status, source, eligibility snapshot, feedback evidence pointer, grant method, RevenueCat customer id/app user id, product id, and audit timestamps.
3. Keep `user_entitlements` focused on access state, not founder-program state.
4. Add explicit paid-founder lifetime replacement logic instead of weakening promotional overwrite protection.
5. Add tests for protected promo users, earned eligible users, sandbox native users, and paid founder replacement.
6. Require a RevenueCat grant verification checklist before any production earned-lifetime grant.
7. Keep RLS enabled and use service-role/server-only writes for any founder-status table.

## Decision Status

02-03 is complete as a handling rule. It authorizes the beta/current-user policy and planning constraints only. It does not authorize production grants, paid checkout, migrations, RevenueCat configuration, App Store changes, outbound sends, or public paid offer copy.
