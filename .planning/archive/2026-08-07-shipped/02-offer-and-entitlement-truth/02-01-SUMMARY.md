# Summary 02-01: Entitlement, RevenueCat, App Store, And Monetization Docs Audit

## Status

Complete - read-only audit.

## Completed

- Audited the current `user_entitlements` schema and RevenueCat webhook mapping.
- Confirmed lifetime promotional Pro rows are protected from non-promotional overwrite.
- Confirmed that protection does not yet implement the desired paid founder lifetime replacement path.
- Audited the alert entitlement resolver and beta/preview bypasses.
- Audited native RevenueCat entitlement/product identifiers and native app entitlement source of truth.
- Checked public App Store and TestFlight URLs from current constants.
- Checked production `user_entitlements` and `user_entitlements_failed_webhooks` schema, RLS, policies, row counts, and product distribution read-only.
- Refreshed official RevenueCat and Apple policy docs.
- Refreshed Supabase changelog context for Data API exposure caveats before future migration planning.
- Wrote `02-01-ENTITLEMENT-AUDIT.md`.

## Key Findings

- RevenueCat Web is a valid direction for web purchases that unlock the same mobile entitlement, but Quiver's web checkout is not verified.
- Current backend can mirror RevenueCat events, but it lacks explicit source/store/founder/lifetime classification and successful event history.
- Current merge logic protects lifetime promotional Pro, but would block a normal paid lifetime product from replacing promo access.
- Production currently has 4 lifetime promo rows, 3 sandbox App Store subscription rows, and no successful webhook DLQ rows.
- App Store public page is still preorder as of 2026-05-24, with expected release date 2026-05-25.
- TestFlight public link is live and still describes beta Pro pricing/trial behavior.
- Public web should continue to use waitlist-only offer language until Phase 2 proves checkout and entitlement sync.

## Next Plan

02-02: Decide the v1 founding offer mechanics and fallback if purchase flow is not ready.

## Verification

- `node /Users/stevenchandler/.codex/get-shit-done/bin/gsd-tools.cjs query init.execute-phase 2 --raw` confirmed Phase 2 now has `02-01-PLAN.md`, `02-01-SUMMARY.md`, and no incomplete generated plan files.
- Public App Store fetch returned HTTP 200.
- Public TestFlight fetch returned HTTP 200.
- iTunes lookup returned one app result for App Store id `6759300320`.
- Production read-only psql checks confirmed entitlement tables exist, RLS is enabled, policies are present, row counts are `user_entitlements=7` and `user_entitlements_failed_webhooks=0`, and product distribution contains only promo lifetime plus sandbox App Store subscriptions.

## Approval Boundary

No RevenueCat dashboard, Stripe, App Store Connect, Vercel env, Supabase migration, production data, or public pricing copy changes were made.
