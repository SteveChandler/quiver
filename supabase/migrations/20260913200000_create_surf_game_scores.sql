BEGIN;

-- Arcade-style top-score bracket for the surf game at /surf-game. Written only through the API with the
-- service role: anonymous players enter three initials per score, signed-in players keep one row (their best).
CREATE TABLE IF NOT EXISTS public.surf_game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  initials text NOT NULL,
  score integer NOT NULL,
  break_slug text NOT NULL,
  waves smallint NOT NULL DEFAULT 0,
  barrels smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT surf_game_scores_initials_check CHECK (initials ~ '^[A-Z0-9]{1,3}$'),
  CONSTRAINT surf_game_scores_score_check CHECK (score >= 0 AND score <= 1000000),
  CONSTRAINT surf_game_scores_break_check CHECK (char_length(break_slug) BETWEEN 1 AND 32)
);

CREATE INDEX IF NOT EXISTS surf_game_scores_rank_idx ON public.surf_game_scores (score DESC, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS surf_game_scores_user_idx ON public.surf_game_scores (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.surf_game_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.surf_game_scores FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.surf_game_scores TO service_role;

COMMENT ON TABLE public.surf_game_scores IS 'Top-score bracket for the EL NIÑO SWELL surf game; API-only via service role.';

NOTIFY pgrst, 'reload schema';
COMMIT;
