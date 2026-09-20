# Trial cancellation feedback implementation

Status: local implementation, disabled and uncommitted. Real iOS monthly promotional signing, lapsed-user redemption at $0, and subsequent $4.99 sandbox renewal passed on September 13. **Preserving the remaining original two-week trial is not yet verified.** The approved reusable sandbox tester reset and 30-minute monthly test clock are complete and verified. The fresh purchase showed “2 weeks free” to the operator, but Apple and RevenueCat recorded a normal $4.99 sandbox period with no introductory offer. Both on-device subscription managers were empty despite Apple reporting an active subscription. Apple Developer Support case **102962226020** was submitted; original-trial preservation remains blocked pending investigation. Do not repeat the failed phone navigation or treat this purchase as an introductory trial. Prior device/provider evidence is retained in the Brand Vault. No production database migration, customer send, grant or deployment was performed.

The automated connected API/PostgreSQL test now exercises actual feedback/redemption and RevenueCat webhook handlers, provider eligibility parsing, immutable submission, explicit reservation, single handoff, authenticated receipt ingestion, duplicate receipts, failed completion/retry, and worker-driven verified fulfillment with persisted run records while new redemption is paused. Auth/provider HTTP responses are synthetic fixtures; a bounded transport bridge connects the real Supabase client to disposable PostgreSQL. The alert-rule side effect and Sentry transport are mocked. These results do not certify live Apple, Supabase PostgREST deployment, scheduler invocation, or alert delivery. The existing browser test covers the feedback UI with API response fixtures. The feedback-specific RevenueCat Web Billing adapter is now implemented locally behind independent disabled controls; real provider sandbox validation and activation remain pending. Android stays deferred.

## Current verification and external blocker

- Run `bash scripts/test-email-lifecycle.sh --feedback-contract` from this worktree: disposable PostgreSQL migrations/rules/concurrency plus the real route-handler/webhook/worker-to-database scenario. The cluster is stopped automatically; only synthetic local data is used. The integration spec uses a non-default suffix and is invoked by this dedicated command, so ordinary Jest does not depend on PostgreSQL.
- Run `yarn playwright test --config playwright.trial-feedback.config.ts --workers=1` for mobile/desktop feedback rendering and real unauthorized HTTP responses. Successful form API responses are fixtures, not provider fulfillment evidence.
- Paid renewal attribution now uses effective `purchased_at`, not webhook event time, and ignores future periods until effective. A regression proves early-arriving provider events are counted at their actual billing boundary.
- Apple follow-up: retain case **102962226020**, transaction `2000001235676466`, and the existing diagnostic reservations/evidence. Resume the real stacking scenario only after a usable introductory trial and cancellation path are established. Required evidence remains the exact original trial end, same-product free-month boundary, no intervening charge, and subsequent paid renewal. The operator approved continuing independent local work while this case is unresolved.
- Production activation remains blocked until the original-trial preservation and full provider fulfillment requirements pass. Do not use the lapsed diagnostic as stacking evidence or relabel real sandbox receipts as production.

The later setup/checkpoint sections below are historical implementation notes. This current verification section and the dated Brand Vault run evidence supersede their earlier “no signing/purchase performed” statements.

## Current release scope — September 13, 2026

The user confirmed iOS and web billing as the current launch scope. Android is not live and is deferred; Android implementation and store validation are not blockers for this release. Retain existing local Android adapter code and tests as unvalidated scaffolding. Leave all `PLAY_STORE` offer policy rows disabled and do not publish Android activation as part of this rollout. This scope update changes documentation only.

## Scope and execution plan

Implement in the isolated web branch `orch/trial-feedback-20260913` and native branch `orch/trial-feedback-native-20260913`. Keep the approved founder email and feedback-first experience. Preserve the separate, non-renewing five-session and three-month gifts.

1. Persist cancellation reason, offer identity, price and explicit production provenance in the existing RevenueCat event ledger. Add private feedback, provider policy and recipient reservation state.
2. Add `trial_feedback` to the existing lifecycle evaluator, reservations and dispatch, retaining consent, suppression, pauses, quiet hours and contact caps.
3. Render the approved email with existing stickers and an authenticated two-question mobile/desktop form. Save feedback before considering any incentive.
4. Present only an exact, independently approved provider offer. Show original trial expiry, additional calendar-month expiry and the store-localized recurring price. Reserve before billing and persist a single handoff immediately before opening the store. A lost response must never replay a store handoff.
5. Reconcile only from matching processed production provider evidence. Expose private operational results through the existing admin status API; keep feedback text out of that dashboard. Test local SQL, auth contracts, UI, provider selection, concurrency and rollback controls.

