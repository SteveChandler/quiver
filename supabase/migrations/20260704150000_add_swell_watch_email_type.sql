-- Add Swell Watch email type values for email logging and delivery dedupe.

BEGIN;

ALTER TABLE public.email_send_log
  DROP CONSTRAINT IF EXISTS email_send_log_email_type_check;

ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_email_type_check
  CHECK (email_type IN (
    'welcome',
    'forecast_digest',
    'reengagement',
    'weekly_recap',
    'conditions_alert',
    'session_prompt',
    'swell_watch'
  ));

COMMENT ON CONSTRAINT email_send_log_email_type_check ON public.email_send_log IS
  'Allowed email types: welcome, forecast_digest, reengagement, weekly_recap, conditions_alert, session_prompt, swell_watch';

ALTER TABLE public.forecast_alert_deliveries
  DROP CONSTRAINT IF EXISTS forecast_alert_deliveries_alert_type_check;

ALTER TABLE public.forecast_alert_deliveries
  ADD CONSTRAINT forecast_alert_deliveries_alert_type_check
  CHECK (alert_type IN (
    'forecast_threshold',
    'daily_digest_email',
    'conditions_alert',
    'session_prompt',
    'reengagement',
    'swell_watch_email'
  ));

COMMENT ON CONSTRAINT forecast_alert_deliveries_alert_type_check ON public.forecast_alert_deliveries IS
  'Allowed alert types: forecast_threshold, daily_digest_email, conditions_alert, session_prompt, reengagement, swell_watch_email';

COMMIT;
