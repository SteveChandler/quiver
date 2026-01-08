-- Add daily_digest_email to forecast_alert_deliveries alert_type constraint
-- This enables tracking of daily digest email deliveries alongside push notifications.
-- Non-destructive migration.

BEGIN;

-- Drop existing constraint and add new one with expanded alert types
ALTER TABLE public.forecast_alert_deliveries
  DROP CONSTRAINT IF EXISTS forecast_alert_deliveries_alert_type_check;

ALTER TABLE public.forecast_alert_deliveries
  ADD CONSTRAINT forecast_alert_deliveries_alert_type_check
  CHECK (alert_type IN ('forecast_threshold', 'daily_digest_email'));

COMMENT ON COLUMN public.forecast_alert_deliveries.alert_type IS
  'Type of alert: forecast_threshold (push notification) or daily_digest_email (morning digest)';

COMMIT;
