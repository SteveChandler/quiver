-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notif_water_quality BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN public.profiles.notif_water_quality IS 'Opt-out toggle for water quality advisory and closure push notifications.';
COMMIT;
