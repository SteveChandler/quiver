-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

-- 1. Replace swell_windows_overlap with O(1) analytical version
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
BEGIN
  IF p_min1 IS NULL OR p_max1 IS NULL OR p_min2 IS NULL OR p_max2 IS NULL THEN
    RETURN 0;
  END IF;

  min1 := ((p_min1 % 360) + 360) % 360;
  max1 := ((p_max1 % 360) + 360) % 360;
  min2 := ((p_min2 % 360) + 360) % 360;
  max2 := ((p_max2 % 360) + 360) % 360;

  span1 := CASE WHEN min1 <= max1 THEN max1 - min1 ELSE 360 - min1 + max1 END;
  span2 := CASE WHEN min2 <= max2 THEN max2 - min2 ELSE 360 - min2 + max2 END;

  IF span1 = 0 OR span2 = 0 THEN
    RETURN 0;
  END IF;

  IF span1 >= 360 THEN RETURN span2; END IF;
  IF span2 >= 360 THEN RETURN span1; END IF;

  RETURN CASE
    WHEN min1 <= max1 AND min2 <= max2 THEN
      GREATEST(0, LEAST(max1, max2) - GREATEST(min1, min2))
    WHEN min1 <= max1 AND min2 > max2 THEN
      GREATEST(0, LEAST(max1, 360) - GREATEST(min1, min2))
      + GREATEST(0, LEAST(max1, max2) - GREATEST(min1, 0))
    WHEN min1 > max1 AND min2 <= max2 THEN
      GREATEST(0, LEAST(360, max2) - GREATEST(min1, min2))
      + GREATEST(0, LEAST(max1, max2) - GREATEST(0, min2))
    ELSE
      GREATEST(0, 360 - GREATEST(min1, min2))
      + GREATEST(0, max2 - min1)
      + GREATEST(0, max1 - min2)
      + GREATEST(0, LEAST(max1, max2))
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;


-- 2. Replace get_yesterday_accuracy with range-based filter + capped error
CREATE OR REPLACE FUNCTION get_yesterday_accuracy(p_beach_id UUID)
RETURNS TABLE (
  beach_id UUID,
  forecast_date DATE,
  avg_predicted_m NUMERIC,
  avg_observed_m NUMERIC,
  mae_m NUMERIC,
  relative_error_pct NUMERIC,
  observation_count INTEGER,
  should_display BOOLEAN
) AS $$
DECLARE
  v_tz TEXT;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(b.timezone, 'America/Los_Angeles') INTO v_tz
  FROM beaches b WHERE b.id = p_beach_id;

  IF v_tz IS NULL THEN
    v_tz := 'America/Los_Angeles';
  END IF;

  v_start := (CURRENT_DATE AT TIME ZONE v_tz - INTERVAL '1 day') AT TIME ZONE v_tz;
  v_end := (CURRENT_DATE AT TIME ZONE v_tz) AT TIME ZONE v_tz;

  RETURN QUERY
  SELECT
    p.beach_id,
    (v_start AT TIME ZONE v_tz)::date AS forecast_date,
    ROUND(AVG(p.corrected_forecast_m)::numeric, 2) AS avg_predicted_m,
    ROUND(AVG(p.observed_m)::numeric, 2) AS avg_observed_m,
    ROUND(AVG(ABS(p.corrected_error_m))::numeric, 2) AS mae_m,
    LEAST(
      ROUND(
        AVG(
          CASE WHEN ABS(p.observed_m) > 0
          THEN ABS(p.corrected_error_m) / ABS(p.observed_m) * 100
          ELSE NULL END
        )::numeric, 1
      ),
      999
    ) AS relative_error_pct,
    COUNT(*)::integer AS observation_count,
    NOT (
      AVG(ABS(p.corrected_error_m)) > 0.45
      AND COALESCE(AVG(
        CASE WHEN ABS(p.observed_m) > 0
        THEN ABS(p.corrected_error_m) / ABS(p.observed_m)
        ELSE NULL END
      ), 0) > 0.40
    ) AND AVG(p.observed_m) >= 0.3 AS should_display
  FROM ml_predictions_log p
  WHERE p.beach_id = p_beach_id
    AND p.predicted_at >= v_start
    AND p.predicted_at < v_end
    AND p.observed_m IS NOT NULL
  GROUP BY p.beach_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- 3. Recreate observable_beaches with JOIN instead of correlated subqueries
DROP MATERIALIZED VIEW IF EXISTS observable_beaches;

CREATE MATERIALIZED VIEW observable_beaches AS
SELECT DISTINCT s.nearest_beach_id AS beach_id
FROM ioos_stations s
WHERE s.active = true
  AND s.has_wave_data = true
  AND s.nearest_beach_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM ioos_observations o
    WHERE o.station_id = s.station_id
      AND o.wave_height_m IS NOT NULL
      AND o.observed_at > NOW() - INTERVAL '24 hours'
  )
UNION
SELECT DISTINCT b.id AS beach_id
FROM beaches b
WHERE b.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM ioos_stations s
    JOIN beaches nb ON nb.id = s.nearest_beach_id
    WHERE s.active = true
      AND s.has_wave_data = true
      AND ST_DWithin(b.geog, s.coordinates::geography, 10000)
      AND swell_windows_overlap(
            b.swell_window_min_deg, b.swell_window_max_deg,
            nb.swell_window_min_deg, nb.swell_window_max_deg
          ) > 0
      AND EXISTS (
        SELECT 1 FROM ioos_observations o
        WHERE o.station_id = s.station_id
          AND o.wave_height_m IS NOT NULL
          AND o.observed_at > NOW() - INTERVAL '24 hours'
      )
  )
WITH DATA;

CREATE UNIQUE INDEX idx_observable_beaches_beach_id ON observable_beaches(beach_id);

GRANT SELECT ON observable_beaches TO authenticated, anon, service_role;


-- 4. Replace get_beach_observation_station with JOIN instead of correlated subqueries
CREATE OR REPLACE FUNCTION get_beach_observation_station(p_beach_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_station_id TEXT;
BEGIN
  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  JOIN beaches b ON b.id = p_beach_id
  JOIN beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(b.geog, s.coordinates::geography, 10000)
    AND swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) > 0
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  RETURN v_station_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REFRESH MATERIALIZED VIEW observable_beaches;

COMMIT;
