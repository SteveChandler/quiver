-- supabase/migrations/20260425000200_create_roadmap_item_submissions.sql
--
-- User-submitted feature requests. Never publicly visible. Moderated by
-- the founder directly in Supabase at this scale. Approved submissions
-- are manually copied into roadmap_items (not auto-promoted — gives the
-- founder a chance to rewrite the title/description in brand voice).

BEGIN;

CREATE TYPE public.roadmap_submission_decision AS ENUM (
  'pending',
  'approved',
  'declined',
  'merged_into'
);

CREATE TABLE public.roadmap_item_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  category public.roadmap_category NOT NULL,
  submitter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision public.roadmap_submission_decision NOT NULL DEFAULT 'pending',
  merged_into_item_id uuid REFERENCES public.roadmap_items(id) ON DELETE SET NULL,
  founder_reply text CHECK (founder_reply IS NULL OR char_length(founder_reply) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX roadmap_item_submissions_submitter_idx
  ON public.roadmap_item_submissions (submitter_user_id);
CREATE INDEX roadmap_item_submissions_decision_idx
  ON public.roadmap_item_submissions (decision)
  WHERE decision = 'pending';

ALTER TABLE public.roadmap_item_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY roadmap_submissions_own_read
  ON public.roadmap_item_submissions
  FOR SELECT
  USING (auth.uid() = submitter_user_id);

CREATE POLICY roadmap_submissions_own_insert
  ON public.roadmap_item_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = submitter_user_id);

-- No UPDATE or DELETE policies — moderation via service role only.

CREATE TRIGGER set_roadmap_item_submissions_updated_at
  BEFORE UPDATE ON public.roadmap_item_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
