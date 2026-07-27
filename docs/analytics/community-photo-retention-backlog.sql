-- Source: Supabase canonical photo and investigation-hold tables
-- Numerator: unheld removals older than 31 days
-- Denominator: all unheld removed rows
-- Rolling window: current state, checked daily
-- Minimum sample: 1
-- Owner: community photos rollout operator
-- Rollback: stop rollout expansion and recover retention processing

SELECT
  count(*) FILTER (
    WHERE photos.removed_at < now() - interval '31 days'
  ) AS retention_backlog,
  count(*) AS denominator,
  min(photos.removed_at) AS oldest_removed_at,
  CASE
    WHEN count(*) FILTER (
      WHERE photos.removed_at < now() - interval '31 days'
    ) > 0 THEN 'stop'
    ELSE 'pass'
  END AS gate_status
FROM public.community_spot_photos photos
WHERE photos.lifecycle_status = 'removed'
  AND NOT EXISTS (
    SELECT 1
    FROM public.community_photo_investigation_holds holds
    WHERE holds.photo_id = photos.id
      AND holds.released_at IS NULL
  );
