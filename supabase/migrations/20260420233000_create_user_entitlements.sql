-- user_entitlements — Supabase mirror of RevenueCat subscription state.
--
-- Source of truth is RevenueCat (read by the client from the RC SDK for instant
-- post-purchase updates). This table is the server-side mirror maintained by a
-- webhook at /api/webhooks/revenuecat so cron jobs and server routes can gate
-- features on entitlement without a round-trip to RC.
--
-- Typical lag between RC purchase and this table reflecting: 2-10 seconds.
-- Clients DO NOT read this table for entitlement (use the RC SDK for that);
-- server code DOES read this table.
--
-- See quiver-native/docs/superpowers/specs/2026-04-16-subscription-paywall-design.md
-- for the full architecture.
--
-- Rollback:
--   DROP TABLE IF EXISTS user_entitlements CASCADE;

BEGIN;

CREATE TABLE user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Active paid tier flag. True during active PRO and TRIALING and BILLING_ISSUE
  -- (grace period). False for FREE and LAPSED.
  is_pro boolean NOT NULL DEFAULT false,

  -- Discriminates TRIALING vs PRO within is_pro=true. Both charge at Day 14
  -- but only PRO has collected money; the UI needs this to show the "trial
  -- ends in N days" banner and to avoid the CANCELLATION → pre-charge flow.
  is_trialing boolean NOT NULL DEFAULT false,

  -- Trial end (Day 14 conversion). Populated during TRIALING, null once PRO.
  trial_ends_at timestamptz,

  -- Subscription end. For TRIALING, same as trial_ends_at. For PRO, next
  -- renewal date. Used by server gating as a safety check against stale
  -- webhook state ("is_pro is true but expires_at is in the past" → treat
  -- as LAPSED until RC correction arrives).
  expires_at timestamptz,

  -- Product identifier from RC Offerings (e.g., 'com.quiver.pro.annual').
  product_id text,

  -- Whether the subscription is set to auto-renew. Flips false on
  -- CANCELLATION event; the user keeps is_pro=true until expires_at.
  will_renew boolean NOT NULL DEFAULT false,

  -- True during billing-retry grace (Apple up to 60 days, Google up to 30).
  -- During this window is_pro stays true; the UI shows a soft "update your
  -- payment method" banner.
  billing_issue boolean NOT NULL DEFAULT false,

  -- When the subscription lapsed — preserved across re-subscription for
  -- read-only data preservation (custom spots, frozen favorites). Null when
  -- the user has never lapsed OR is currently active.
  lapsed_at timestamptz,

  -- Product ID at last lapse — drives re-subscribe copy ("Resume Pro").
  previous_product_id text,

  -- Last raw RC webhook payload — kept for debugging webhook drift without
  -- needing the RC dashboard. Truncated downstream if size becomes an issue.
  rc_raw jsonb,

  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- is_pro filter is the hottest query (cron evaluators check entitlement per
-- user_id) — PRIMARY KEY on user_id already covers the lookup.

-- Partial index for server-side "all active pro users" sweeps (future:
-- eligibility audits, RC state reconciliation crons).
CREATE INDEX idx_user_entitlements_active
  ON user_entitlements(user_id)
  WHERE is_pro = true;

ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;

-- Users can read their own row (useful for diagnostic/settings screens).
-- Clients should still prefer the RC SDK for live state — this is for
-- server-rendered components that need entitlement in SSR.
CREATE POLICY "Users can read own entitlement"
  ON user_entitlements FOR SELECT
  USING (auth.uid() = user_id);

-- Writes are service-role only. The webhook and any future admin tool
-- are the only legitimate writers.
CREATE POLICY "Service role can manage entitlements"
  ON user_entitlements FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Mirror the updated_at pattern used elsewhere in the schema.
CREATE TRIGGER set_user_entitlements_updated_at
  BEFORE UPDATE ON user_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
