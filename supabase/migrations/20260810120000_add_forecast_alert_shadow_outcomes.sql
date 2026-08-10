-- Retain one queryable shadow-delivery outcome on each consumed alert queue row.
-- `shadow_withheld` is reserved for channels that reached the send boundary
-- while FORECAST_ALERT_DELIVERY_ENABLED was off.

BEGIN;

ALTER TABLE public.alert_queue
  ADD COLUMN IF NOT EXISTS delivery_shadow_outcome jsonb;

ALTER TABLE public.alert_delivery_attempts
  DROP CONSTRAINT IF EXISTS alert_delivery_attempts_status_check;

ALTER TABLE public.alert_delivery_attempts
  ADD CONSTRAINT alert_delivery_attempts_status_check
  CHECK (status IN (
    'sent',
    'shadow_withheld',
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

COMMENT ON COLUMN public.alert_queue.delivery_shadow_outcome IS
  'Snapshot recorded when forecast alert delivery is shadowed: status, canonical verdict/reason, preset type, and channels that reached the send boundary.';

COMMIT;
