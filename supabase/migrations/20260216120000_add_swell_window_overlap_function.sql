BEGIN;

-- ================================================================
-- Migration: Add swell_windows_overlap function
-- Description: Computes the angular overlap in degrees between two
--   swell windows on a 0-360 degree circle, handling wraparound.
-- Used by: observable_beaches view for swell compatibility scoring
-- ================================================================

CREATE OR REPLACE FUNCTION swell_windows_overlap(
  p_min1 NUMERIC, p_max1 NUMERIC,
  p_min2 NUMERIC, p_max2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  min1 NUMERIC;
  max1 NUMERIC;
  min2 NUMERIC;
  max2 NUMERIC;
  span1 NUMERIC;
  span2 NUMERIC;
  overlap NUMERIC := 0;
  d INTEGER;
BEGIN
  -- Handle NULL inputs
  IF p_min1 IS NULL OR p_max1 IS NULL OR p_min2 IS NULL OR p_max2 IS NULL THEN
    RETURN 0;
  END IF;

  -- Normalize to 0-360
  min1 := ((p_min1 % 360) + 360) % 360;
  max1 := ((p_max1 % 360) + 360) % 360;
  min2 := ((p_min2 % 360) + 360) % 360;
  max2 := ((p_max2 % 360) + 360) % 360;

  -- Calculate spans (handle wraparound: if min > max, window crosses 0)
  span1 := CASE WHEN min1 <= max1 THEN max1 - min1 ELSE 360 - min1 + max1 END;
  span2 := CASE WHEN min2 <= max2 THEN max2 - min2 ELSE 360 - min2 + max2 END;

  -- Zero-width windows have no overlap
  IF span1 = 0 OR span2 = 0 THEN
    RETURN 0;
  END IF;

  -- Full-circle windows overlap entirely with the other
  IF span1 >= 360 THEN RETURN span2; END IF;
  IF span2 >= 360 THEN RETURN span1; END IF;

  -- Count overlapping degrees using membership test on the circle.
  -- A degree d is in window [min, max] if:
  --   non-wrapping (min <= max): d >= min AND d <= max
  --   wrapping     (min > max):  d >= min OR  d <= max
  FOR d IN 0..359 LOOP
    IF (CASE WHEN min1 <= max1 THEN d >= min1 AND d <= max1
             ELSE d >= min1 OR d <= max1 END)
       AND
       (CASE WHEN min2 <= max2 THEN d >= min2 AND d <= max2
              ELSE d >= min2 OR d <= max2 END)
    THEN
      overlap := overlap + 1;
    END IF;
  END LOOP;

  RETURN overlap;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION swell_windows_overlap(NUMERIC, NUMERIC, NUMERIC, NUMERIC) IS
  'Computes the angular overlap (in degrees) between two swell windows on a 0-360 circle. '
  'Handles wraparound (e.g. 350-10). Returns 0 for NULL or zero-width inputs.';

GRANT EXECUTE ON FUNCTION swell_windows_overlap(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION swell_windows_overlap(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION swell_windows_overlap(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO service_role;

COMMIT;
