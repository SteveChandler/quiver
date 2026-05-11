-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_nonempty_check
  CHECK (type IS NOT NULL AND length(type) > 0);
