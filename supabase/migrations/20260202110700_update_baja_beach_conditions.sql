-- Migration: Update Baja Beach Swell/Tide Conditions
-- Impact: Improves forecast accuracy for 8 Baja beaches with specific technical data
-- Priority: P1 (High)
--
-- Swell direction conversions:
-- N=0, NE=45, E=90, SE=135, S=180, SW=225, W=270, NW=315
-- SSW=202, WSW=247, WNW=292, NNW=337

BEGIN;

-- Backup current state for rollback
CREATE TABLE IF NOT EXISTS _backup_baja_conditions_20260202 AS
SELECT id, name, swell_window_min_deg, swell_window_max_deg,
       preferred_tide_ft_min, preferred_tide_ft_max, wave_tips
FROM beaches
WHERE state = 'Baja California';

-- Alfonsos: S-WSW swell (180-247°), Mid tide (2-4ft)
UPDATE beaches
SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 247,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 4,
  wave_tips = 'Best on long-period southern swells that bypass the northern points.'
WHERE id = '6e083f22-4c11-46c5-9110-ac7500f6cba5';

-- El Morro Point (K37.5): S-SW swell (180-225°), Mid to High tide (2-6ft)
UPDATE beaches
SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 225,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 6,
  wave_tips = 'Prefers a rising tide to cover the "boiler" rocks on the inside.'
WHERE id = '6cbb1b4f-d25e-40a3-a78a-b138ebdf9e96';

-- K-38: W-SW (All) swell (180-290°), Low to Mid tide (0-4ft)
-- Widest swell window - handles all directions well
UPDATE beaches
SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 290,
  preferred_tide_ft_min = 0,
  preferred_tide_ft_max = 4,
  wave_tips = 'The most consistent spot in Baja Norte. Low tide makes it hollow, high tide can get "fat."'
WHERE id = '77d286c5-87e9-4678-82d3-81d0125285fa';

-- K-40 (Puerto Nuevo): W-NW swell (270-315°), Mid to High tide (2-6ft)
UPDATE beaches
SET
  swell_window_min_deg = 270,
  swell_window_max_deg = 315,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 6,
  wave_tips = 'Needs a bit more tide to soften the shallow reef and avoid urchin hits.'
WHERE id = 'de6575ce-4ee1-4c6b-a2cf-7009ba171c3b';

-- Las Gaviotas: S-SW swell (180-225°), All tides (0-6ft)
UPDATE beaches
SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 225,
  preferred_tide_ft_min = 0,
  preferred_tide_ft_max = 6,
  wave_tips = 'Very versatile; works on almost any tide, though high tide is more forgiving.'
WHERE id = '965196e2-81c3-4c1a-8c2f-e5c9c0f8e3fd';

-- Renes: S-WSW swell (180-247°), Mid tide only (2-4ft)
UPDATE beaches
SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 247,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 4,
  wave_tips = 'Tide-sensitive beach break; low tide often closes out, high tide gets mushy.'
WHERE id = '294712f3-3c06-44bd-9bc6-17275675fe9a';

-- Rosarito Beach: W-NW / SW Combo (200-315°), Mid tide (2-4ft)
UPDATE beaches
SET
  swell_window_min_deg = 200,
  swell_window_max_deg = 315,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 4,
  wave_tips = 'Shifting peaks; works best when a NW windswell crosses a SW groundswell.'
WHERE id = 'f0ddfc6a-7392-40c5-9211-836c05e449f1';

-- Teresa's: W-NW swell (270-315°), Low to Mid tide (0-4ft)
UPDATE beaches
SET
  swell_window_min_deg = 270,
  swell_window_max_deg = 315,
  preferred_tide_ft_min = 0,
  preferred_tide_ft_max = 4,
  wave_tips = 'A high-performance reef that requires a lower tide to stay punchy.'
WHERE id = 'ec7b1ab4-5f43-4af3-b45f-325d29b8d5e6';

-- Verify all 8 beaches were updated
DO $$
DECLARE
  updated_count integer;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM beaches
  WHERE state = 'Baja California'
    AND wave_tips IS NOT NULL;

  IF updated_count != 8 THEN
    RAISE WARNING 'Expected 8 Baja beaches updated with wave_tips, got %', updated_count;
  END IF;
END $$;

COMMIT;

-- Verification query:
-- SELECT name, swell_window_min_deg, swell_window_max_deg,
--        preferred_tide_ft_min, preferred_tide_ft_max, wave_tips
-- FROM beaches
-- WHERE state = 'Baja California'
-- ORDER BY name;

-- Rollback procedure:
-- BEGIN;
-- UPDATE beaches b
-- SET swell_window_min_deg = bk.swell_window_min_deg,
--     swell_window_max_deg = bk.swell_window_max_deg,
--     preferred_tide_ft_min = bk.preferred_tide_ft_min,
--     preferred_tide_ft_max = bk.preferred_tide_ft_max,
--     wave_tips = bk.wave_tips
-- FROM _backup_baja_conditions_20260202 bk
-- WHERE b.id = bk.id;
-- DROP TABLE _backup_baja_conditions_20260202;
-- COMMIT;
