-- Add per-favorite-beach alert opt-in
-- Allows users to receive forecast alerts for individual favorite beaches,
-- separate from the existing home_beach_id alert system.

BEGIN;

ALTER TABLE public.favorite_beaches
  ADD COLUMN alerts_enabled boolean NOT NULL DEFAULT false;

-- Index for the cron job query: find all users with alerts enabled on any favorite
CREATE INDEX idx_favorite_beaches_alerts_enabled
  ON public.favorite_beaches (user_id, beach_id)
  WHERE alerts_enabled = true;

COMMIT;
