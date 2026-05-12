-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

UPDATE user_events SET beach_id = (metadata->>'beach_id')::uuid WHERE beach_id IS NULL AND metadata->>'beach_id' IS NOT NULL AND metadata->>'beach_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND EXISTS (SELECT 1 FROM beaches WHERE id = (metadata->>'beach_id')::uuid);
