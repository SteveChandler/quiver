-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS muted boolean DEFAULT false;

COMMENT ON COLUMN sessions.muted IS 'When true, session is public on profile but hidden from community feed';

COMMIT;
