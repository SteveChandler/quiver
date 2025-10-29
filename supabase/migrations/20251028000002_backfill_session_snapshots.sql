-- Backfill forecast snapshots for existing completed sessions
--
-- This migration populates the session_forecast_snapshots table with data
-- for all existing completed sessions that have matching forecast data available.
--
-- Background:
-- - 602 sessions exist in the database
-- - 0 snapshots currently exist
-- - The trigger was only firing on UPDATE, not INSERT
-- - This backfill enables historical condition-based analysis

-- Insert snapshots for all completed sessions with matching forecast data
INSERT INTO session_forecast_snapshots (
  session_id,
  user_id,
  beach_id,
  forecast_snapshot,
  actual_conditions,
  forecast_confidence_score,
  data_source,
  session_date,
  created_at,
  updated_at
)
SELECT
  s.id as session_id,
  s.user_id,
  s.beach_id::uuid,
  to_jsonb(ef.*) as forecast_snapshot,
  jsonb_build_object(
    'wave_quality', s.wave_quality,
    'water_temp', s.water_temp,
    'crowd_level', s.crowd_level,
    'parking_ease', s.parking_ease,
    'rating', s.rating,
    'notes', s.notes,
    'duration_minutes', s.duration_minutes,
    'arrival_time', s.arrival_time
  ) as actual_conditions,
  (ef.confidence_score)::integer as forecast_confidence_score,
  ef.data_source,
  s.arrival_time::date as session_date,
  NOW() as created_at,
  NOW() as updated_at
FROM sessions s
-- Use LATERAL join to find the closest forecast for each session
LEFT JOIN LATERAL (
  SELECT * FROM enhanced_forecasts ef
  WHERE ef.beach_id::uuid = s.beach_id::uuid
    AND ef.forecast_date = s.arrival_time::date
  -- Order by time difference to find the closest forecast
  ORDER BY ABS(EXTRACT(EPOCH FROM (ef.forecast_time::time - s.arrival_time::time))) ASC
  LIMIT 1
) ef ON true
WHERE s.status = 'completed'
  -- Only backfill where we found matching forecast data
  AND ef.id IS NOT NULL
  -- Skip if snapshot already exists
  AND NOT EXISTS (
    SELECT 1 FROM session_forecast_snapshots sfs
    WHERE sfs.session_id = s.id
  )
-- Handle duplicates gracefully
ON CONFLICT (session_id) DO NOTHING;

-- Log the results
DO $$
DECLARE
  snapshot_count INTEGER;
  session_count INTEGER;
  no_forecast_count INTEGER;
BEGIN
  -- Count snapshots created
  SELECT COUNT(*) INTO snapshot_count
  FROM session_forecast_snapshots;

  -- Count total completed sessions
  SELECT COUNT(*) INTO session_count
  FROM sessions
  WHERE status = 'completed';

  -- Count sessions without forecast data
  no_forecast_count := session_count - snapshot_count;

  RAISE NOTICE 'Backfill complete:';
  RAISE NOTICE '  - Total completed sessions: %', session_count;
  RAISE NOTICE '  - Snapshots created: %', snapshot_count;
  RAISE NOTICE '  - Sessions without forecast data: %', no_forecast_count;

  IF no_forecast_count > 0 THEN
    RAISE NOTICE 'Note: % sessions could not be backfilled due to missing forecast data', no_forecast_count;
  END IF;
END $$;
