-- Auto-enable similarity_match alert rules for active Pro/trial users.
--
-- Background: Quiver Pro promises "your good days, on repeat" — the
-- similarity-alerts cron (app/api/cron/similarity-alerts/route.ts) is wired
-- end-to-end and ALERTS_DELIVERY_ENABLED=true in prod, but ZERO users have
-- an enabled similarity_match alert_rules row because the feature requires
-- explicit opt-in via the alert management UI. Net effect: a Pro flagship
-- promise has zero recipients.
--
-- This migration ships two changes:
--
-- 1. Adds `auto_created_at timestamptz NULL` to alert_rules so we can
--    distinguish system-seeded rows from user-created ones. Null = created
--    by a user (manually or via the existing seed-default flow). Non-null =
--    auto-created at this timestamp by the Pro auto-enable system.
--
-- 2. Backfills one similarity_match rule per active Pro/trial user who:
--      - has profiles.home_beach_id set (rule must point at a beach)
--      - has no existing similarity_match row in alert_rules (regardless of
--        enabled OR auto_created_at). This is the deletion-respect contract:
--        a user who once had the rule and deleted it stays opted out, and a
--        user who manually created their own rule isn't double-tracked.
--      - is "active Pro/trial" per the same logic as
--        lib/alerts/entitlements.ts:entitlementFromRow:
--          (is_pro = true OR is_trialing = true)
--          AND (expires_at IS NULL OR billing_issue = true OR expires_at >= now())
--        The expires_at staleness guard with the billing_issue carve-out
--        mirrors entitlementFromRow exactly so this backfill matches the
--        runtime entitlement check used by the cron.
--
-- Forward path: app/api/webhooks/revenuecat/route.ts will call a TS helper
-- (lib/alerts/auto-enable-similarity.ts) on every entitlement upsert that
-- lands the user in is_pro=true OR is_trialing=true, so new Pro users get
-- their rule on entitlement grant. The helper enforces the same
-- "deletion-respect: skip if any similarity_match row already exists"
-- contract as this backfill.
--
-- The similarity-alerts cron already iterates enabled rules with
-- preset_type='similarity_match' — once rules exist, it Just Works. No
-- cron change needed.
--
-- Idempotent: re-running this migration after the first apply inserts zero
-- rows (the WHERE NOT EXISTS clause covers it). The column add uses
-- IF NOT EXISTS so the ALTER is also a no-op on replay.
--
-- Channel defaults mirror the mellow_session pattern: notify_push=true,
-- notify_email=false. Push only — emails on similarity matches feel like
-- spam vs the high-signal hourly cadence push provides.
--
-- Rollback (do not run as part of this migration; document only):
--   BEGIN;
--   DELETE FROM alert_rules
--    WHERE preset_type = 'similarity_match'
--      AND auto_created_at IS NOT NULL;
--   ALTER TABLE alert_rules DROP COLUMN IF EXISTS auto_created_at;
--   COMMIT;

BEGIN;

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS auto_created_at timestamptz NULL;

COMMENT ON COLUMN alert_rules.auto_created_at IS
  'Non-null when this rule was system-created (e.g., similarity_match auto-enable for Pro/trial users). Null = user-created. Used to distinguish auto-seeded rows from manual rules in audit/analytics.';

INSERT INTO alert_rules (
  user_id,
  beach_id,
  name,
  preset_type,
  conditions,
  notify_email,
  notify_push,
  enabled,
  auto_created_at
)
SELECT
  p.id,
  p.home_beach_id,
  'Conditions like your best sessions',
  'similarity_match',
  '{}'::jsonb,
  false,
  true,
  true,
  now()
FROM profiles p
JOIN user_entitlements ue ON ue.user_id = p.id
WHERE p.home_beach_id IS NOT NULL
  AND (ue.is_pro = true OR ue.is_trialing = true)
  AND (
    ue.expires_at IS NULL
    OR ue.billing_issue = true
    OR ue.expires_at >= now()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM alert_rules r
    WHERE r.user_id = p.id
      AND r.preset_type = 'similarity_match'
  );

COMMIT;
