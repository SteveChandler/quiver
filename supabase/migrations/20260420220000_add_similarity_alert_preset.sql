-- Extends alert_rules.preset_type CHECK to accept 'similarity_alert'.
--
-- Similarity alerts are a paid-tier feature: a cron evaluator will iterate
-- each rule's user's rated sessions against upcoming forecast hours at the
-- rule's beach, and enqueue an alert when compute_spot_similarity_score
-- returns a score above the rule's conditions.threshold (default 7.5).
-- Gating is enforced in application code (lib/alerts/entitlements.ts);
-- this migration only opens the DB door so the INSERT can land.
--
-- Rollback:
--   ALTER TABLE alert_rules DROP CONSTRAINT alert_rules_preset_type_check;
--   ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_preset_type_check
--     CHECK (preset_type IN (
--       'glass_off', 'big_day', 'clean_groundswell', 'mellow_session',
--       'tide_window', 'dawn_patrol', 'epic_conditions'
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
    'similarity_alert'
  ));

COMMIT;
