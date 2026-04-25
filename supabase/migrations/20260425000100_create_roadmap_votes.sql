-- Vote table. Primary key is (item_id, user_id) — enforces one vote per
-- user per item regardless of surface (web vs. native resolve to the same
-- row). Public-read so aggregated counts flow through the view; write via
-- authed user's own JWT only.

BEGIN;

CREATE TABLE public.roadmap_votes (
  item_id uuid NOT NULL REFERENCES public.roadmap_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, user_id)
);

-- item_id lookups are served by the composite PK's leading column —
-- no dedicated index needed.
CREATE INDEX roadmap_votes_user_id_idx ON public.roadmap_votes (user_id);

ALTER TABLE public.roadmap_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY roadmap_votes_public_read
  ON public.roadmap_votes
  FOR SELECT
  USING (true);

CREATE POLICY roadmap_votes_own_insert
  ON public.roadmap_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY roadmap_votes_own_delete
  ON public.roadmap_votes
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
