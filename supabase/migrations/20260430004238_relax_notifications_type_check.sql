-- Relax the legacy CHECK on `notifications.type`. The original constraint
-- (set in 20250116000000_push_notifications_infrastructure.sql) only
-- enumerated session_invite/session_update/comment/like/follow, which:
--   1. caused the water-quality service's `notifications` insert with
--      type='water_quality_alert' to fail silently (logged non-fatal),
--   2. blocks Phase 2 of the centralized notifications pipeline from
--      writing inbox rows for forecast_alert, water_quality, daily_digest.
--
-- The runtime source of truth for valid types is now the type registry in
-- `lib/notifications/registry.ts` — adding a new type should not require a
-- DB migration. We replace the closed-set CHECK with a NOT NULL +
-- non-empty-string guard so the column still rejects nonsense, but the
-- application owns which strings are meaningful.
--
-- Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 1, fix #1).

BEGIN;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_nonempty_check
  CHECK (type IS NOT NULL AND length(type) > 0);

COMMIT;
