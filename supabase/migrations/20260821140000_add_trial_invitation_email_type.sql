-- Add the one-time trial invitation and founder-story email types and their
-- lifetime dedup index. founder_story is the day-1 campaign broadcast sent by
-- scripts/send-founder-story.ts; logging it here gives it Resend webhook
-- tracking and once-ever dedup like every other send.

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
    'trial_ended',
    'trial_invitation',
    'founder_story'
  ));

COMMENT ON CONSTRAINT email_send_log_email_type_check ON public.email_send_log IS
  'Allowed email types: welcome, forecast_digest, reengagement, weekly_recap, conditions_alert, session_prompt, first_session_nudge, swell_watch, trial_started, trial_ending, trial_ended, trial_invitation, founder_story';

DROP INDEX IF EXISTS public.idx_email_send_log_trial_stages;

CREATE INDEX idx_email_send_log_trial_stages
  ON public.email_send_log(user_id, email_type)
  WHERE email_type IN (
    'trial_started',
    'trial_ending',
    'trial_ended',
    'trial_invitation',
    'founder_story'
  );

COMMIT;
