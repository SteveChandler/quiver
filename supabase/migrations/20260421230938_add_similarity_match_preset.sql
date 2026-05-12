-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Extends alert_rules.preset_type CHECK to accept 'similarity_match'.
-- Keeps all 8 existing values; adds the new Phase 2 value.
-- Rollback: recreate the constraint with the original 8 values.

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
    'similarity_match'
  ));
