-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

-- Fix race condition in update_intel_report_count().
--
-- Root cause: the previous implementation used two sequential UPDATE statements.
-- Two concurrent report inserts could both execute the first UPDATE (incrementing
-- report_count), then both read back the same post-increment value from a second
-- SELECT/UPDATE, causing the auto-hide threshold check to fire twice (or not at
-- all if the row was already hidden). The threshold check was evaluated against
-- a value that another transaction may have already modified.
--
-- Fix: use RETURNING on the increment UPDATE so the threshold check operates on
-- the count value that *this* transaction owns, not a re-read that another
-- transaction could have changed in the interim.

CREATE OR REPLACE FUNCTION public.update_intel_report_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_trust_score       NUMERIC(4,3);
    v_hide_threshold    INTEGER;
    v_new_report_count  INTEGER;
    v_post_user_id      UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Atomically increment and capture the post-increment count in one
        -- statement. RETURNING guarantees v_new_report_count reflects the value
        -- committed by *this* UPDATE, not a concurrent one.
        UPDATE public.intel_posts
        SET    report_count = report_count + 1,
               updated_at   = now()
        WHERE  id = NEW.intel_post_id
        RETURNING report_count, user_id
            INTO v_new_report_count, v_post_user_id;

        -- Only apply auto-hide logic on INSERT (new report added).
        -- Fetch the author's trust score to determine the appropriate threshold.
        SELECT COALESCE(p.trust_score, 0.400)
        INTO   v_trust_score
        FROM   public.profiles p
        WHERE  p.id = v_post_user_id;

        v_hide_threshold := CASE WHEN v_trust_score < 0.3 THEN 2 ELSE 3 END;

        -- Evaluate threshold against the RETURNING'd count (atomic with the
        -- increment above), not a second read that a concurrent session could
        -- have already changed.
        IF v_new_report_count >= v_hide_threshold THEN
            UPDATE public.intel_posts
            SET    is_active  = false,
                   updated_at = now()
            WHERE  id = NEW.intel_post_id
              AND  is_active = true;   -- idempotent guard
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement on report retraction. No auto-show logic required here;
        -- moderator action is needed to restore a hidden post.
        UPDATE public.intel_posts
        SET    report_count = GREATEST(0, report_count - 1),
               updated_at   = now()
        WHERE  id = OLD.intel_post_id;
    END IF;

    RETURN NULL;
END;
$$;

-- No trigger DDL changes required; the existing trigger on intel_post_reports
-- already calls this function. Replacing the function body is sufficient.

COMMIT;
