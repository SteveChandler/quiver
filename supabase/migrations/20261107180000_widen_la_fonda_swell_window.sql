-- Widen La Fonda's swell window so WNW/NW swell is not zeroed.
--
-- The Baja import (20260827190000) stored 180-285° from an editorial source
-- profile. On 2026-11-07 Open-Meteo had a 5.1 ft 11 s swell from 288° at
-- La Fonda; the strict window dropped it and Quiver showed 0.8 ft while the
-- surf was 4-5 ft. From the K-58 pin the open-ocean arc runs from Punta Banda
-- (~165°) to Point Loma (~331°), with the Coronado Islands at ~315°. Keep the
-- 180° south edge and open the north edge to 330°.
--
-- Rollback:
--   UPDATE public.beaches SET swell_window_min_deg = 180,
--     swell_window_max_deg = 285, swell_window_center_deg = 232.5,
--     swell_window_halfwidth_deg = 52.5
--   WHERE id = '803f0345-3d9d-5a3f-a356-083418d48884';

BEGIN;

UPDATE public.beaches
SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 330,
  swell_window_center_deg = 255,
  swell_window_halfwidth_deg = 75
WHERE id = '803f0345-3d9d-5a3f-a356-083418d48884'
  AND slug = 'la-fonda';

COMMIT;
