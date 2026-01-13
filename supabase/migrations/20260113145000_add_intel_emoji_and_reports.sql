-- Migration: Add emoji_rating to intel_posts and create intel_reports table
-- This enables community condition ratings and content reporting

BEGIN;

-- Add emoji_rating column to intel_posts
ALTER TABLE public.intel_posts
ADD COLUMN IF NOT EXISTS emoji_rating TEXT
CHECK (emoji_rating IN ('fire', 'shaka', 'meh', 'thumbsdown'));

-- Add report_count column to intel_posts for auto-hide threshold
ALTER TABLE public.intel_posts
ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0;

-- Create index for emoji_rating queries
CREATE INDEX IF NOT EXISTS idx_intel_posts_emoji_rating
ON public.intel_posts(emoji_rating)
WHERE emoji_rating IS NOT NULL;

-- Create intel_reports table
CREATE TABLE IF NOT EXISTS public.intel_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intel_post_id UUID NOT NULL REFERENCES public.intel_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(intel_post_id, user_id)
);

-- Create indexes for intel_reports
CREATE INDEX IF NOT EXISTS idx_intel_reports_post_id ON public.intel_reports(intel_post_id);
CREATE INDEX IF NOT EXISTS idx_intel_reports_user_id ON public.intel_reports(user_id);

-- Enable RLS on intel_reports
ALTER TABLE public.intel_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migration)
DROP POLICY IF EXISTS "Users can report posts" ON public.intel_reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.intel_reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON public.intel_reports;

-- RLS policy: Users can insert their own reports
CREATE POLICY "Users can report posts" ON public.intel_reports
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- RLS policy: Users can view their own reports
CREATE POLICY "Users can view own reports" ON public.intel_reports
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- RLS policy: Users can delete their own reports
CREATE POLICY "Users can delete own reports" ON public.intel_reports
    FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Trigger function to update report_count and auto-hide
CREATE OR REPLACE FUNCTION public.update_intel_report_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.intel_posts
        SET report_count = report_count + 1
        WHERE id = NEW.intel_post_id;

        -- Auto-hide posts with 3+ reports
        UPDATE public.intel_posts
        SET is_active = false
        WHERE id = NEW.intel_post_id AND report_count >= 3;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts
        SET report_count = GREATEST(report_count - 1, 0)
        WHERE id = OLD.intel_post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for report count
DROP TRIGGER IF EXISTS intel_reports_count_trigger ON public.intel_reports;
CREATE TRIGGER intel_reports_count_trigger
    AFTER INSERT OR DELETE ON public.intel_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_intel_report_count();

COMMIT;
