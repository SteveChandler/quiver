-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER TABLE public.favorite_beaches
  ADD COLUMN alerts_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX idx_favorite_beaches_alerts_enabled
  ON public.favorite_beaches (user_id, beach_id)
  WHERE alerts_enabled = true;
