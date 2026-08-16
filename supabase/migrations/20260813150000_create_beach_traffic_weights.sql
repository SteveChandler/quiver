-- UNAPPLIED FORWARD MIGRATION (2026-08-13)
-- Do not apply from this worktree. The owner must review and apply it with the
-- production migration protocol after the system-card pilot is approved.

BEGIN;

CREATE TABLE IF NOT EXISTS public.beach_traffic_weights (
  beach_id uuid PRIMARY KEY REFERENCES public.beaches(id) ON DELETE CASCADE,
  views_30d integer NOT NULL DEFAULT 0 CHECK (views_30d >= 0),
  weight numeric NOT NULL DEFAULT 1 CHECK (weight >= 0),
  market_key text NOT NULL,
  allocation_tier text NOT NULL CHECK (allocation_tier IN ('proven', 'adjacent', 'exploration')),
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beach_traffic_weights_market_idx
  ON public.beach_traffic_weights (market_key, allocation_tier);

ALTER TABLE public.beach_traffic_weights ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.beach_traffic_weights
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
