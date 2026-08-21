-- Add trial-lifecycle email types so the trial-lifecycle-email cron can log sends.
--
-- Stages (see app/api/cron/trial-lifecycle-email/route.ts):
--   trial_started — day 1 of the trial, points at the first Pro surf call
--   trial_ending  — day 11, states the charge date plainly before the charge
--   trial_ended   — ~2 days after an unconverted trial lapsed, asks the objection

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
    'first_session_nudge',
    'swell_watch',
    'trial_started',
    'trial_ending',
    'trial_ended'
  ));

COMMENT ON CONSTRAINT email_send_log_email_type_check ON public.email_send_log IS
  'Allowed email types: welcome, forecast_digest, reengagement, weekly_recap, conditions_alert, session_prompt, first_session_nudge, swell_watch, trial_started, trial_ending, trial_ended';

-- The trial-lifecycle cron dedups by (user_id, email_type) with no date bound:
-- each stage must reach a user at most once per trial. The existing
-- uniq_email_per_user_per_type_per_day index only guards same-day repeats, so
-- this partial index backs the "ever sent?" lookup the cron performs.
CREATE INDEX IF NOT EXISTS idx_email_send_log_trial_stages
  ON public.email_send_log(user_id, email_type)
  WHERE email_type IN ('trial_started', 'trial_ending', 'trial_ended');

COMMIT;
