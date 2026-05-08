BEGIN;

-- Backfill user_events.beach_id from metadata->>'beach_id' for rows where
-- the column is NULL but a valid beach UUID lives in the JSONB blob.
--
-- Two upstream emitters dropped beach_id into metadata only and never set the
-- top-level column:
--
--   1. Pre-2026-05-02 native client. Fixed forward in quiver-native commit
--      a76b3d9 ("4 launch-day bugs"). insertEvent now lifts beach_id to the
--      column before insert.
--
--   2. Web `fireToUserEvents` helper in lib/analytics/signup-conversion-tracking.ts
--      and the components/map/interactive-map.tsx pin_click callsite. Both
--      fixed in this same change set — fireToUserEvents now lifts params.beach_id
--      to the top-level beachId field, and the pin_click callsite passes
--      beachId at the top level instead of nesting it inside metadata.
--
-- Idempotent: every successful row flips beach_id from NULL to set, so the
-- WHERE clause excludes it on any re-run.
--
-- metadata.beach_id is preserved intentionally — original payload stays
-- intact, and rolling back is a one-liner (UPDATE … SET beach_id = NULL …
-- WHERE metadata->>'beach_id' IS NOT NULL).
--
-- Expected affected rows ~2,053 (verified pre-write 2026-05-03):
--   1,512 web signup_cta_view, 6 signup_cta_click, 103 map_interaction,
--   ~432 native iOS/Android beach_view + home_beach_forecast_viewed +
--   match_card_rendered + session_log_submit + first_session_logged +
--   for_you_tap. All FK-validated against beaches; zero dangling FKs.

UPDATE user_events
SET beach_id = (metadata->>'beach_id')::uuid
WHERE beach_id IS NULL
  AND metadata->>'beach_id' IS NOT NULL
  AND metadata->>'beach_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM beaches WHERE id = (metadata->>'beach_id')::uuid);

COMMIT;
