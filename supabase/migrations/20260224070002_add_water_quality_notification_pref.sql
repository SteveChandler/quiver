BEGIN;

-- ============================================================
-- Add water quality notification preference to profiles
--
-- Adds an opt-out toggle so users can suppress push/email
-- notifications when a beach transitions to advisory or closure
-- status. Enabled by default to match all other notif_* columns.
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notif_water_quality BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.profiles.notif_water_quality IS
    'Opt-out toggle for water quality advisory and closure push notifications.';

COMMIT;
