-- Migration: Simplify email types to reduce email spam
-- Consolidates to 4 core email types: welcome, forecast_digest, reengagement, weekly_recap
--
-- Removed types:
-- - daily_best_window (merged into forecast_digest)
-- - heads_up_alert (never implemented)
-- - condition_alert (removed to reduce spam)
-- - weekend_outlook (merged into forecast_digest on Thursdays)
--
-- The forecast_digest now runs Mon/Thu instead of daily.

BEGIN;

-- First, migrate any existing email log entries to the new types
-- daily_best_window -> forecast_digest (same concept, just renamed)
UPDATE public.email_send_log
SET email_type = 'forecast_digest'
WHERE email_type = 'daily_best_window';

-- Update the constraint with simplified email types
ALTER TABLE public.email_send_log
  DROP CONSTRAINT IF EXISTS email_send_log_email_type_check;

ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_email_type_check
  CHECK (email_type IN (
    'welcome',
    'forecast_digest',
    'reengagement',
    'weekly_recap'
  ));

-- Update forecast_alert_deliveries constraint as well
ALTER TABLE public.forecast_alert_deliveries
  DROP CONSTRAINT IF EXISTS forecast_alert_deliveries_alert_type_check;

ALTER TABLE public.forecast_alert_deliveries
  ADD CONSTRAINT forecast_alert_deliveries_alert_type_check
  CHECK (alert_type IN (
    'forecast_threshold',
    'daily_digest_email'
  ));

COMMENT ON COLUMN public.email_send_log.email_type IS
  'Type of email sent: welcome (onboarding), forecast_digest (Mon/Thu forecast), reengagement (lapsed user), weekly_recap (weekly summary)';

COMMENT ON CONSTRAINT email_send_log_email_type_check ON public.email_send_log IS
  'Simplified email types to reduce spam (2026-02-03): welcome, forecast_digest, reengagement, weekly_recap';

COMMENT ON CONSTRAINT forecast_alert_deliveries_alert_type_check ON public.forecast_alert_deliveries IS
  'Simplified alert types (2026-02-03): forecast_threshold, daily_digest_email';

COMMIT;
