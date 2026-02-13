-- Fix inaccurate session timing editorial copy for San Diego
-- Removes references to non-existent features:
--   - "marine layer burn-off" / "marine layer forecast" (no data source exists)
--   - "crowd meter" (no such widget; app has crowd intel posts)

BEGIN;

-- San Diego (general) — intent IS NULL
UPDATE city_editorial_content
SET session_timing = jsonb_set(
  session_timing,
  '{0,summary}',
  '"Check the forecast and watch the tide flip around mid-morning. Browse recent crowd intel from other surfers to find gaps between surf school lessons."'
)
WHERE city_slug = 'san-diego'
  AND state_slug = 'ca'
  AND intent IS NULL;

-- San Diego (beginner) — intent = 'beginner'
UPDATE city_editorial_content
SET session_timing = jsonb_set(
  session_timing,
  '{0,summary}',
  '"Check the wind forecast before heading out. Most beginner spots are best from dawn until mid-morning before afternoon winds kick in. Browse crowd intel from other surfers to avoid peak surf school hours (typically 9am-12pm)."'
)
WHERE city_slug = 'san-diego'
  AND state_slug = 'ca'
  AND intent = 'beginner';

COMMIT;
