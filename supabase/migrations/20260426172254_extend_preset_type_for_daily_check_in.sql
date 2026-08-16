-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Add 'daily_check_in' to alert_rules.preset_type. This is a deliberately
-- loose validation preset that proves the engine end-to-end. See
-- docs/archive/superpowers/specs/2026-04-25-alerts-engine-fix-and-anon-capture-design.md
-- section A3.

BEGIN;

ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_preset_type_check;

ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_preset_type_check
  CHECK (preset_type IN (
    'glass_off',
    'big_day',
    'clean_groundswell',
    'mellow_session',
    'tide_window',
    'dawn_patrol',
    'epic_conditions',
    'similarity_alert',
    'similarity_match',
    'daily_check_in'
  ));

COMMIT;
