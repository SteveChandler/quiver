-- What each user was last told about a swell they were alerted to, so the
-- swell-alert cron can send follow-ups (bigger, smaller, moved, dropped,
-- arrived) for the SAME (user, event, beach) instead of re-picking a lead beach.
-- swell_event_alerts stays one row per (user, event): the daily-call runner
-- reads it with maybeSingle(), so follow-ups must never add rows there.
-- Written by /api/cron/swell-alert with the service role only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.swell_event_user_state (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  -- The beach the first alert led with. Follow-ups re-evaluate this pair only.
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  last_arrival_at timestamptz NOT NULL,
  last_peak_at timestamptz NOT NULL,
  last_face_height_ft numeric NOT NULL,
  last_period_s numeric NOT NULL,
  last_direction_deg numeric NOT NULL,
  -- Sticky: once an event was told as serious, follow-ups keep plain copy.
  serious boolean NOT NULL DEFAULT false,
  last_kind text NOT NULL DEFAULT 'coming'
    CHECK (last_kind IN ('coming', 'bigger', 'smaller', 'moved', 'dropped', 'arrived')),
  told_kinds text[] NOT NULL DEFAULT ARRAY['coming']::text[],
  last_told_at timestamptz NOT NULL,
  last_followup_at timestamptz NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'arrived', 'dropped', 'passed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS swell_event_user_state_active_idx
  ON public.swell_event_user_state (user_id, event_key)
  WHERE status = 'active';

-- Service role only: RLS on with no policies, as on swell_event_alerts.
ALTER TABLE public.swell_event_user_state ENABLE ROW LEVEL SECURITY;

COMMIT;