The current Codex session implemented this directly without delegated agents. On September 13, Steven approved shipping the dormant backend. This authorizes the two reviewed migrations and backend promotion, with all four new environment switches false, database controls disabled and no offer policies activated. Customer activation remains a separate approval.

## Implemented contracts

- Email subject: **Before you head out**. One CTA: **Tell me how it went**. No incentive in the email. Existing sticker layout and footer remain.
- Cancellation job: verified voluntary `UNSUBSCRIBE` during a current production trial, fresh matching provider snapshot, due 24 hours after cancellation, expires at the earlier of cancellation + 7 days or the original trial end. Existing lifecycle eligibility and 72-hour spacing still apply. Paid access, resumed billing, later incompatible provider events, active gifts and missing provenance exclude the job.
- Feedback: authenticated cookie or native Bearer identity, strict bounded reason/note validation, optional account-and-episode-bound message ID. One immutable submission per account, independent of marketing consent for form submission. Submitting pauses further lifecycle followups.
- Offer: **If you’re up for a little more time in the water with Quiver, your next month of Pro is on us.** Appears only after saved feedback and independent provider policy approval. One calendar month, clamped in UTC, after the existing trial; exact original product and recurring price. No automatic billing action when feedback is sent.
- Reservation: stable customer-generated UUID, per-account transaction lock, one reward per account. A separate persisted handoff guard admits at most one store handoff. Signing failure before handoff can be retried. Any uncertainty after handoff is held for reconciliation; it is not silently retried.
- Receipt: matching account/store/product/offer, processed explicit production event, zero price, free/intro period, exact original trial end as start, and exact expected new end. Neither client success nor reservation grants access. Existing entitlement webhook owns access updates.
- Monitoring: the existing 15-minute email cron calls an independently enabled feedback reconciler even when email sending is off. Run rows, Sentry failure/attention events, a rotating 50-account queue with a 10-minute cooldown, receipt deadlines, and expired policy alerts. `/api/admin/email/status` adds `trial_feedback` with delivery/open/click/bounce evidence, saved feedback reason, provider result, sessions/return after feedback, and subsequent paid renewal. These are observed post-feedback outcomes, not causal lift measurements.
- The installed native v1 contract continues hiding web offers. Web-billed users use the authenticated browser recovery endpoint/card, which requires its own environment/database controls and approved RC_BILLING policy. No generic app-store or checkout URL substitutes for recovery of the existing subscription.

## Migration and rollout order — approval required before execution

1. Review the local web recovery adapter against the existing RevenueCat Web Billing checkout and entitlement path. Its synthetic provider/API/PostgreSQL contracts pass; independently verify actual RevenueCat sandbox extension, portal reactivation and paid renewal before live activation.
2. Apply `20260913150000_trial_cancellation_feedback.sql`, then `20260913230000_trial_feedback_web_recovery.sql`, before deploying this backend version: the webhook writes the new ledger columns even while feedback is disabled. The second migration adds private web state and an off-by-default web control, provider-readback mirroring, queue functions and additive dashboard fields. It adds ledger columns, three private RLS tables, service-only functions, an outcomes view, and an additive admin dashboard field. Defaults are off; no cohort, consent, campaign approval or entitlement is backfilled.
3. Deploy backend code with `TRIAL_FEEDBACK_ENABLED=false`, `TRIAL_FEEDBACK_REDEMPTION_ENABLED=false`, `TRIAL_FEEDBACK_WEB_ENABLED=false`, `TRIAL_FEEDBACK_WORKER_ENABLED=false`. Independently approve `TRIAL_FEEDBACK_WORKER_ENABLED=true` after the migration so reconciliation is scheduled and its run records/alerts can be verified. Existing campaigns and gifts continue using their current code paths.
4. Configure the iOS offer and RevenueCat web recovery offer, test cancelled-midtrial stacking, localized price, original plan preservation, renewal, cancellation, once-per-account/cohort enforcement, duplicate attempts, refunds and receipt latency. Record product-specific evidence and a dated approval/expiry in `trial_feedback_offer_policy`. The approved one-month promotional offers now exist on both monthly/annual products; use the identifiers recorded below. Monthly/annual signing and lapsed monthly redemption/renewal are verified; original-trial stacking remains blocked by the Apple case above. Android validation is deferred as recorded below.
5. Review synthetic previews generated with `TRIAL_FEEDBACK_ENABLED=true`. New sending requires a **new immutable campaign**: `startup-lifecycle-v2`, version 2, final preview content hash. The existing approved v1 row cannot be edited. Approve a concrete activation transaction that creates v2, points automation at it and rebinds the reviewed eligible contact states from v1. Existing `(user, job, episode)` attempt uniqueness prevents resending old stages across versions. Do not simply flip an environment flag while contacts remain bound to v1.
6. Enable database controls and the relevant environment flags only after the concrete activation plan is approved. Redemption also requires the reconciliation worker flag. Native UI defaults off under `EXPO_PUBLIC_TRIAL_FEEDBACK_ENABLED`; enable and release it for iOS only after the backend/provider gates pass. Verify iOS binary/OTA compatibility separately. The public flag is shared, so keep `PLAY_STORE` provider policy disabled and do not publish Android activation.
7. Verify actual scheduled run receipts, due/held reasons, provider handoff and delivery, saved feedback, original trial retention, confirmed extra month, exact paid renewal and cancellation handling before calling the business outcome validated.

