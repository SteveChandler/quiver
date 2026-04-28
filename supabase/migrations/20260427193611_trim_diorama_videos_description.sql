-- Trim the trailing "Veo's daily quota is the pacing limit, not the queue."
-- sentence from the in_progress "More beaches with diorama videos" roadmap
-- item. Internal pacing detail; not user-facing value.
--
-- Already applied to prod row d93e2282-29fb-4c0d-a9fc-76af7b4a1b95 via
-- Supabase MCP on 2026-04-27. The seed file (supabase/seeds/roadmap_v1_seed.sql)
-- was updated for new-env parity, but the seed uses ON CONFLICT (title)
-- DO NOTHING — existing local/preview environments that already seeded the
-- long copy would not pick up the change. This migration closes that drift.
--
-- Idempotent: a second run finds 0 matching rows (the LIKE filter no longer
-- matches once the Veo phrase is gone) and is a no-op.

BEGIN;

UPDATE public.roadmap_items
SET description = 'Shipping ~10 new beach diorama videos per week.',
    updated_at = now()
WHERE title = 'More beaches with diorama videos'
  AND description LIKE '%Veo%';

COMMIT;
