-- Phase 5l: device metadata for debugging "is this device on a build that
-- handles X?" from the server side. All three columns are optional — existing
-- rows stay null until the next upsert from a client that passes them.
--
-- Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 5l).

BEGIN;

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS os_version text,
  ADD COLUMN IF NOT EXISTS expo_sdk text;

COMMIT;
