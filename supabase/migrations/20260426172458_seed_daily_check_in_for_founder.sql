-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Seed a daily_check_in alert for the founder account so Phase-2 validation
-- has a guaranteed-firing rule to exercise the engine. The rule fires both
-- email and push channels; delivery is gated by ALERTS_DELIVERY_ENABLED until
-- Phase-4 promotion.
--
-- Founder user_id: 73040cff-afe9-4fa0-a874-2016203fc015
-- Spec: docs/archive/superpowers/specs/2026-04-25-alerts-engine-fix-and-anon-capture-design.md A3

BEGIN;

INSERT INTO alert_rules (user_id, beach_id, name, preset_type, conditions, notify_email, notify_push, enabled)
SELECT
  '73040cff-afe9-4fa0-a874-2016203fc015'::uuid,
  p.home_beach_id,
  'Daily check-in — ' || COALESCE(b.name, 'home beach'),
  'daily_check_in',
  jsonb_build_object('swell_height_min', 0.5, 'wind_speed_max_kt', 25),
  true,
  true,
  true
FROM profiles p
LEFT JOIN beaches b ON b.id = p.home_beach_id
WHERE p.id = '73040cff-afe9-4fa0-a874-2016203fc015'
  AND p.home_beach_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM alert_rules ar
    WHERE ar.user_id = '73040cff-afe9-4fa0-a874-2016203fc015'
      AND ar.preset_type = 'daily_check_in'
  );

COMMIT;
