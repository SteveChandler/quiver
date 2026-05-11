-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

UPDATE profiles
SET display_name = full_name
WHERE is_mock = true AND display_name IS NULL AND full_name IS NOT NULL;
