BEGIN;

-- One terminal feedback decision per verified provider cancellation. Free text
-- stays in the database, never in product analytics. No client table access.
CREATE TABLE public.cancellation_feedback (
  cancellation_event_id text PRIMARY KEY REFERENCES public.revenuecat_provider_events(provider_event_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('submitted', 'dismissed')),
  reason text CHECK (reason IN ('avoid_charge', 'price', 'missing_spot', 'forecast', 'technical', 'usage', 'other')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  source text NOT NULL CHECK (source IN ('native_home', 'native_settings')),
  app_version text CHECK (char_length(app_version) <= 40),
  app_build text CHECK (char_length(app_build) <= 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((outcome = 'submitted' AND reason IS NOT NULL) OR
         (outcome = 'dismissed' AND reason IS NULL AND note = ''))
);
CREATE INDEX cancellation_feedback_user_idx ON public.cancellation_feedback(user_id);
ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cancellation_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.cancellation_feedback TO service_role;

COMMIT;
