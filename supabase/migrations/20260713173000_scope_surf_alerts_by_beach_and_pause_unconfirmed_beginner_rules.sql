-- Surf alerts are one-per-user/per-beach/per-local-day. The original key was
-- user/day/channel, which made independent beaches suppress one another.
BEGIN;

ALTER TABLE public.alert_deliveries
  ADD COLUMN IF NOT EXISTS beach_id uuid REFERENCES public.beaches(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.idx_alert_deliveries_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_deliveries_dedup
  ON public.alert_deliveries(user_id, beach_id, alert_date, channel)
  WHERE beach_id IS NOT NULL;

-- Preserve the old deduplication behavior while older writers that do not yet
-- send beach_id overlap this migration during rollout.
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_deliveries_legacy_null_beach_dedup
  ON public.alert_deliveries(user_id, alert_date, channel)
  WHERE beach_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_user_beach_date
  ON public.alert_deliveries(user_id, beach_id, alert_date);

-- Advanced and expert surfers must explicitly opt into the legacy
-- beginner-sandy-window rule before it resumes. The reason lives with the
-- rule so clients can explain the paused state and offer a one-tap confirm.
UPDATE public.alert_rules AS rule
SET
  enabled = false,
  conditions = COALESCE(rule.conditions, '{}'::jsonb) || jsonb_build_object(
    'beginner_window_paused_reason',
    'Paused until you confirm beginner-friendly windows.'
  )
FROM public.profiles AS profile
WHERE rule.user_id = profile.id
  AND rule.enabled = true
  AND COALESCE(rule.conditions ->> 'beginner_sandy_window', 'false') = 'true'
  AND COALESCE(rule.conditions ->> 'beginner_window_confirmed', 'false') <> 'true'
  AND profile.experience_level IN ('advanced', 'expert');

COMMIT;
