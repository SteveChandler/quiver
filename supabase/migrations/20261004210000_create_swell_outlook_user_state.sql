-- Per-user Swell Outlook state, next to swell_event_user_state: the back-off
-- counters for swell pushes and the last two lists the outlook returned (sticky
-- tracking compares today's list with the previous run's).
-- Written by /api/swell/outlook and /api/cron/swell-alert with the service role only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.swell_outlook_user_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  consecutive_unanswered integer NOT NULL DEFAULT 0 CHECK (consecutive_unanswered >= 0),
  last_sent_at timestamptz NULL,
  paused_since timestamptz NULL,
  last_answered_at timestamptz NULL,
  last_exception_at timestamptz NULL,
  last_first_sighting_at timestamptz NULL,
  outlook_list jsonb NULL,
  outlook_prev_list jsonb NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Service role only: RLS on with no policies, as on swell_event_user_state.
ALTER TABLE public.swell_outlook_user_state ENABLE ROW LEVEL SECURITY;

COMMIT;
