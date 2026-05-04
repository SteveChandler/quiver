-- Backfill bot_flagged=true for historical events matching the Android/Chrome/mobile/614 fingerprint.
--
-- Source: 2026-05-04 forensic identification. A steady ~20s-cadence automation hit three
-- beach-detail pages and the map between roughly 2026-04-15 and 2026-04-30, producing
-- ~10,600 unflagged events across signup_cta_view, beach_view, page_view, scroll_depth,
-- time_on_page, forecast_ready, cta_impression. Defensive ingest filter for new events
-- lives in lib/utils/bot-detector.ts (isSuspiciousFingerprint Pattern B); this migration
-- cleans up the historical pollution so dashboards filter them via the existing
-- bot_flagged guard.
--
-- Safety: scoped UPDATE on a 4-condition AND that excludes any real Android device viewport.
-- No real user agent legitimately reports os=Android + browser=Chrome + device_type=mobile
-- + _viewport_width=614 (no shipping device defaults to that width).

BEGIN;

-- Founder account (omg.its.thefuture@gmail.com) is exempt to preserve a record
-- of his Chrome DevTools mobile-emulation testing — matches the API ingest
-- exemption in app/api/events/route.ts.
UPDATE user_events
SET bot_flagged = true
WHERE bot_flagged IS NOT TRUE
  AND metadata->>'_viewport_width' = '614'
  AND metadata->'_device'->>'os' = 'Android'
  AND metadata->'_device'->>'browser' = 'Chrome'
  AND metadata->'_device'->>'device_type' = 'mobile'
  AND user_id IS DISTINCT FROM '73040cff-afe9-4fa0-a874-2016203fc015';

COMMIT;
