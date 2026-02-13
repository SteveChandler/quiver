-- Remove dead HDOnTap camera URLs
--
-- These 6 HDOnTap stream pages no longer contain a valid HLS URL,
-- meaning the camera player shows nothing. Validated via
-- scripts/validate-cameras.ts on 2026-02-13.
--
-- Affected beaches (8 rows, 6 unique URLs):
--   - Del Mar + Torrey Pines State Beach (shared URL /stream/399483)
--   - Del Mar Rivermouth (/stream/160362)
--   - Huntington Beach Pier Northside + Southside (shared URL /stream/255678)
--   - Mission Beach (/stream/475932)
--   - Santa Monica Beach (/stream/267517)
--   - Topanga (/stream/565350)

BEGIN;

UPDATE beach_sources
SET camera_url = NULL
WHERE camera_url IN (
  'https://hdontap.com/stream/399483/del-mar-beach-south-roaming-live-webcam/',
  'https://hdontap.com/stream/160362/del-mars-dog-beach-river-mouth-live-webcam/',
  'https://hdontap.com/stream/255678/huntington-beach-pier-live-cam/',
  'https://hdontap.com/stream/475932/mission-beach-and-crystal-pier-live-cam/',
  'https://hdontap.com/stream/267517/santa-monica-beach-live-cam/',
  'https://hdontap.com/stream/565350/topanga-beach-surf-cam/'
);

COMMIT;
