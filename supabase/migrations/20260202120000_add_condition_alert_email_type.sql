-- Migration: Add 'condition_alert' to email_send_log email_type constraint
-- Part of User Engagement feature
--
-- Note: The condition-alert-email cron uses forecast_alert_deliveries for dedup,
-- but we add this type for potential future use and analytics consistency.

BEGIN;

-- Drop the existing constraint
ALTER TABLE public.email_send_log
  DROP CONSTRAINT IF EXISTS email_send_log_email_type_check;

-- Add the new constraint with 'condition_alert' included
ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_email_type_check
  CHECK (email_type IN (
    'welcome',
    'daily_best_window',
    'heads_up_alert',
    'condition_alert',
    'reengagement',
    'weekly_recap',
    'weekend_outlook'
  ));

COMMENT ON COLUMN public.email_send_log.email_type IS
  'Type of email sent: welcome, daily_best_window, heads_up_alert, condition_alert, reengagement, weekly_recap, weekend_outlook';

COMMIT;
