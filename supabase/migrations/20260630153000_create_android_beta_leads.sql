BEGIN;

CREATE TABLE IF NOT EXISTS public.android_beta_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text NOT NULL,
  surface text NOT NULL,
  placement text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email = lower(email)),
  CHECK (char_length(email) <= 254),
  CHECK (char_length(source) BETWEEN 1 AND 80),
  CHECK (char_length(surface) BETWEEN 1 AND 80),
  CHECK (char_length(placement) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS android_beta_leads_email_idx
  ON public.android_beta_leads (email);

ALTER TABLE public.android_beta_leads ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.android_beta_leads IS
  'Anonymous Android beta lead capture for Google Group and Play tester follow-up. RLS has no public policies; writes are via service role API route.';
COMMENT ON COLUMN public.android_beta_leads.email IS
  'Normalized lowercase email captured before handing the visitor to the Android tester Google Group.';

COMMIT;
