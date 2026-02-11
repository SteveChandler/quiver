BEGIN;

-- Update swell window values for 12 San Diego area beaches
-- These values are based on bathymetry analysis and local surf knowledge
-- Center and halfwidth are computed from min/max: center = min + (max-min)/2, halfwidth = (max-min)/2

-- 1. Blacks (San Diego)
UPDATE beaches
SET
  swell_window_min_deg = 195,
  swell_window_max_deg = 340,
  swell_window_center_deg = 267.5,
  swell_window_halfwidth_deg = 72.5
WHERE name = 'Blacks' AND city = 'San Diego';

-- 2. La Jolla Shores (La Jolla)
UPDATE beaches
SET
  swell_window_min_deg = 195,
  swell_window_max_deg = 350,
  swell_window_center_deg = 272.5,
  swell_window_halfwidth_deg = 77.5
WHERE name = 'La Jolla Shores' AND city = 'La Jolla';

-- 3. Coronado North Jetty (San Diego)
UPDATE beaches
SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 290,
  swell_window_center_deg = 235,
  swell_window_halfwidth_deg = 55
WHERE name = 'Coronado North Jetty' AND city = 'San Diego';

-- 4. Hotel Del Coronado (San Diego)
UPDATE beaches
SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 290,
  swell_window_center_deg = 235,
  swell_window_halfwidth_deg = 55
WHERE name = 'Hotel Del Coronado' AND city = 'San Diego';

-- 5. Tijuana Sloughs (San Diego)
UPDATE beaches
SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 340,
  swell_window_center_deg = 260,
  swell_window_halfwidth_deg = 80
WHERE name = 'Tijuana Sloughs' AND city = 'San Diego';

-- 6. Mission Beach (Central) (San Diego)
UPDATE beaches
SET
  swell_window_min_deg = 255,
  swell_window_max_deg = 340,
  swell_window_center_deg = 297.5,
  swell_window_halfwidth_deg = 42.5
WHERE name = 'Mission Beach (Central)' AND city = 'San Diego';

-- 7. Mission Beach (jetty) (San Diego)
UPDATE beaches
SET
  swell_window_min_deg = 255,
  swell_window_max_deg = 345,
  swell_window_center_deg = 300,
  swell_window_halfwidth_deg = 45
WHERE name = 'Mission Beach' AND city = 'San Diego' AND break_type = 'jetty';

-- 8. Pacific Beach (San Diego)
UPDATE beaches
SET
  swell_window_min_deg = 190,
  swell_window_max_deg = 310,
  swell_window_center_deg = 250,
  swell_window_halfwidth_deg = 60
WHERE name = 'Pacific Beach' AND city = 'San Diego';

-- 9. Scripps (La Jolla)
UPDATE beaches
SET
  swell_window_min_deg = 195,
  swell_window_max_deg = 345,
  swell_window_center_deg = 270,
  swell_window_halfwidth_deg = 75
WHERE name = 'Scripps' AND city = 'La Jolla';

-- 10. Del Mar (Del Mar)
UPDATE beaches
SET
  swell_window_min_deg = 190,
  swell_window_max_deg = 340,
  swell_window_center_deg = 265,
  swell_window_halfwidth_deg = 75
WHERE name = 'Del Mar' AND city = 'Del Mar';

-- 11. Cardiff Reef (Encinitas)
UPDATE beaches
SET
  swell_window_min_deg = 220,
  swell_window_max_deg = 340,
  swell_window_center_deg = 280,
  swell_window_halfwidth_deg = 60
WHERE name = 'Cardiff Reef' AND city = 'Encinitas';

-- 12. Swami's (Encinitas)
UPDATE beaches
SET
  swell_window_min_deg = 200,
  swell_window_max_deg = 325,
  swell_window_center_deg = 262.5,
  swell_window_halfwidth_deg = 62.5
WHERE name = 'Swami''s' AND city = 'Encinitas';

COMMIT;
