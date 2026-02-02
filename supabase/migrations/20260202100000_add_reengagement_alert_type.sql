-- Migration: Add reengagement alert type for re-engagement emails
-- Part of re-engagement email system for inactive users

-- Update forecast_alert_deliveries to allow reengagement alert type
ALTER TABLE public.forecast_alert_deliveries
  DROP CONSTRAINT IF EXISTS forecast_alert_deliveries_alert_type_check;

ALTER TABLE public.forecast_alert_deliveries
  ADD CONSTRAINT forecast_alert_deliveries_alert_type_check
  CHECK (alert_type IN (
    'forecast_threshold',
    'daily_digest_email',
    'weekend_outlook',
    'reengagement'
  ));

COMMENT ON CONSTRAINT forecast_alert_deliveries_alert_type_check ON public.forecast_alert_deliveries IS
  'Added reengagement type for inactive user re-engagement emails (2026-02-02)';
