-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

CREATE TABLE public.roadmap_votes (
  item_id uuid NOT NULL REFERENCES public.roadmap_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, user_id)
);

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