## Rollback

Pause new sending/redemption with their database and environment switches. Turn native exposure off in a reviewed release when needed. **Keep the new backend and reconciliation worker running for existing reservations.** Do not roll back to backend code without the feedback reconciler while handoffs remain unresolved. Retain the additive schema, ledger and saved feedback; do not delete evidence or revoke legitimately accepted store access. Restore approved v1 campaign bindings only with a reviewed transaction and the v1 runtime flag/hash pairing. Provider billing changes, if any are later authorized, require provider-specific rollback review; this code never cancels subscriptions during rollback.

## Known release gaps

- RevenueCat is the established web provider. The feedback-specific web recovery adapter is implemented locally; real provider verification and activation remain pending. Android is deferred.
- Original-trial stacking and its resulting renewal/cohort enforcement remain unverified on iOS and RevenueCat web; the separate lapsed iOS monthly redemption/renewal passed. Apple extension APIs are not a substitute for this requirement. Provider-specific setup and sandbox/device evidence are required for the current launch scope.
- No new offer was purchased or redeemed on a simulator, physical device or production account. Native UI/SDK orchestration has Jest coverage, not store end-to-end certification.
- A post-handoff cancellation/ambiguous response remains held. An operator needs provider proof before any recovery that could permit another handoff. There is no automatic reset based on an untrusted client cancellation assertion.
- Existing ledger rows lack the new explicit provenance flag. Existing trials remain ineligible unless a separately approved provider-evidence reconciliation establishes that provenance; no historical production flag was fabricated in this migration.
- A cancellation too close to the original trial end may have no safe email slot. An expired-trial recovery offer is not approved and is held.
- The form uses existing web sign-in; native users opening it may need to sign in again. No auth credentials are placed in email or deep-link URLs.

## Deferred Android work — not a current release gate

Before a future Android activation:

1. Configure the exact Google Play base plan and offer. Do not substitute ordinary promo codes for the required trial-stacking behavior.
2. Validate the existing adapter's same-product, cancelled-trial `DEFERRED` replacement in the store sandbox; SDK unit tests do not establish support.
3. Prove retention of the original 14-day trial plus one calendar month, zero intervening charge, localized price, original plan, paid renewal, cancellation and refunds.
4. Verify once-per-account/cohort enforcement, account/alias switching, duplicate attempts, lost callbacks and matching provider receipts.
5. Capture Android device/store and relevant Maestro evidence, then obtain explicit activation approval before enabling `PLAY_STORE` policy or publishing an Android release.

## References

