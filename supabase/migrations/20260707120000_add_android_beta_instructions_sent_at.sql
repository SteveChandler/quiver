BEGIN;

ALTER TABLE public.android_beta_leads
  ADD COLUMN IF NOT EXISTS instructions_sent_at timestamptz;

COMMENT ON COLUMN public.android_beta_leads.instructions_sent_at IS
  'Timestamp when Quiver last sent Android beta instructions for this email; used to prevent duplicate public-triggered sends.';

COMMIT;
