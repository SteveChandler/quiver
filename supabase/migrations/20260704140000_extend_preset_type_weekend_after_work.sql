-- Add Weekend Warrior and After Work preset types to alert_rules.preset_type.

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
    'daily_check_in',
    'weekend_warrior',
    'after_work'
  ));

COMMIT;
