-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS os_version text,
  ADD COLUMN IF NOT EXISTS expo_sdk text;
