-- Extends alert_rules.preset_type CHECK to accept 'similarity_match'.
--
-- Phase 2 similarity redesign introduces a new RPC (compute_user_match_score)
-- and replaces the old 'similarity_alert' preset wiring. The old preset stays
-- in the allowed set for a deprecation window; new Phase 2 alert rules are
-- written with preset_type = 'similarity_match' and scored hourly by the
-- /api/cron/similarity-alerts route.
--
-- Rollback:
--   ALTER TABLE alert_rules DROP CONSTRAINT alert_rules_preset_type_check;
--   ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_preset_type_check
--     CHECK (preset_type IN (
--       'glass_off', 'big_day', 'clean_groundswell', 'mellow_session',
--       'tide_window', 'dawn_patrol', 'epic_conditions', 'similarity_alert'
--     ));

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
    'similarity_match'
  ));

COMMIT;
