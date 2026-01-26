-- Migration: Add weekend_outlook and weekly_recap email types
-- Part of Email Strategy Overhaul Phase 2

-- Update email_send_log to allow new email types
ALTER TABLE public.email_send_log
  DROP CONSTRAINT IF EXISTS email_send_log_email_type_check;

ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_email_type_check
  CHECK (email_type IN (
    'welcome',
    'daily_best_window',
    'heads_up_alert',
    'weekly_recap',
    'weekend_outlook'
  ));

-- Update forecast_alert_deliveries to allow new alert types
ALTER TABLE public.forecast_alert_deliveries
  DROP CONSTRAINT IF EXISTS forecast_alert_deliveries_alert_type_check;

ALTER TABLE public.forecast_alert_deliveries
  ADD CONSTRAINT forecast_alert_deliveries_alert_type_check
  CHECK (alert_type IN (
    'forecast_threshold',
    'daily_digest_email',
    'weekend_outlook'
  ));

COMMENT ON CONSTRAINT email_send_log_email_type_check ON public.email_send_log IS
  'Added weekly_recap and weekend_outlook types for email strategy overhaul (2026-01-26)';

COMMENT ON CONSTRAINT forecast_alert_deliveries_alert_type_check ON public.forecast_alert_deliveries IS
  'Added weekend_outlook type for weekend warrior emails (2026-01-26)';
