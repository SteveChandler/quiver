-- AI-scored wave punchiness (distilled from beach freetext by an LLM pass).
-- Consumed by getWavePunchiness: manual override > confident AI (>=0.55) > structural derivation.
BEGIN;
ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS wave_punchiness_ai numeric,
  ADD COLUMN IF NOT EXISTS wave_punchiness_ai_confidence numeric,
  ADD COLUMN IF NOT EXISTS wave_punchiness_ai_meta jsonb;
COMMIT;
