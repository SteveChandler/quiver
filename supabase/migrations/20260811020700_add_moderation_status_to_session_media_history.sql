-- Companion to 20260811020500_create_session_videos.sql.
-- log_revision() mirrors every live session_media column into
-- session_media_history; adding moderation_status to the live table without
-- the history table makes every UPDATE/DELETE revision insert fail (soft
-- WARNING, history silently stops recording). Apply in the same window as
-- 20260811020500.
BEGIN;

ALTER TABLE public.session_media_history
  ADD COLUMN IF NOT EXISTS moderation_status text,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS thumbnail_path text;

COMMENT ON COLUMN public.session_media_history.moderation_status IS
  'Mirror of session_media columns added in 20260811020500 for log_revision(); nullable, no default.';

COMMIT;
