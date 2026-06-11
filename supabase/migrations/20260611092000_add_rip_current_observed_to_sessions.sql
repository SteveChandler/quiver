BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN rip_current_observed TEXT;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_rip_current_observed_check
    CHECK (
      rip_current_observed IS NULL
      OR rip_current_observed IN ('none', 'light', 'strong')
    );

COMMIT;
