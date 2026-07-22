BEGIN;

ALTER TABLE public.android_beta_leads
  ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE INDEX IF NOT EXISTS android_beta_leads_session_id_idx
  ON public.android_beta_leads (session_id);

COMMENT ON COLUMN public.android_beta_leads.session_id IS
  'Persistent anonymous visitor session used to connect the captured Google account email to Android handoff events.';

COMMIT;
