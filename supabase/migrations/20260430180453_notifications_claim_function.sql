-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

CREATE OR REPLACE FUNCTION claim_notification_events(
  p_batch_size int,
  p_lease_seconds int,
  p_claim_token uuid
)
RETURNS SETOF notification_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM notification_events
    WHERE (
      status = 'pending'
      OR (
        status = 'processing'
        AND claimed_at < now() - make_interval(secs => p_lease_seconds)
      )
    )
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
    ORDER BY next_attempt_at NULLS FIRST, created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE notification_events ne
  SET
    status = 'processing',
    claimed_at = now(),
    claim_token = p_claim_token,
    attempt_count = ne.attempt_count + 1,
    last_attempt_at = now()
  FROM claimable
  WHERE ne.id = claimable.id
  RETURNING ne.*;
END;
$$;

COMMENT ON FUNCTION claim_notification_events(int, int, uuid) IS
  'Atomically claim up to p_batch_size pending or stale-processing events for a worker tick. Uses FOR UPDATE SKIP LOCKED so parallel workers claim disjoint sets. See lib/notifications/worker.ts for the caller pattern.';

REVOKE ALL ON FUNCTION claim_notification_events(int, int, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_notification_events(int, int, uuid) TO service_role;
