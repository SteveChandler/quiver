BEGIN;

ALTER TABLE public.alert_queue
  ADD COLUMN IF NOT EXISTS best_score numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.alert_queue.best_score IS
  'Best matched alert-window score used to order consolidated alert emails.';

COMMIT;
