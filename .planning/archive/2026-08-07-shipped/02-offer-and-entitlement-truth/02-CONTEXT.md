# Phase 2: Offer And Entitlement Truth - Context

**Gathered:** 2026-05-24T15:45:55Z
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase verifies what Quiver can truthfully promise for the founding offer before public pricing copy or live sales. It should audit the current entitlement code, RevenueCat behavior, RevenueCat-managed web purchase options, App Store purchase boundaries, beta/current-user handling, and Supabase migration needs. It may produce local plans and approval checklists, but must not apply production migrations, change external billing configuration, alter production env, or publish purchase claims without explicit approval.

</domain>

<decisions>
## Implementation Decisions

### Purchase Path Truth
- **D-01:** Use RevenueCat as the v1 billing and entitlement path for website lifetime, monthly, and annual options. This should be separate from App Store purchase mechanics, but should still unlock the same RevenueCat Pro entitlement when verified.
- **D-02:** The public v1 conversion path is waitlist/interest until RevenueCat-managed web checkout and entitlement sync are verified.
- **D-03:** Once verified, web purchases should unlock Pro on both web and native through the same entitlement source.
- **D-04:** App Store purchases can remain available later as a separate native path if entitlement state stays consistent.
- **D-05:** Native app messaging and links to web checkout must be reviewed against current App Store rules before any native implementation or claim.

### Founder Eligibility And Existing Users
- **D-06:** Founder eligibility should be decided after the entitlement audit, while protecting existing beta/current users from losing access.
- **D-07:** No beta/current user may be charged without explicit checkout consent.
- **D-08:** If an existing user later buys lifetime on the website, that purchase should replace promotional Pro with a lifetime founder entitlement.
- **D-09:** Lifetime should not be sold until automated entitlement sync is proven.

### Public Offer Boundaries
- **D-10:** Before checkout is verified, public landing copy should show a single "Founding Access Waitlist" offer with no tier names and no prices.
- **D-11:** Approved public timing line: "Early members will get first access when plans open."
- **D-12:** Do not mention cross-platform Pro behavior until Phase 2 audit confirms the entitlement path.
- **D-13:** Pricing copy must not claim purchase availability, lifetime entitlement, App Store purchase, RevenueCat web checkout, RevenueCat entitlement behavior, direct Stripe checkout, or manual grant behavior until verified.

### Approval-Gated External Work
- **D-14:** RevenueCat dashboard/product/entitlement/web purchase configuration, any Stripe gateway/tax/account setup required by RevenueCat, App Store purchase/linking policy changes, Supabase migrations/backfills, and production env changes are approval-gated.
- **D-15:** Phase 2 should produce a concrete approval checklist with exact systems, decisions, and go/no-go tests.
- **D-16:** The checklist must block lifetime sales until automated entitlement sync is proven.
- **D-17:** Supabase migration work may be planned or written after a local plan, but applying production migrations requires explicit approval.

### the agent's Discretion
- Use the research-backed conservative public copy posture unless the audit proves checkout and entitlement behavior end to end.
- Let the code audit decide the exact entitlement schema, migration shape, and whether current promotional Pro preservation already satisfies the user-protection rule.
- Refresh official Apple and RevenueCat docs before implementation because payment and App Review guidance can drift. Refresh Stripe docs only for the gateway/tax/account pieces RevenueCat requires.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Source
- `.planning/PROJECT.md` - Project objective, go-live scope, and launch campaign decisions.
- `.planning/REQUIREMENTS.md` - Phase 2 requirements PRIC-03, PRIC-04, and PRIC-05.
- `.planning/ROADMAP.md` - Phase 2 goal, success criteria, dependencies, and planned work breakdown.
- `.planning/STATE.md` - Current project state, blockers, approval-gated boundaries, and inserted Phase 01.1 context.

### Phase 1 Carry-Forward
- `.planning/phases/01-launch-message-system/01-CONTEXT.md` - Message guardrails that block pricing/payment claims until Phase 2 verification.
- `.planning/phases/01-launch-message-system/01-MESSAGE-MAP.md` - Channel-level claim guardrails for landing, pricing, blog, App Store/TestFlight, email, social, and outreach.
- `.planning/phases/01-launch-message-system/01-VERIFICATION.md` - Phase 1 verification and remaining launch-message constraints.

