-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

-- Temporarily disable the vote-count trigger during bulk insert
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

-- Re-enable trigger
ALTER TABLE public.intel_votes ENABLE TRIGGER trg_update_intel_vote_counts;

-- Backfill confirmed_count from existing confirmations_count
UPDATE public.intel_posts
SET confirmed_count = confirmations_count
WHERE confirmations_count > 0;

COMMIT;
