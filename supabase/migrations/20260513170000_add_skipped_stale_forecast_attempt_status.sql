-- Allow condition-alert-deliver to record queue rows skipped after fresh
-- forecast revalidation says the original alert no longer matches.

ALTER TABLE public.alert_delivery_attempts
  DROP CONSTRAINT IF EXISTS alert_delivery_attempts_status_check;

ALTER TABLE public.alert_delivery_attempts
  ADD CONSTRAINT alert_delivery_attempts_status_check
  CHECK (status IN (
    'sent',
    'skipped_disabled',
    'skipped_allowlist',
    'skipped_cooldown',
    'skipped_user_cap',
    'skipped_no_device',
    'skipped_no_email',
    'skipped_channel_disabled',
    'skipped_dedup_collision',
    'skipped_stale_forecast',
    'failed_provider',
    'failed_internal'
  ));
