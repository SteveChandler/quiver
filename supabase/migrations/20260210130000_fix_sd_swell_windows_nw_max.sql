BEGIN;

-- Extend NW swell window max for 12 SD beaches
-- These beaches had max_deg capped too low relative to terrain ray-tracing data.
-- Threshold: terrain swell_access_factor >= 0.15 (meaningful surfable energy)
-- center = min + (max - min) / 2, halfwidth = (max - min) / 2

-- 1. D Street (Encinitas): 180-270 → 180-320
UPDATE beaches SET
  swell_window_max_deg = 320,
  swell_window_center_deg = 250,
  swell_window_halfwidth_deg = 70
WHERE name = 'D Street' AND city = 'Encinitas';

-- 2. Moonlight State Beach (Encinitas): 180-270 → 180-315
UPDATE beaches SET
  swell_window_max_deg = 315,
  swell_window_center_deg = 247.5,
  swell_window_halfwidth_deg = 67.5
WHERE name = 'Moonlight State Beach' AND city = 'Encinitas';

-- 3. Forster St. Oceanside: 180-270 → 180-325
UPDATE beaches SET
  swell_window_max_deg = 325,
  swell_window_center_deg = 252.5,
  swell_window_halfwidth_deg = 72.5
WHERE name = 'Forster St. Oceanside' AND city = 'Oceanside';

-- 4. PB Point: 180-270 → 180-335
UPDATE beaches SET
  swell_window_max_deg = 335,
  swell_window_center_deg = 257.5,
  swell_window_halfwidth_deg = 77.5
WHERE name = 'PB Point' AND city = 'San Diego';

-- 5. Torrey Pines State Beach: 180-270 → 180-345 (massively exposed, factor=0.92 at 340°)
UPDATE beaches SET
  swell_window_max_deg = 345,
  swell_window_center_deg = 262.5,
  swell_window_halfwidth_deg = 82.5
WHERE name = 'Torrey Pines State Beach' AND city = 'San Diego';

-- 6. Ocean Beach Pier: 270-310 → 220-345 (both ends were wrong)
UPDATE beaches SET
  swell_window_min_deg = 220,
  swell_window_max_deg = 345,
  swell_window_center_deg = 282.5,
  swell_window_halfwidth_deg = 62.5
WHERE name = 'Ocean Beach Pier' AND city = 'San Diego';

-- 7. Lower Trestles: 180-250 → 180-325 (world-class spot, handles NW well)
UPDATE beaches SET
  swell_window_max_deg = 325,
  swell_window_center_deg = 252.5,
  swell_window_halfwidth_deg = 72.5
WHERE name = 'Lower Trestles' AND city = 'San Onofre';

-- 8. Upper Trestles: 190-250 → 180-335 (both ends extended)
UPDATE beaches SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 335,
  swell_window_center_deg = 257.5,
  swell_window_halfwidth_deg = 77.5
WHERE name = 'Upper Trestles' AND city = 'San Onofre';

-- 9. Tamarack: 180-300 → 180-350
UPDATE beaches SET
  swell_window_max_deg = 350,
  swell_window_center_deg = 265,
  swell_window_halfwidth_deg = 85
WHERE name = 'Tamarack' AND city = 'Carlsbad';

-- 10. Terramar Point: 180-270 → 180-350
UPDATE beaches SET
  swell_window_max_deg = 350,
  swell_window_center_deg = 265,
  swell_window_halfwidth_deg = 85
WHERE name = 'Terramar Point' AND city = 'Carlsbad';

-- 11. The Rock, Oceanside: 180-270 → 180-315
UPDATE beaches SET
  swell_window_max_deg = 315,
  swell_window_center_deg = 247.5,
  swell_window_halfwidth_deg = 67.5
WHERE name = 'The Rock, Oceanside' AND city = 'Oceanside';

-- 12. Tourmaline: 180-300 → 180-315
UPDATE beaches SET
  swell_window_max_deg = 315,
  swell_window_center_deg = 247.5,
  swell_window_halfwidth_deg = 67.5
WHERE name = 'Tourmaline' AND city = 'San Diego';

COMMIT;
