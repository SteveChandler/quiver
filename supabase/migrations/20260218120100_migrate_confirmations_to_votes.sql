BEGIN;

-- ============================================================
-- Data migration: backfill intel_votes from intel_post_confirmations
--
-- Inserts one 'confirmed' vote per confirmation row that does
-- not already have a matching entry in intel_votes (idempotent).
-- The trigger update_intel_vote_counts() is bypassed here because
-- we backfill the counters directly in the next step, avoiding
-- per-row trigger overhead on potentially large datasets.
-- ============================================================

-- Temporarily disable the vote-count trigger during bulk insert
-- so we do not fire O(n) UPDATE statements against intel_posts.
ALTER TABLE public.intel_votes DISABLE TRIGGER trg_update_intel_vote_counts;

INSERT INTO public.intel_votes (intel_post_id, user_id, vote_type, created_at)
SELECT
    ipc.intel_post_id,
    ipc.user_id,
    'confirmed'::intel_vote_type,
    ipc.created_at
FROM public.intel_post_confirmations ipc
WHERE NOT EXISTS (
    SELECT 1
    FROM public.intel_votes iv
    WHERE iv.intel_post_id = ipc.intel_post_id
      AND iv.user_id       = ipc.user_id
);

-- Re-enable trigger before counter backfill so future writes are tracked
ALTER TABLE public.intel_votes ENABLE TRIGGER trg_update_intel_vote_counts;

-- ============================================================
-- Backfill confirmed_count from the existing confirmations_count.
--
-- We trust confirmations_count as the authoritative source because
-- it was maintained by the update_intel_confirmations_count() trigger
-- throughout the lifetime of intel_post_confirmations.
-- ============================================================
UPDATE public.intel_posts
SET confirmed_count = confirmations_count
WHERE confirmations_count > 0;

-- helpful_count and off_count start at 0 (no pre-existing data).
-- No action needed for those columns.

-- ============================================================
-- intel_post_confirmations is intentionally left in place.
-- A follow-up migration will drop it once the client has been
-- fully migrated to use intel_votes.
-- ============================================================

COMMIT;
