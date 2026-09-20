# Free month and cancellation review — 2026-09-15

Linked issues: [native #198](https://github.com/SteveChandler/quiver-native/issues/198), [native #352](https://github.com/SteveChandler/quiver-native/issues/352).

## Result

Implemented and cross-reviewed the one-month manual gift and optional native cancellation flow. Three agents handled backend, native, and webhook ordering; root reviewed and integrated their changes. Review findings were fixed and relevant checks rerun. No commits, deployments, production migrations, store changes, or live grants occurred.

Both repositories use branch `codex/free-month-cancellation-20260915` in `.worktrees/free-month-cancellation-20260915`. Primary checkouts and existing worktrees were preserved.

- Staff can issue `manual_month` through the existing authenticated admin offer endpoint. See the adjacent `trial-feedback.md` operational instructions.
- Eligible native subscribers can accept `cancellation_month` independently of optional feedback. Both programs reuse the existing grant ledger, budget controls, and verified RevenueCat promotional entitlement mechanism.
- Gifts wait for existing access to end; acceptance does not cancel or alter store renewal. New programs remain disabled until separately approved and configured.
- Missing feature and Technical problem expose optional explanation fields. Skip and decline do not wait for feedback or telemetry. Known billing store determines management routing; known web billing gives receipt/account instructions instead of a wrong store link.
- Feedback is idempotent per flow, private to privileged support access, excluded from analytics, and retained until account deletion. Later feedback respects subscription episodes.
- Old installed clients retain their original offer response; new clients opt in to additional programs. Automated five-session reward emails exclude the new gifts.
- Gift celebrations require the verified server mirror and fresh promotional native access. Webhook updates are ordered atomically per entitlement field, including partial events, retries, and concurrent writes.

## Changed files

Web/backend:

- `app/api/cancellation-feedback/route.ts`
- `app/api/admin/offers/route.ts`, `app/api/offers/route.ts`
- `app/offers/claim/owned-offers.tsx`, `lib/subscription/offer-contract.ts`
- `supabase/migrations/20260915180000_cancellation_feedback_gifts.sql`
- `supabase/migrations/20260915181000_order_revenuecat_entitlement_events.sql`
- Focused route, offer UI, PostgreSQL, webhook and Playwright tests; `scripts/test-email-lifecycle.sh`
- `docs/implementation/trial-feedback.md` and this review

Native:

- `src/features/cancellation-feedback/api.ts`, `src/features/cancellation-feedback/index.tsx`, and tests
- `src/features/pro-offers/api.ts`, `src/features/pro-offers/offer-card.tsx`, and tests
- `src/providers/subscription-provider.tsx` and provider tests
- `src/screens/settings.tsx`, `src/__tests__/settings.test.tsx`

## Verification

Run commands in their respective worktrees. Web commands used local fixture values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL`; no production credentials were required.

| Command | Result |
| --- | --- |
| `bash scripts/test-email-lifecycle.sh --feedback-contract` | PASS after both migrations were integrated; real disposable PostgreSQL, concurrent claims/submissions, budgets, store eligibility, subscription episodes, and two connected provider tests |
| `yarn test:unit --runInBand --testMatch '**/revenuecat-ordering-postgres.integration.ts'` | PASS, 9 real PostgreSQL tests including producer field-map parity and concurrent row writers |
| `yarn test:unit --runInBand __tests__/app/api/webhooks/revenuecat-route.test.ts __tests__/app/api/webhooks/revenuecat.test.ts` | PASS, 23 tests |
| `yarn test:unit --runInBand --runTestsByPath __tests__/app/api/cancellation-feedback/route.test.ts __tests__/lib/subscription/offer-contract.test.ts __tests__/lib/subscription/offer-fulfillment.test.ts __tests__/app/api/offers/auth-contract.test.ts __tests__/app/api/offers/claim.test.ts __tests__/app/offers/owned-offers.test.tsx` | PASS, 52 tests; subsequent final cancellation route rerun passed 14 tests after store additions |
| `yarn typecheck` | PASS |
| `npx eslint --max-warnings=0 app/api/cancellation-feedback/route.ts app/api/admin/offers/route.ts app/api/offers/route.ts app/offers/claim/owned-offers.tsx lib/subscription/offer-contract.ts` | PASS |
| `npx eslint --max-warnings=0 __tests__/integration/revenuecat-ordering-postgres.integration.ts __tests__/app/api/webhooks/revenuecat-route.test.ts` | PASS |
| `yarn deadcode` | PASS |
| `yarn playwright test --config=playwright.email-offers.config.ts` | PASS, one claim flow at 390/1280 widths; mobile screenshot inspected |
| `VERCEL_ENV=preview yarn build` | PASS |
| `npm test -- --runInBand` | PASS final native run: 568 suites, 6,476 tests; 5 suites/25 tests skipped |
| `npm test -- --runInBand src/features/cancellation-feedback src/features/pro-offers src/__tests__/settings.test.tsx src/providers/__tests__/subscription-provider.test.tsx` | PASS final focused run: 6 suites, 119 tests |
| `npm run typecheck -- --incremental false` | PASS |
| `npx eslint --max-warnings=0 src/features/cancellation-feedback src/features/pro-offers` | PASS |
| `npx eslint --max-warnings=0 src/features/cancellation-feedback src/features/pro-offers src/providers/subscription-provider.tsx src/screens/settings.tsx` | FAIL: 11 existing warnings, zero errors; provider refs/effect warnings (3), Settings effect/dependency/font warnings (8) |
| `git diff --check` | PASS in both repositories |

Final evidence: `/tmp/quiver-cancellation-episode-sql.log`, `/tmp/quiver-cancellation-combined-ordering.log`, `/tmp/quiver-cancellation-store-route.log`, `/tmp/free-month-native-jest-final.log`, `/tmp/free-month-native-focused-final.log`, `/tmp/free-month-native-lint-all.log`. Earlier web build/browser/lint evidence is under `/tmp/quiver-cancellation-*.log`; web screenshots are `test-results/owned-offer-390.png` and `test-results/owned-offer-1280.png`.

## Dashboard definitions awaiting ingestion

Target: [Quiver Native — Trials & Cancellation](https://us.posthog.com/project/424662/dashboard/2100414), project 424662. Live schema inspection found none of the new cancellation/gift events yet. Existing live insights were left unchanged; the following definitions must be tested against first release events before publication.

Use a rolling 30-day window, unique users, native platform breakdown (`native-ios`, `native-android`), project test-account exclusion, and the existing dashboard emulator/production-channel filters. Client counts remain consent-limited; SDK platform/update metadata is canonical.

| View | Definition | Interpretation |
| --- | --- | --- |
| Cancellation feedback reasons | `cancellation_feedback_submitted`, breakdown `reason` | Structured self-report, not store cancellation confirmation; never export notes |
| Optional cancellation flow | `cancellation_feedback_shown`, `cancellation_feedback_submitted`, `cancellation_feedback_skipped`, `subscription_management_opened` | Compare counts; skip is valid, so this is not a mandatory ordered funnel |
| Free-month offer outcomes | `cancellation_offer_shown`, `cancellation_offer_accepted`; `cancellation_offer_fulfillment` broken down by `outcome` | Acceptance and held access are not fulfilled gifts or retained paying subscribers |
| Verified gift access | `pro_gift_celebration_shown`, breakdown `program_id`; compare `pro_gift_claim_finished` by `outcome` | Client-observed verified access; server ledger remains authoritative |

Existing dashboard views already cover imported provider cancellations, timing, activity, and paid conversion. Validate downstream retention after the new events arrive; no deployment or analytics backfill was performed.

## Release limits

Apply reviewed migrations in timestamp order, configure approved terms/budget/expiry for each desired program, then validate live provider fulfillment and native store handoff before activation. These steps require separate release authorization.

Native simulator/physical-device and store sandbox validation were not run: the isolated worktree had no generated iOS workspace/local app configuration, no component harness, and no running backend with the new endpoint. Existing simulator state was preserved. Full native tests passed; this does not replace device validation.

This implements the approved one-month gifting/cancellation slice. The broader #198 campaign epic (future referral triggers, batch code administration and revocation tooling) remains separate; neither issue was closed as fully shipped.
