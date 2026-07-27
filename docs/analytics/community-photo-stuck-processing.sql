-- Source: Supabase public.community_spot_photos
-- Numerator: processing rows older than 15 minutes
-- Denominator: all processing rows
-- Rolling window: current state
-- Minimum sample: 1
-- Owner: community photos rollout operator
-- Rollback: disable runtime writes and run approved cleanup

SELECT
  count(*) FILTER (
    WHERE updated_at < now() - interval '15 minutes'
  ) AS stuck_processing,
  count(*) AS denominator,
  min(updated_at) AS oldest_processing_at,
  CASE
    WHEN count(*) FILTER (
      WHERE updated_at < now() - interval '15 minutes'
    ) > 0 THEN 'stop'
    ELSE 'pass'
  END AS gate_status
FROM public.community_spot_photos
WHERE processing_status = 'processing';