### Codebase Scout
- `.planning/codebase/ARCHITECTURE.md` - Current app architecture and ownership boundaries.
- `.planning/codebase/INTEGRATIONS.md` - RevenueCat, Supabase, Vercel env, and webhook integration map.
- `.planning/codebase/STACK.md` - Framework, runtime, and local command context.

### Entitlement And Billing Code
- `app/api/webhooks/revenuecat/route.ts` - RevenueCat webhook receiver that mirrors subscription events into `user_entitlements`.
- `app/api/webhooks/revenuecat/entitlement-update.ts` - Event-to-entitlement mapping, promotional product handling, and lifetime promotional Pro preservation logic.
- `lib/alerts/entitlements.ts` - Current premium/free resolver and beta/preview env bypass behavior.
- `supabase/migrations/20260420185916_create_user_entitlements.sql` - Initial `user_entitlements` table definition.
- `supabase/migrations/20260420191616_create_user_entitlements_failed_webhooks.sql` - Failed webhook/DLQ table for RevenueCat reconciliation.
- `__tests__/app/api/webhooks/revenuecat.test.ts` - Existing RevenueCat webhook coverage.
- `__tests__/lib/alerts/entitlements.test.ts` - Existing entitlement resolver coverage.

### Official External References To Refresh
- `https://www.revenuecat.com/docs/web/overview` - RevenueCat web purchase and entitlement capabilities.
- `https://www.revenuecat.com/docs/entitlements` - RevenueCat entitlement model.
- `https://www.revenuecat.com/docs/web/web-billing/configuring-overview` - RevenueCat Web Billing configuration, including Stripe gateway requirements.
- `https://developer.apple.com/app-store/review/guidelines/` - App Store Review Guidelines for purchase and external-link boundaries.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/api/webhooks/revenuecat/route.ts`: Existing authenticated webhook path upserts `user_entitlements`, records failed events, and treats entitlement writes as the load-bearing step.
- `app/api/webhooks/revenuecat/entitlement-update.ts`: Existing logic identifies promotional products with the `rc_promo_` prefix and preserves lifetime promotional Pro rows from non-promotional overwrites.
- `lib/alerts/entitlements.ts`: Existing resolver checks preview/beta env bypasses first, then reads `user_entitlements` and applies expiry/billing-issue logic.

### Established Patterns
- Supabase is the canonical auth/data store; paid state is mirrored into `user_entitlements`.
- RevenueCat webhook authentication depends on `REVENUECAT_WEBHOOK_SECRET` in Vercel env and matching dashboard configuration.
- Production mutations, external billing setup, and env changes are approval-gated. Local plans and tests should come before any Supabase migration or billing configuration request.

### Integration Points
- RevenueCat must be audited for web purchase support, App Store products, entitlement IDs, product IDs, webhook event coverage, and whether a website lifetime purchase can safely map to the same Pro entitlement.
- RevenueCat Web Billing or RevenueCat-managed purchase links/paywalls must be audited for monthly, annual, and lifetime plan mechanics. Direct Stripe checkout is not the v1 path unless RevenueCat cannot support the required purchase/entitlement flow.
- Supabase may need migration or data-backfill planning if the current `user_entitlements` shape cannot distinguish promotional Pro, founder lifetime, web checkout source, App Store source, and historical audit state.
- Native app behavior should consume the same entitlement truth but must not point users to web checkout until App Store policy and implementation are approved.

</code_context>

<specifics>
## Specific Ideas

- Internal paid-plan intent: RevenueCat-managed website lifetime purchase, monthly, and annual.
- Public pre-verification offer: a single "Founding Access Waitlist" CTA.
- Public pre-verification line: "Early members will get first access when plans open."
- Do not show tier names, prices, lifetime purchase language, or cross-platform unlock claims until checkout and entitlement sync are verified.
- Go/no-go rule: no lifetime sales until automated entitlement sync is proven end to end.

</specifics>

<deferred>
## Deferred Ideas

- Live web checkout implementation belongs after the Phase 2 audit and approval checklist.
- Direct Stripe checkout is deferred; use RevenueCat as the v1 billing and entitlement path unless the audit proves RevenueCat cannot support the needed flow.
- Public pricing-page implementation belongs to later landing/pricing phases after Phase 2 truth gates are satisfied.
- Native App Store purchases can remain a separate path later, but only after entitlement unification and App Store policy review.

</deferred>

---

*Phase: 2-Offer And Entitlement Truth*
*Context gathered: 2026-05-24T15:45:55Z*
