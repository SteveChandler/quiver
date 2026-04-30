-- Phase 5b: atomic claim function for the notifications worker.
--
-- Replaces the prior two-phase JS claim (SELECT ids → UPDATE same set with
-- predicate re-check) with a single Postgres function using FOR UPDATE SKIP
-- LOCKED inside a CTE. Two simultaneous workers are now guaranteed to claim
-- disjoint event sets — the earlier two-phase approach worked for serialized
-- Vercel cron but became fragile once we wanted to support manual cron kicks
-- + scheduled runs overlapping.
--
-- Semantics:
--   - Eligible rows: status='pending' OR (status='processing' AND claimed_at
--     is older than the lease window, i.e. the previous worker crashed and
--     its claim is stale).
--   - AND: next_attempt_at IS NULL OR <= now() (retry-scheduled rows wait).
--   - Locked with FOR UPDATE SKIP LOCKED — a parallel transaction trying to
--     lock the same rows skips them rather than blocking.
--   - Updated atomically: status→'processing', claimed_at→now(),
--     claim_token→caller's UUID, attempt_count++, last_attempt_at→now().
--   - Returns the updated rows (worker reads claim_token from the result).
--
-- Stale-claim recovery: a row stuck in 'processing' with claimed_at older
-- than the caller-supplied lease seconds becomes claimable again. Caller
-- controls lease via p_lease_seconds (worker passes 300 = 5 minutes).
--
-- Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 5b).

BEGIN;

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

-- Service role only — the cron worker calls this. No EXECUTE grants to
-- authenticated/anon (default Supabase: PUBLIC has no privileges on
-- newly-created functions in non-public schemas, but we ensure here).
REVOKE ALL ON FUNCTION claim_notification_events(int, int, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_notification_events(int, int, uuid) TO service_role;

COMMIT;
