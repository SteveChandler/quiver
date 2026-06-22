CREATE TABLE IF NOT EXISTS public.user_learning_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_key text NOT NULL,
  beach_id uuid REFERENCES public.beaches(id) ON DELETE SET NULL,
  first_fired_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_learning_signals_user_signal_unique UNIQUE (user_id, signal_key)
);

CREATE INDEX IF NOT EXISTS idx_user_learning_signals_user_id
  ON public.user_learning_signals (user_id);

ALTER TABLE public.user_learning_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own learning signals" ON public.user_learning_signals;
CREATE POLICY "Users can view own learning signals"
  ON public.user_learning_signals FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own learning signals" ON public.user_learning_signals;
CREATE POLICY "Users can insert own learning signals"
  ON public.user_learning_signals FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT ON public.user_learning_signals TO authenticated;

COMMENT ON TABLE public.user_learning_signals IS 'Append-only per-user distinct learning signals; backs the idempotent calibration meter. Duplicate (user_id, signal_key) inserts are rejected by the UNIQUE constraint. beach_id retained for future per-beach taste; v1 completeness counts distinct signal_key.';;
