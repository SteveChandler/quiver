-- Bluesky Auto-Posting System
-- Creates posting_config (cadence control) and posting_log (audit trail)
-- Used by the bluesky-auto-post Edge Function via service_role only

BEGIN;

-- ============================================================
-- Table: posting_config
-- Controls which post types are active and their cadence phase
-- ============================================================
CREATE TABLE IF NOT EXISTS public.posting_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_type TEXT NOT NULL
        CHECK (post_type IN ('go_no', 'weekend_wave', 'longboard_sunday')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    cadence_phase TEXT NOT NULL DEFAULT 'daily'
        CHECK (cadence_phase IN ('daily', 'settled')),
    last_posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(post_type)
);

-- ============================================================
-- Table: posting_log
-- Audit log of every post attempt (success or failure)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.posting_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_type TEXT NOT NULL
        CHECK (post_type IN ('go_no', 'weekend_wave', 'longboard_sunday')),
    bluesky_uri TEXT,
    content_text TEXT NOT NULL,
    image_url TEXT,
    template_index INT,
    beaches_featured TEXT[],
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
-- Note: posting_config.post_type already has an implicit unique index from UNIQUE(post_type)

CREATE INDEX IF NOT EXISTS idx_posting_log_post_type
    ON public.posting_log (post_type);

CREATE INDEX IF NOT EXISTS idx_posting_log_posted_at
    ON public.posting_log (posted_at DESC);

-- Composite index for template rotation queries:
-- "last N posts of this type, ordered by recency"
CREATE INDEX IF NOT EXISTS idx_posting_log_type_posted_at
    ON public.posting_log (post_type, posted_at DESC);

-- ============================================================
-- Row Level Security
-- These are service_role-only tables (Edge Functions).
-- RLS is enabled but no policies are created for anon/authenticated,
-- so only service_role (which bypasses RLS) can read/write.
-- ============================================================
ALTER TABLE public.posting_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posting_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Seed posting_config with the 3 post types
-- ============================================================
INSERT INTO public.posting_config (post_type, enabled, cadence_phase)
VALUES
    ('go_no', true, 'daily'),
    ('weekend_wave', true, 'daily'),
    ('longboard_sunday', true, 'daily')
ON CONFLICT (post_type) DO NOTHING;

COMMIT;
