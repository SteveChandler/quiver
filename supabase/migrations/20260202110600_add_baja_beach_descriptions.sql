-- Migration: Add Baja Beach Descriptions
-- Impact: 8 beaches (100% of Baja California) missing descriptions
-- Priority: P1 (High)
--
-- All Baja California beaches in the Rosarito/Puerto Nuevo area

BEGIN;

-- Backup current state for rollback
CREATE TABLE IF NOT EXISTS _backup_baja_descriptions_20260202 AS
SELECT id, name, description
FROM beaches
WHERE state = 'Baja California';

-- Alfonsos (Rosarito) - Left Reef/Point
UPDATE beaches
SET description = 'A lesser-known gem compared to its neighbors. Alfonsos offers a playful left that works best on a mid-period swell. It''s generally less crowded, making it a great alternative when K-38 is packed.'
WHERE id = '6e083f22-4c11-46c5-9110-ac7500f6cba5';

-- El Morro Point (K37.5) (Rosarito) - Right Point
UPDATE beaches
SET description = 'Situated just north of the famous K-38, El Morro offers a long, fast right-hand wall. It''s a rocky entry and can be a bit more tide-sensitive, but provides excellent rides for intermediate to advanced surfers.'
WHERE id = '6cbb1b4f-d25e-40a3-a78a-b138ebdf9e96';

-- K-38 (Rosarito) - Right Point/Reef
UPDATE beaches
SET description = 'The crown jewel of the Baja Norte area. K-38 is known for its incredibly consistent and long right-handers. It handles size well and offers several takeoff zones, though the "Main Peak" is highly competitive.'
WHERE id = '77d286c5-87e9-4678-82d3-81d0125285fa';

-- K-40 (Puerto Nuevo) - Reef Break
UPDATE beaches
SET description = 'Located near the famous lobster village of Puerto Nuevo, this spot offers punchy, hollow waves. It''s best on a solid W/NW swell. Be wary of the shallow reef and urchins during lower tides.'
WHERE id = 'de6575ce-4ee1-4c6b-a2cf-7009ba171c3b';

-- Las Gaviotas (Rosarito) - Reef/Point
UPDATE beaches
SET description = 'Located within a private gated community, Las Gaviotas is a fun, mellow right-hand reef break. It''s a favorite for longboarders and those looking for a "resort" surf feel without the heavy localism.'
WHERE id = '965196e2-81c3-4c1a-8c2f-e5c9c0f8e3fd';

-- Renes (Rosarito) - Beach Break
UPDATE beaches
SET description = 'A classic Mexican beach break located just south of the main Rosarito pier. Renes offers shifting peaks and can get quite hollow and heavy on a large swell. Great for finding a peak to yourself.'
WHERE id = '294712f3-3c06-44bd-9bc6-17275675fe9a';

-- Rosarito Beach (Rosarito) - Beach Break
UPDATE beaches
SET description = 'The main stretch of sand in Rosarito town. It is mostly a beginner-to-intermediate wave with multiple peaks. It''s very convenient but can be affected by water quality after heavy rains.'
WHERE id = 'f0ddfc6a-7392-40c5-9211-836c05e449f1';

-- Teresa's (Rosarito) - Rocky Reef
UPDATE beaches
SET description = 'A powerful and often overlooked spot. Teresa''s produces a steep, fast wave that requires a bit more skill to navigate the takeoff. It''s a great "high performance" wave when the swell direction is right.'
WHERE id = 'ec7b1ab4-5f43-4af3-b45f-325d29b8d5e6';

-- Verify all 8 beaches were updated
DO $$
DECLARE
  updated_count integer;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM beaches
  WHERE state = 'Baja California'
    AND description IS NOT NULL;

  IF updated_count != 8 THEN
    RAISE WARNING 'Expected 8 Baja beaches updated, got %', updated_count;
  END IF;
END $$;

COMMIT;

-- Verification query:
-- SELECT id, name, description IS NOT NULL as has_description, LENGTH(description) as desc_length
-- FROM beaches
-- WHERE state = 'Baja California'
-- ORDER BY name;

-- Rollback procedure:
-- BEGIN;
-- UPDATE beaches b
-- SET description = bk.description
-- FROM _backup_baja_descriptions_20260202 bk
-- WHERE b.id = bk.id;
-- DROP TABLE _backup_baja_descriptions_20260202;
-- COMMIT;
