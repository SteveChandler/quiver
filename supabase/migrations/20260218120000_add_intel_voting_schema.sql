BEGIN;

-- ============================================================
-- 1. Add trust_score to profiles
-- ============================================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS trust_score NUMERIC(4,3) NOT NULL DEFAULT 0.400;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_trust_score_range;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_trust_score_range CHECK (trust_score >= 0 AND trust_score <= 1);

-- ============================================================
-- 2. Create intel_vote_type enum
-- ============================================================
DO $$ BEGIN
    CREATE TYPE intel_vote_type AS ENUM ('helpful', 'off', 'confirmed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 3. Create intel_votes table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intel_votes (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    intel_post_id UUID         NOT NULL REFERENCES public.intel_posts(id) ON DELETE CASCADE,
    user_id       UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vote_type     intel_vote_type NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (intel_post_id, user_id)
);

CREATE INDEX IF NOT EXISTS intel_votes_intel_post_id_idx
    ON public.intel_votes (intel_post_id);

CREATE INDEX IF NOT EXISTS intel_votes_user_id_idx
    ON public.intel_votes (user_id);

CREATE INDEX IF NOT EXISTS intel_votes_post_vote_type_idx
    ON public.intel_votes (intel_post_id, vote_type);

-- ============================================================
-- 4. Enable RLS on intel_votes
-- ============================================================
ALTER TABLE public.intel_votes ENABLE ROW LEVEL SECURITY;

-- Public read access
DROP POLICY IF EXISTS "intel_votes_select_public" ON public.intel_votes;
CREATE POLICY "intel_votes_select_public"
    ON public.intel_votes
    FOR SELECT
    USING (true);

-- Authenticated users may insert their own votes
DROP POLICY IF EXISTS "intel_votes_insert_own" ON public.intel_votes;
CREATE POLICY "intel_votes_insert_own"
    ON public.intel_votes
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Authenticated users may update their own votes
DROP POLICY IF EXISTS "intel_votes_update_own" ON public.intel_votes;
CREATE POLICY "intel_votes_update_own"
    ON public.intel_votes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Authenticated users may delete their own votes
DROP POLICY IF EXISTS "intel_votes_delete_own" ON public.intel_votes;
CREATE POLICY "intel_votes_delete_own"
    ON public.intel_votes
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ============================================================
-- 5. Add cached vote counters to intel_posts
-- ============================================================
ALTER TABLE public.intel_posts
    ADD COLUMN IF NOT EXISTS helpful_count   INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.intel_posts
    ADD COLUMN IF NOT EXISTS off_count       INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.intel_posts
    ADD COLUMN IF NOT EXISTS confirmed_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 6. Trigger: maintain cached vote counters on intel_posts
