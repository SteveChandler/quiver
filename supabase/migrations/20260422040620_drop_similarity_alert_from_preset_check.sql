-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Remove the deprecated 'similarity_alert' value from alert_rules.preset_type.
-- Phase 1 preset retired; native app now writes 'similarity_match' (commit a1b8504).
-- Pre-verified: 0 existing rows on this value, 0 queued alerts on paired alert_type.

BEGIN;

-- Safety re-check inside the tx — fail loudly if any row materialized since the
-- code-side grep verification.
DO $$
DECLARE
  v_existing integer;
BEGIN
  SELECT COUNT(*) INTO v_existing
    FROM alert_rules
    WHERE preset_type = 'similarity_alert';
  IF v_existing > 0 THEN
    RAISE EXCEPTION 'abort: % rows still use preset_type=similarity_alert; rename them before dropping the value', v_existing;
  END IF;
END $$;

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
    'similarity_match'
  ));

COMMIT;
