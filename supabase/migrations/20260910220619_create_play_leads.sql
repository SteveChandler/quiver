BEGIN;

CREATE TABLE IF NOT EXISTS public.play_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  consent_marketing boolean NOT NULL,
  consented_at timestamptz,
  break_slug text NOT NULL,
  heat_total numeric(5,2) NOT NULL,
  challenge_code text NOT NULL,
  session_id uuid,
  source text NOT NULL DEFAULT 'play_outside',
  forecast_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT play_leads_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS play_leads_email_idx ON public.play_leads (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS play_leads_phone_idx ON public.play_leads (phone) WHERE phone IS NOT NULL;

ALTER TABLE public.play_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.play_leads FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.play_leads TO service_role;

DO $$
DECLARE current_check text;
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \\((.*)\\)$', '\\1') INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.user_events'::regclass AND conname = 'user_events_event_type_check';
  IF current_check IS NULL THEN RAISE EXCEPTION 'user_events_event_type_check constraint not found'; END IF;
  ALTER TABLE public.user_events DROP CONSTRAINT user_events_event_type_check;
  EXECUTE format(
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = %L)',
    current_check, 'play_lead_captured'
  );
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
