# Quiver Monetization Plan

## Context

Quiver is a surf forecasting and session tracking app with ~7 users and zero monetization infrastructure. The surf app market has a clear gap: Surfline ($80-100/yr) dominates through cameras but is widely resented (Magicseaweed shutdown, aggressive paywalling). Competitors like Glassy sit at $30-50/yr. Research confirms surfers will pay $3-7/mo for genuinely useful tools, and Quiver's ML-corrected forecasts + social features justify premium positioning.

**Goal:** Add a full paywall with 3 pricing tiers, a founding member presale, and a 7-day free trial across web and native platforms.

---

## Pricing Strategy

| Plan | Monthly | Annual Equiv. | Notes |
|------|---------|---------------|-------|
| Monthly | $5/mo | $5/mo | — |
| Annual | $48/yr | $4/mo | 20% savings vs monthly |
| Lifetime | $60 | — | One-time purchase, never expires |
| **Founding Member** | $40 lifetime | — | First 100 users only, then reverts to $60 |

- **No free tier** — full paywall after 7-day free trial
- **Trial starts automatically** on signup (database trigger)
- Public pages (beach pages, forecast, map) remain accessible for SEO
- Protected routes (dashboard, profile, journal, session logging, discover, inbox) require active subscription

---

## Market Research Summary

### Competitive Landscape

| Competitor | Price | Model | Key Differentiator |
|-----------|-------|-------|--------------------|
| **Surfline** | $80-100/yr | Freemium (aggressive paywall) | 800+ cameras, dominant brand |
| **Dawn Patrol** | $5-8/mo | Freemium | Morning check use case |
| **Windy** | ~$22/yr | Freemium (generous free) | General weather, huge user base |
| **Stoked** | ~$30/yr | Freemium | Session journal only |

### Why This Pricing Works

- **Undercuts Surfline by ~40%** ($48/yr vs $80-100/yr) — captures price-sensitive surfers frustrated by Surfline's aggressive paywalling
- **$5/mo sits in the sweet spot** — research shows surfers willing to pay $3-7/mo for quality tools
- **Lifetime at $60 creates urgency** — especially at $40 founding member rate, it's an impulse buy ("less than a new leash")
- **Annual discount is meaningful** (20%) but not so steep that monthly feels punitive
- **No free tier signals premium** — "if it's free, you're the product" resonates with the anti-Surfline crowd

### Surfline Vulnerability

The Magicseaweed shutdown (mid-2023) created lasting community resentment. Common sentiment: "I hate that I need Surfline." Their moat is cameras, not forecasts. Quiver competes on forecast accuracy (ML-corrected), session tracking depth, and genuine social/community features — none of which Surfline does well.

---

## Payment Infrastructure

- **Native (iOS/Android):** RevenueCat wrapping Apple StoreKit + Google Play Billing
- **Web:** Stripe Checkout + Stripe Customer Portal
- **Unified backend:** Both platforms write to a single `subscriptions` table in Supabase via webhooks
- Apple/Google Small Business Program = 15% cut (under $1M/yr)

### Why RevenueCat + Stripe (not one or the other)

- Apple **requires** in-app purchase for digital content subscriptions in iOS apps — no way around it
- RevenueCat is the industry standard wrapper (free under $2.5K MTR), handles receipt validation and entitlement management
- Stripe for web keeps ~97% of revenue vs 70-85% through app stores
- RevenueCat has native Stripe integration for unified subscription management
- RevenueCat app user ID = Supabase user ID ensures cross-platform entitlement sync

---

## Implementation Phases

### Phase 1: Database & Backend (no user impact)

**Migration:** `supabase/migrations/YYYYMMDD_create_subscription_tables.sql`

3 new tables:
1. **`subscriptions`** — single source of truth per user (status, plan_type, platform, stripe/revenuecat IDs, trial dates, period dates, founding member flag/number). Unique on `user_id`. RLS: users read own only, writes via service_role.
2. **`subscription_events`** — append-only audit log of all webhook events (event_type, platform, raw payload). RLS: users read own only.
3. **`founding_member_counter`** — single-row atomic counter (total_claimed, max_slots=100). RLS: read by authenticated users.

2 helper functions:
- `check_user_entitlement(user_id)` — returns boolean, used by middleware
- `claim_founding_member_slot(user_id)` — atomic slot claim with row lock, returns slot number or NULL

1 trigger:
- `on_auth_user_created_create_trial` — auto-creates 7-day trial subscription on signup

**Entitlement service:** `quiver/lib/services/entitlement-service.ts`
- `checkEntitlement(supabase, userId)` returns `{ hasAccess, status, planType, trialEndsAt, isFoundingMember, foundingMemberNumber }`
- Used by middleware, server actions, and client context

