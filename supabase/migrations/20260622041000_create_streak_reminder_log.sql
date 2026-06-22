BEGIN;

CREATE TABLE IF NOT EXISTS public.streak_reminder_log (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  period_key    TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, reminder_type, period_key)
);

COMMENT ON TABLE public.streak_reminder_log IS
  'Per-user, per-period idempotency log for streak reminder push notifications.';

COMMENT ON COLUMN public.streak_reminder_log.reminder_type IS
  'Reminder campaign key: daily_call_streak or weekly_streak.';

COMMENT ON COLUMN public.streak_reminder_log.period_key IS
  'Period bucket: YYYY-MM-DD for daily reminders, YYYY-WW for weekly reminders.';

ALTER TABLE public.streak_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS streak_reminder_log_select_own ON public.streak_reminder_log;
DROP POLICY IF EXISTS streak_reminder_log_service_role_all ON public.streak_reminder_log;

CREATE POLICY streak_reminder_log_select_own
  ON public.streak_reminder_log
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY streak_reminder_log_service_role_all
  ON public.streak_reminder_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.streak_reminder_log TO authenticated;
GRANT ALL ON public.streak_reminder_log TO service_role;

COMMIT;
