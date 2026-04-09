-- Backfilled from remote supabase_migrations.schema_migrations on 2026-04-08
-- to reconcile drift from a parallel branch that applied directly to prod.
-- This migration was already applied to prod on 2026-04-06 14:23:27 UTC.

ALTER TABLE beach_sources ADD COLUMN IF NOT EXISTS thumbnail_url text;