- [RevenueCat iOS subscription offers](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers/ios-subscription-offers)
- [RevenueCat Google Play offers](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers/google-play-offers)
- [RevenueCat subscription extension constraints](https://www.revenuecat.com/docs/guides/promotional-subscription-extensions)
- [RevenueCat web subscription management](https://www.revenuecat.com/docs/web/web-billing/managing-customer-subscriptions)
- [RevenueCat webhook event fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)

## Continuation plan — September 13, 2026

1. Recheck live iOS catalog and official same-product timing guidance using read-only requests. Prepare exact offer setup for approval; do not create offers in this local implementation pass.
2. Close native purchase validation gaps: re-fetch the iOS product before accepting, require the reviewed recurring price/currency/period to match, recheck expiry after asynchronous signing/handoff, and clear a failed review so updated terms must be reviewed again.
3. Add contract tests for price changes, missing discounts, expiry and account changes across awaits; run focused native tests, TypeScript and scoped lint. Existing browser E2E does not exercise these store calls.
4. Continue the feedback-specific adapter using the established RevenueCat Web Billing path. Keep Android deferred and all activation controls off.

Review: use the existing store adapter and auth guard, add no billing dependency, preserve reservation-before-handoff order, and never reset a persisted handoff after an ambiguous result. A successful SDK mock remains local evidence only.

## iOS offer setup — created and verified after approval

Initial read-only App Store Connect inspection on September 13 found app `6759300320`, bundle `app.quiversurf.mobile`, subscription group `22043718`, two approved products, and zero promotional offers on either product. The older architecture prose naming `app.quiversurf.native` is not the store identity.

| Product | App Store resource | Verified offer identifier | Reference name | Offer |
| --- | --- | --- | --- | --- |
| `app.quiversurf.surf.pro.monthly` | `6762676915` | `trial_feedback_month_v1` | Trial feedback extra month | Free, one month, one period |
| `app.quiversurf.surf.pro.annual` | `6762675578` | `trial_feedback_month_annual_v1` | Trial feedback extra month annual | Free, one month, one period |

Created one promotional offer on each existing product after explicit user approval, retaining the original product and its standard renewal pricing. RevenueCat In-App Purchase key configuration was subsequently revalidated successfully; see the signing checkpoint below. SDK signatures were subsequently verified for both products; original-trial preservation remains unverified. Do not change the existing two-week introductory offer, base price, subscription level or gift programs. Apple rejected reuse of the monthly name/code on the annual product with HTTP 409; the annual suffix above resolved that uniqueness requirement. Both successful creates returned HTTP 201. Independent GET verification confirmed `FREE_TRIAL`, `ONE_MONTH`, one period, and all 175 existing territories on each product. Before/after snapshots matched for subscription attributes, base prices, introductory offers and availability. All Quiver policy/activation flags remain off until separate acceptance and activation approval.

Apple documents that a promotional offer on the same subscription during an introductory offer takes effect at the next scheduled billing event, then renews at standard price. This supports the adapter choice but is not Quiver sandbox evidence. [Apple timing contract](https://developer.apple.com/documentation/storekit/implementing-promotional-offers-in-your-app). Offer setup and signing are separate requirements. [Apple setup instructions](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-promotional-offers-for-auto-renewable-subscriptions).

Required sandbox acceptance, for both monthly and annual products:

- Record app/build/runtime, sandbox account, original transaction identity, cancellation event, exact product/offer, localized price and store confirmation. Use an isolated sandbox test path; never relabel sandbox receipts as production to pass the production eligibility gate.
- Cancel early, midway and near trial end; submit feedback, review and accept the same-product offer. Verify original trial time is retained, the additional month follows it, no intervening charge occurs, and paid renewal uses the original plan. Record sandbox acceleration separately from real calendar-month expectations.
- Verify cancellation again, declined purchase, account switching, alias/repeated redemption attempts, lost callbacks and delayed receipts. In particular, prove provider-side cohort/once-per-account enforcement; the local reservation guard and public SDK alone do not prove it.
- Preserve the reservation after any uncertain handoff. Confirm the matching provider receipt and eventual paid renewal before claiming outcome validation. Failures must retain feedback and surface an operational reason.

### RevenueCat web recovery integration

RevenueCat Billing documents a billing-period extension without a charge and customer-portal reactivation before expiry. These are separate operations; extending a canceled subscription must not be treated as authorization to resume payment. A RevenueCat implementation must bind extension and customer acceptance to the existing subscription and independently verify both, rather than create a second checkout or reuse the iOS receipt shape. [Extension API/documentation](https://www.revenuecat.com/docs/web/web-billing/managing-customer-subscriptions), [customer reactivation](https://www.revenuecat.com/docs/web/web-billing/customer-portal). The provider decision is resolved. The recovery-specific API contract is now documented and implemented below; current provider configuration and real sandbox behavior still need verification.

## Corrected web billing inventory — September 13, 2026

The earlier statement that Quiver had no web checkout and needed a provider choice was incorrect. These files already exist in this task's own worktree at base `ceb3c7ca6`; no branch integration is required to obtain them:

- `lib/subscription/revenuecat-web-checkout.ts`: existing HTTPS hosted Purchase Link/Funnel builder using `NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL`. Funnels receive the signed-in Supabase UUID in `app_user_id`; Purchase Links receive it in the path.
- `components/pricing/revenuecat-web-checkout-cta.tsx`: auth-aware web checkout CTA, with sign-in when no account is available and no CTA when configuration is invalid/missing.
- `app/api/webhooks/revenuecat/route.ts` and entitlement helpers: shared provider-event and entitlement synchronization path.
- `app/redeem/*` and `lib/redeem/redeem-url.ts`: web success/handoff with validation of the `rc-38aee70261://redeem_web_purchase` scheme.
- Native `src/lib/subscription/revenuecat-client.ts` and `src/providers/subscription-provider.tsx`: existing identity synchronization and SDK web-purchase redemption.

Git source: checkout introduced in `4e01545e0`; hosted-funnel survey preserved in `d088b2cc6` (`.planning/revenuecat-funnel-web-survey-20260812.md`). The survey observed a RevenueCat-hosted screen → checkout → terminal screen. Those observations are historical, not a new live checkout test. The existing trial email price map also names `quiver_pro_web_annual`; its comment is historical evidence, not current billing-price verification.

Use this established integration. Do not ask the user to choose Stripe versus RevenueCat again or build a second generic checkout. The remaining behavior is account-bound recovery of an existing canceled web trial: preserve the original trial boundary, extend by one calendar month, obtain customer acceptance of renewed billing, reconcile actual RevenueCat evidence, and attribute the eventual paid renewal. A generic new-purchase URL alone does not implement those operations.

Configuration evidence and the bounded creation/verification script: [iOS offer setup](/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/email-audit-2026-09-11/trial-feedback-20260913/ios-offer-setup/RESULT.json). Creation approval is fulfilled. It does not certify store redemption or enable Quiver campaign/database controls.

### Signing checkpoint — September 13, 2026

RevenueCat's iOS app `appa879b81eab` / `app.quiversurf.mobile` has In-App Purchase key `G9PSZ7MZZ3`; re-running its credential validation returned `Valid credentials`. The existing reusable QA account has only the gifted promotional entitlement, with no App Store subscription transaction. The installed StoreKit 2 SDK requires a verified subscription transaction/JWS before requesting an offer signature; this is separate from the Quiver entitlement mirror.

The signing/purchase contract suite passed all 16 tests. No live signature was requested and no purchase was made. Next verify both offer signatures with a real Apple sandbox subscription, then retain the purchase/stacking/renewal/cohort gates above. Credential validity alone does not satisfy those gates. Sanitized evidence: [signing verification](/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/email-audit-2026-09-11/trial-feedback-20260913/ios-offer-setup/SIGNING-VERIFICATION.json).

## Web recovery contract checkpoint — September 13, 2026

The provider is RevenueCat Web Billing; do not introduce another checkout. Official [subscription API](https://www.revenuecat.com/docs/api-v2/subscription) and [customer portal](https://www.revenuecat.com/docs/web/web-billing/customer-portal) documentation establish these separate operations:

- Read the existing account-bound subscription and verify `environment=production`, `store=rc_billing`, product identity, trial status, ownership and original period boundaries. RevenueCat v2 `product_id` is an internal product ID, so mapping it to the webhook/store product ID must be verified rather than inferred.
- Extend using `POST /v2/projects/{project_id}/subscriptions/{subscription_id}/actions/extend` with the absolute approved `extend_until_ms`. Do not use relative `extend_by_days` on retries. Read current state before any retry; no idempotency-key guarantee is documented for this endpoint.
- Extending the free period does not itself restore renewal. The customer must review and resume the existing subscription through the portal. `GET .../authenticated_management_url` yields a secure single-use URL; never log or persist its token. No documented subscription API action was found that substitutes for customer reactivation.
- Persist subscription identity, original boundary, target boundary, explicit acceptance, extension reservation/handoff and separate renewal confirmation. Reconcile the actual web subscription/period evidence; a fabricated iOS-style promotional receipt is not proof of web recovery.
- Implement the authenticated adapter, web UI, independent worker reconciliation and tests for stale identity, declined reactivation, lost extension responses, duplicate requests, period/price changes and eventual paid renewal. Keep web recovery offers hidden until this path and its provider sandbox verification are complete.

This contract research is complete. The adapter has since been implemented locally as recorded below. No real provider extension or reactivation was performed during these continuations.

## Web recovery execution plan — September 13 continuation

Implement locally in the existing isolated web worktree. Native v1 remains compatible and continues hiding web offers; the browser gets a separate authenticated web recovery endpoint.

1. Add private web recovery state and an off-by-default control, binding one saved feedback/reservation to one existing RevenueCat subscription and an absolute calendar-month end. Persist handoff before the extension request; ambiguous handoffs are read/reconciled, never blindly retried.
2. Validate the provider account, product mapping, production trial, original period, zero historical charge and lack of pending changes. The extension does not restart billing. Offer a single-use customer portal link only after verified free-time extension; the customer reviews actual pricing and resumes renewal there.
3. Add a small web review card and independent reconciliation to the existing worker/run records/dashboard. Continue readback when new acceptance is paused. Preserve iOS receipt verification separately and do not synthesize receipts for web extensions.
4. Verify provider/API contracts, auth and strict request ownership, SQL policy/concurrency/state, lost responses, exact period preservation, portal URL safety, renewal changes and mobile/desktop UI. Run TypeScript, scoped lint, build and dead-code checks. Keep provider sandbox, activation and production changes as explicit release gates.

Review: no new billing provider or generic checkout; no grant based on client success; keep token-bearing portal URLs out of persisted state/logs; automatic repeat extension is prohibited after handoff. Android remains deferred. No production operation is authorized by this local implementation step.

## Web recovery implementation checkpoint

- New route: `/api/trial-feedback/web`, authenticated/rate-limited with strict bodies and private no-store responses. It binds identity from authentication; clients cannot choose a customer, subscription or extension end. Existing native v1 fields/semantics remain unchanged.
- New controls: `TRIAL_FEEDBACK_WEB_ENABLED=false` and `trial_feedback_controls.web_enabled=false`, additionally requiring the existing feedback/redemption/worker gates and approved product policy before acceptance. Feedback is saved first.
- Validation: reuse identified-account/alias checks; require exactly one active production RevenueCat Billing subscription, original owner, catalog/store product mapping, a two-week introductory product, unchanged original trial bounds, zero gross revenue, no pending payment or product change, and more than five minutes before the original boundary. The boundary margin avoids starting a new handoff immediately before billing.
- Persistence: one private `trial_feedback_web_recoveries` row per account, feedback, reservation and provider subscription. New acceptance reserves under the existing per-account lock. Handoff is written atomically before one absolute `extend_until_ms` request. Concurrent accepts and interrupted responses cannot cause a second extension. An unconfirmed handoff is read/reconciled; there is no automatic mutation retry after handoff.
- Provider readback proves unchanged original start/product/subscription/owner, exact calendar-month end, zero charge and active trial access. Only then is free time shown as confirmed. The same SQL transaction updates Quiver's entitlement mirror only while it still represents that original trial; later paid periods, different products and lifetime access cause a visible review hold. This does not depend on delivery of a new `SUBSCRIPTION_EXTENDED` webhook.
- Paid renewal stays separate. After confirmed free time, the customer opens a validated single-use RevenueCat portal URL to review the actual plan/price and choose renewal. Opening the portal is not treated as acceptance; a later provider read must report `will_renew`. If the customer cancels again, current state returns to `extended`. No price is invented from an indicative catalog amount.
- The existing worker claims up to five web rows with a ten-minute queue interval, records results in its existing run record, and alerts on uncertain/stale work. New acceptance may be paused while existing reservations reconcile. Web extension, mirror and historical renewal confirmation timestamps appear in the private dashboard; paid renewal remains separate processed-ledger evidence. Feedback text, provider snapshots and portal tokens are not exposed there.
- Monitoring ends after the verified extra-free-time boundary; existing paid-renewal outcome attribution continues. Known compatibility boundaries (alias ownership, period status, catalog mapping, portal path) fail closed and require real RevenueCat sandbox verification before policy approval.

Validation includes synthetic interrupted-response and concurrent-accept API/PostgreSQL flows, provider contract tests, unauthorized/strict-body handling, exact-boundary rejection, entitlement protection and browser review/confirmation at mobile and desktop widths. These are local implementation evidence, not real provider transactions, deployed PostgREST, scheduler invocation, alert delivery or iOS stacking proof.

Rollback: pause `web_enabled` and `TRIAL_FEEDBACK_WEB_ENABLED` for new acceptance, retaining the new schema, API and enabled reconciliation worker for already accepted work. Do not roll back to a worker without the web reconciler while reservations remain unresolved. Uncertain handoffs require provider investigation; never clear their handoff guard to retry blindly.

## Optional cancellation feedback and free gifts — September 15, 2026

Local implementation extends the existing non-renewing gift ledger with `manual_month` and `cancellation_month`. These are separate from the store promotional trial-recovery offer above: neither cancels nor restarts subscription renewal. An accepted gift is held while paid, trial, or promotional access is active, then the existing claim worker can fulfill it after that access ends. One calendar month begins on verified fulfillment. No payment method or automatic renewal is created.

Apply `20260915180000_cancellation_feedback_gifts.sql` after the existing September 12–15 lifecycle migrations in a separately approved release. Both new programs start disabled. Activation requires reviewed program terms, approval reference/date, expiry, and award budget in `pro_offer_programs`; `PRO_OFFERS_ENABLED=true` and the existing reconciliation worker must also be operational. This change does not enable any program, apply production migrations, issue gifts, or send messages. New programs are excluded from automated lifecycle marketing.

### Staff gift issuance

Use the existing admin-authenticated `POST /api/admin/offers`:

```json
{"userId":"RECIPIENT_UUID","program":"manual_month","reference":"Support thank-you reference","termsVersion":"APPROVED_TERMS_VERSION","mode":"preview"}
```

Preview reports one month and no session requirement. After program approval, `mode:"issue"` returns `awardId`, `offerToken` (shown only once), and `claimPath:"/offers/claim"`. The code is bound to that recipient account. The recipient signs in and accepts the account offer or enters the code on `/offers/claim`; issuance alone does not grant access. A second issue for the same account/program is rejected. Existing admin controls are the staff surface; batch issuance and revocation tooling remain outside this slice.

### Native contract

- `GET /api/cancellation-feedback` returns `{contract_version:1,user_id,management_store,cancellation_confirmed,feedback_submitted,offer}`. A confirmed cancellation survives later expiration until a new purchase/renewal/uncancellation supersedes it. It does not prove which UI initiated cancellation.
- `POST` with `{action:"submit",request_id,reason,note?}` saves an optional questionnaire. Reasons: `forecast`, `value`, `time`, `feature`, `price`, `technical`, `other`; every note is optional and limited to 2,000 characters. Retry the same request ID; a new explicit flow uses a new ID.
- `POST` with `{action:"accept",request_id,terms_version,accept:true}` returns an account-owned `award_id` once an approved offer is available. Survey submission is not required. Use the existing `/api/offers/claim` to save/fulfill the claim. Only receipt-verified fulfillment is success; acceptance is not subscription retention or cancellation.
- New native/web clients use `/api/offers?include_cancellation_gifts=true` to include new program IDs. GET and enrollment POST retain the two-program response for installed clients that do not opt in.
- Notes are private service-role support data, retained until account deletion with an account foreign-key cascade, matching existing trial feedback. Context and analytics never expose the note. No client note-reading endpoint exists.
- Skip/decline opens store management immediately and must work while the API is unavailable. Cancellation initiated outside Quiver remains observable through provider events.

`management_store` is the authoritative latest provider event store (`APP_STORE`, `PLAY_STORE`, `STRIPE`, `RC_BILLING`, or `null`). Native must not infer billing ownership from device OS. New cancellation gifts are limited to App Store/Play Store subscribers. Web billing users can still provide feedback and should use the subscription management link in their billing email or web billing account; unsupported/unknown stores need clear instructions, not an unrelated Apple/Google handoff. Manual gifts remain cross-platform.