-- ============================================================
-- SECURITY DEFINER: Required because RLS on intel_posts would prevent the trigger
-- (running as the voting user) from updating counter columns on posts owned by
-- other users. This is safe because the trigger only increments/decrements
-- specific counter columns and cannot be called directly by clients.
CREATE OR REPLACE FUNCTION public.update_intel_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.intel_posts
        SET
            helpful_count      = helpful_count   + CASE WHEN NEW.vote_type = 'helpful'   THEN 1 ELSE 0 END,
            off_count          = off_count       + CASE WHEN NEW.vote_type = 'off'        THEN 1 ELSE 0 END,
            confirmed_count    = confirmed_count + CASE WHEN NEW.vote_type = 'confirmed'  THEN 1 ELSE 0 END,
            -- Legacy counter kept in sync
            confirmations_count = confirmations_count + CASE WHEN NEW.vote_type = 'confirmed' THEN 1 ELSE 0 END,
            updated_at         = now()
        WHERE id = NEW.intel_post_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts
        SET
            helpful_count      = GREATEST(0, helpful_count   - CASE WHEN OLD.vote_type = 'helpful'   THEN 1 ELSE 0 END),
            off_count          = GREATEST(0, off_count       - CASE WHEN OLD.vote_type = 'off'        THEN 1 ELSE 0 END),
            confirmed_count    = GREATEST(0, confirmed_count - CASE WHEN OLD.vote_type = 'confirmed'  THEN 1 ELSE 0 END),
            -- Legacy counter kept in sync
            confirmations_count = GREATEST(0, confirmations_count - CASE WHEN OLD.vote_type = 'confirmed' THEN 1 ELSE 0 END),
            updated_at         = now()
        WHERE id = OLD.intel_post_id;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Only act when the vote type actually changed
        IF OLD.vote_type IS DISTINCT FROM NEW.vote_type THEN
            UPDATE public.intel_posts
            SET
                -- Decrement old type
                helpful_count   = GREATEST(0, helpful_count   - CASE WHEN OLD.vote_type = 'helpful'  THEN 1 ELSE 0 END)
                                             + CASE WHEN NEW.vote_type = 'helpful'  THEN 1 ELSE 0 END,
                off_count       = GREATEST(0, off_count       - CASE WHEN OLD.vote_type = 'off'       THEN 1 ELSE 0 END)
                                             + CASE WHEN NEW.vote_type = 'off'       THEN 1 ELSE 0 END,
                confirmed_count = GREATEST(0, confirmed_count - CASE WHEN OLD.vote_type = 'confirmed' THEN 1 ELSE 0 END)
                                             + CASE WHEN NEW.vote_type = 'confirmed' THEN 1 ELSE 0 END,
                -- Legacy counter: decrement if was confirmed, increment if now confirmed
                confirmations_count = GREATEST(0, confirmations_count
                                        - CASE WHEN OLD.vote_type = 'confirmed' THEN 1 ELSE 0 END)
                                        + CASE WHEN NEW.vote_type = 'confirmed' THEN 1 ELSE 0 END,
                updated_at      = now()
            WHERE id = NEW.intel_post_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_intel_vote_counts ON public.intel_votes;
CREATE TRIGGER trg_update_intel_vote_counts
    AFTER INSERT OR DELETE OR UPDATE ON public.intel_votes
    FOR EACH ROW EXECUTE FUNCTION public.update_intel_vote_counts();

-- ============================================================
-- 7. Update report auto-hide trigger to use trust-based threshold
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_intel_report_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_post_user_id  UUID;
    v_trust_score   NUMERIC(4,3);
    v_hide_threshold INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.intel_posts
        SET report_count = report_count + 1,
            updated_at   = now()
        WHERE id = NEW.intel_post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts
        SET report_count = GREATEST(0, report_count - 1),
            updated_at   = now()
        WHERE id = OLD.intel_post_id;
    END IF;

    -- Re-evaluate auto-hide using a trust-based threshold
    SELECT ip.user_id
    INTO v_post_user_id
    FROM public.intel_posts ip
    WHERE ip.id = COALESCE(NEW.intel_post_id, OLD.intel_post_id);

    SELECT COALESCE(p.trust_score, 0.400)
    INTO v_trust_score
    FROM public.profiles p
    WHERE p.id = v_post_user_id;

    -- Low-trust authors get hidden after 2 reports; others after 3
    v_hide_threshold := CASE WHEN v_trust_score < 0.3 THEN 2 ELSE 3 END;

    UPDATE public.intel_posts
    SET is_active  = false,
        updated_at = now()
    WHERE id = COALESCE(NEW.intel_post_id, OLD.intel_post_id)
      AND report_count >= v_hide_threshold
      AND is_active = true;

    RETURN NULL;
END;
$$;

-- Drop old trigger name and create with consistent naming
DROP TRIGGER IF EXISTS intel_reports_count_trigger ON public.intel_reports;
DROP TRIGGER IF EXISTS trg_update_intel_report_count ON public.intel_reports;
CREATE TRIGGER intel_reports_count_trigger
    AFTER INSERT OR DELETE ON public.intel_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_intel_report_count();

-- ============================================================
-- 8. Enable Realtime on intel_votes
-- ============================================================
ALTER TABLE public.intel_votes REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        -- Add table only if it is not already a member
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename  = 'intel_votes'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.intel_votes;
        END IF;
    END IF;
END $$;

-- ============================================================
-- 9. Grant permissions
-- ============================================================
GRANT SELECT ON public.intel_votes TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.intel_votes TO authenticated, service_role;

COMMIT;
