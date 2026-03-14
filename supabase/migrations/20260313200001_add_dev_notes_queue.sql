-- Dev Notes Queue + post_type expansion
-- Adds dev_notes_queue table for queuing polished dev notes,
-- and expands the post_type CHECK constraints on posting_config
-- and posting_log to include 'dev_notes'.

BEGIN;

-- ============================================================
-- 1. Expand CHECK constraints on posting_config and posting_log
--    to allow 'dev_notes' as a valid post_type
-- ============================================================

-- posting_config: drop old CHECK, add expanded one
ALTER TABLE public.posting_config
    DROP CONSTRAINT IF EXISTS posting_config_post_type_check;

ALTER TABLE public.posting_config
    ADD CONSTRAINT posting_config_post_type_check
    CHECK (post_type IN ('go_no', 'weekend_wave', 'longboard_sunday', 'dev_notes'));

-- posting_log: drop old CHECK, add expanded one
ALTER TABLE public.posting_log
    DROP CONSTRAINT IF EXISTS posting_log_post_type_check;

ALTER TABLE public.posting_log
    ADD CONSTRAINT posting_log_post_type_check
    CHECK (post_type IN ('go_no', 'weekend_wave', 'longboard_sunday', 'dev_notes'));

-- ============================================================
-- 2. Table: dev_notes_queue
--    Queue for dev notes to be polished and posted to Bluesky
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dev_notes_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_text TEXT NOT NULL,
    polished_text TEXT,
    posted BOOLEAN NOT NULL DEFAULT false,
    posted_at TIMESTAMPTZ,
    posting_log_id UUID REFERENCES public.posting_log(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_dev_notes_queue_unposted
    ON public.dev_notes_queue (posted, created_at)
    WHERE posted = false;

-- ============================================================
-- 4. Row Level Security
--    Service_role only (same pattern as posting_config/posting_log).
--    RLS enabled with no anon/authenticated policies.
-- ============================================================
ALTER TABLE public.dev_notes_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Seed posting_config with dev_notes row
-- ============================================================
INSERT INTO public.posting_config (post_type, enabled, cadence_phase)
VALUES ('dev_notes', true, 'daily')
ON CONFLICT (post_type) DO NOTHING;

COMMIT;
