# Phase 2: Offer And Entitlement Truth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-24T15:45:55Z
**Phase:** 2-Offer And Entitlement Truth
**Areas discussed:** Purchase path truth, founder eligibility, offer boundaries, approval-gated external work

---

## Purchase Path Truth

| Option | Description | Selected |
|--------|-------------|----------|
| RevenueCat/App Store purchase | Treat App Store or RevenueCat-native purchase as the primary public path. | |
| RevenueCat Web Billing/web checkout | Treat RevenueCat-managed website checkout as the primary purchase path. | x |
| Manual founder grant | Take interest/payment manually and grant founder access by admin process. | |
| Waitlist/interest only | Collect interest until checkout and entitlement sync are verified. | x |
| Hybrid | Use public interest path now, then enable purchase only after verification. | x |

**User's choice:** RevenueCat should be the v1 web billing and entitlement path. Website checkout should eventually sell lifetime, monthly, and annual options, separate from App Store purchase. Until checkout is verified, the public path should be waitlist/interest only.

**Follow-up decisions:**
- Verified web purchases should unlock Pro on both web and native through the same entitlement source.
- App Store purchases can remain a separate native path later if entitlements stay consistent.

**Notes:** Official docs were briefly checked during discussion. RevenueCat web and entitlement docs indicate web purchases can feed entitlement state, and Apple App Review rules create the policy boundary for native linking/purchase messaging. Stripe may still be involved as the payment gateway/tax/account layer behind RevenueCat, but direct Stripe checkout is not the v1 path unless the audit proves RevenueCat cannot support the needed flow.

---

## Founder Eligibility

| Option | Description | Selected |
|--------|-------------|----------|
| New launch waitlist only | Founder status applies only to new users who join during launch. | |
| Existing plus new users | Existing beta/current users and new launch waitlist users are eligible. | |
| Preserve Pro, paid lifetime later | Existing users keep promotional Pro, while founder lifetime is only for future paid web checkout. | |
| Decide after audit and protect access | Audit existing code before deciding, while protecting beta/current users from losing access. | x |

**User's choice:** Decide founder status after entitlement audit, but protect all existing beta/current users from losing access.

**Follow-up decisions:**
- No charge may happen without explicit checkout consent.
- If an existing user later buys lifetime on the website, that purchase should replace promotional Pro with a lifetime founder entitlement.
- Do not sell lifetime until automated entitlement sync works.

**Notes:** Current code appears to preserve lifetime promotional Pro rows in the RevenueCat entitlement updater, but Phase 2 must verify whether that behavior matches the intended founder model and whether additional schema/history fields are needed.

---

## Offer Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Show three planned tiers with waitlist CTAs | Publicly show tier structure but route conversion to waitlist. | |
| Mention founding lifetime without prices | Tease lifetime access only. | |
| Pricing coming soon | Avoid specific offer structure. | |
| No pricing until verified | Hide pricing structure entirely. | |
| Single founding waitlist | Show one waitlist offer with no tier names or prices. | x |

**User's choice:** Public landing page should show a single "Founding Access Waitlist" offer before checkout is verified.

**Follow-up decisions:**
- Do not name monthly, annual, or lifetime tiers yet.
- Use: "Early members will get first access when plans open."
- Mention cross-platform Pro behavior only after the Phase 2 audit confirms the entitlement path.

**Notes:** There was a tension between showing three planned tiers and not naming tiers. After research and review of payment/platform risk, the selected posture is a single waitlist offer with no tier names, prices, or live-purchase claims.

---

## Approval-Gated External Work

| Option | Description | Selected |
|--------|-------------|----------|
| RevenueCat config | Product, entitlement, webhook, or dashboard changes. | x |
| Stripe setup | Gateway, account, or tax setup only where RevenueCat requires it. Direct Stripe checkout is not the v1 path. | x |
| App Store policy/path changes | Purchase, linking, or native checkout policy decisions. | x |
| Supabase migrations/backfills | Schema changes or entitlement data updates. | x |
| Production env changes | Vercel or other production secrets/config. | x |
| All external work | Treat all listed external/prod-impacting systems as approval-gated. | x |

**User's choice:** All external work is approval-gated before execution.

**Follow-up decisions:**
- Phase 2 should produce a concrete approval checklist with exact systems and decisions.
- The checklist should include go/no-go tests for selling lifetime access.
- Lifetime sales must be blocked until automated entitlement sync is proven.
- Supabase migration work can be included after a local plan, but applying production migrations still requires explicit approval.

**Notes:** Phase 2 planning should distinguish local audit/planning from production-impacting actions. The user selected Supabase migration work as potentially in scope after a local plan, but this does not approve production application.

---

## the agent's Discretion

- Recommend conservative public offer copy until checkout and entitlement sync are proven.
- Use official payment/platform docs as live references during implementation because payment rules and product capabilities can change.
- Let the code audit decide whether existing promotional Pro preservation is sufficient or needs a founder-specific schema path.

## Deferred Ideas

- Enable web checkout for monthly, annual, and lifetime after audit and approval.
- Direct Stripe checkout; RevenueCat is the selected v1 billing and entitlement path unless the audit proves it cannot support the required flow.
- Keep App Store purchase as a later separate native path if entitlement consistency is proven.
- Add public tier names, prices, and cross-platform Pro claims only after Phase 2 truth gates pass.