**Backfill existing users:** Give all ~7 current users a 30-day extended trial + honorary founding member status (doesn't count against the 100 slots).

### Phase 2: Stripe + Web Monetization

**New files:**
- `quiver/lib/stripe/config.ts` — Stripe server instance + price ID constants
- `quiver/lib/stripe/client.ts` — client-side `loadStripe`
- `quiver/app/actions/subscription-actions.ts` — `createCheckoutSession(planType)` and `createPortalSession()` using `withAuthenticatedAction`
- `quiver/app/api/webhooks/stripe/route.ts` — signature-verified webhook endpoint
- `quiver/lib/services/stripe-webhook-handler.ts` — maps Stripe events to subscription state:
  - `checkout.session.completed` (payment mode) -> active lifetime, claim founding slot
  - `checkout.session.completed` (subscription mode) -> trialing
  - `customer.subscription.updated` (active) -> active
  - `customer.subscription.deleted` -> canceled
  - `invoice.payment_failed` -> past_due

**Paywall UI:**
- `quiver/app/pricing/page.tsx` — pricing page with 3 cards + founding member counter + free trial CTA
- `quiver/context/subscription-context.tsx` — client state provider (mirrors auth-context pattern)
- `quiver/components/subscription/pricing-cards.tsx` — plan selection cards
- `quiver/components/subscription/subscription-gate.tsx` — wraps premium features
- `quiver/components/subscription/trial-banner.tsx` — "X days left" in header
- `quiver/components/subscription/founding-member-badge.tsx` — profile badge
- `quiver/app/subscription/success/page.tsx` — post-checkout confirmation

**Modified files:**
- `quiver/middleware.ts` — add subscription check after auth for protected routes
- `quiver/lib/middleware/route-guard.ts` — add `SUBSCRIPTION_REQUIRED_PATHS`
- `quiver/lib/server-action-utils.ts` — add `withSubscribedAction` wrapper
- `quiver/components/providers.tsx` — add `<SubscriptionProvider>` in provider tree
- `quiver/.env.example` — add Stripe + RevenueCat env vars

### Phase 3: RevenueCat + Native Monetization

**New files:**
- `quiver-native/src/lib/purchases.ts` — `configurePurchases(userId)` and `resetPurchases()`
- `quiver-native/src/hooks/use-purchases.ts` — TanStack Query hooks: `useOfferings()`, `useEntitlement()`, `usePurchase()`, `useRestorePurchases()`
- `quiver-native/src/hooks/use-subscription.ts` — queries Supabase `subscriptions` table
- `quiver-native/src/hooks/use-founding-member-slots.ts` — founding member counter query
- `quiver-native/src/stores/subscription-store.ts` — Zustand store for synchronous access checks
- `quiver-native/src/screens/paywall.tsx` — native paywall with plan selector, founding member callout, purchase button, restore link
- `quiver/app/api/webhooks/revenuecat/route.ts` — header-auth webhook endpoint
- `quiver/lib/services/revenuecat-webhook-handler.ts` — maps RC events to subscription state

**Modified files:**
- `quiver-native/app.config.js` — add `react-native-purchases` plugin
- `quiver-native/src/providers/auth-provider.tsx` — call `configurePurchases(userId)` on auth
- `quiver-native/src/navigation/root-navigator.tsx` — paywall gate before main content
- `quiver-native/src/navigation/types.ts` — add Paywall screen type
- `quiver-native/src/screens/settings.tsx` — add subscription management section

### Phase 4: Email & Polish

- `quiver/app/api/cron/expire-trials/route.ts` — daily cron to expire trials
- `quiver/app/api/cron/trial-expiring-email/route.ts` — 24hr warning email
- `quiver/lib/mailer/templates/TrialExpiringEmail.tsx` — trial warning template
- `quiver/lib/mailer/templates/FoundingMemberEmail.tsx` — founding member welcome
- Add founding member badges to web/native profile screens
- Cross-platform testing (subscribe on web, verify on native and vice versa)

---

## Key Architecture Decisions

1. **Supabase is the single source of truth** — not Stripe, not RevenueCat. Both write to `subscriptions` via webhooks. Both apps read from `subscriptions`.
2. **Defense-in-depth** — paywall enforced at middleware level (route redirect), server action level (`withSubscribedAction`), and component level (`<SubscriptionGate>`).
3. **RevenueCat app user ID = Supabase user ID** — configured at auth time, ensures webhook payloads link directly to users.
4. **Founding member counter is atomic** — PostgreSQL row lock prevents overselling. Edge case: if a user pays $40 but the slot is claimed before their webhook arrives, still honor it (they paid the founding price).
5. **Trial is database-native** — trigger on user creation, no external dependency. Works identically regardless of signup platform.

---

## Revenue Projections (Conservative)

| Milestone | Total Users | Paying (6% conv.) | ARR |
|-----------|-------------|-------------------|-----|
| 6 months | 5,000 | 300 | $15K |
| Year 1 | 50,000 | 3,000 | $150K |
| Year 2 | 200,000 | 12,000 | $600K |

Assumes 6% conversion rate (conservative for niche passion-market) and ~$50 avg revenue per paying user (mix of monthly/annual/lifetime).

---

## Existing User Migration

- All ~7 current users receive **30-day extended trial** (not 7 days)
- All receive **honorary founding member status** (doesn't count against 100 slots)
- Personal email notification explaining the change, thanking them, offering $40 lifetime deal
- No auto-billing — they choose to subscribe during their extended trial

---

## Verification

1. **Database:** Run migration locally, verify tables/functions/trigger exist, test `check_user_entitlement` and `claim_founding_member_slot` RPCs
2. **Web checkout:** Create test Stripe products, complete a checkout flow, verify webhook updates `subscriptions` table
3. **Native purchase:** Configure RevenueCat sandbox, make a test purchase, verify webhook updates `subscriptions` table
4. **Paywall enforcement:** Verify unauthenticated users see public pages, trial users access everything, expired users redirect to `/pricing`
5. **Cross-platform:** Subscribe on web, verify native app shows active subscription (and vice versa)
6. **Founding member:** Purchase lifetime when slots available, verify counter increments and badge appears. Purchase when all slots claimed, verify $60 price is used.
7. **Trial expiration:** Fast-forward trial end date in DB, run expire-trials cron, verify user is locked out and redirect works
8. **Existing users:** Verify backfill gives 30-day trial and founding member flag
