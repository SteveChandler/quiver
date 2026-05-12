-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

-- ============================================================================
-- Migration: Create personalization_milestones table
-- Created: 2026-02-13
-- Description:
--   Tracks when users achieve personalization milestones (e.g., first session,
--   preferences learned, implicit data collected). Used by the client to show
--   celebratory messages and progress indicators.
-- ============================================================================

CREATE TABLE IF NOT EXISTS personalization_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_key text NOT NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  shown_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, milestone_key)
);

-- Index for fetching unshown milestones efficiently
CREATE INDEX IF NOT EXISTS idx_milestones_user_unshown 
  ON personalization_milestones(user_id) 
  WHERE shown_at IS NULL;

ALTER TABLE personalization_milestones ENABLE ROW LEVEL SECURITY;

-- Users can read their own milestones
CREATE POLICY "Users can read own milestones" 
  ON personalization_milestones FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can update shown_at on their own milestones  
CREATE POLICY "Users can mark own milestones shown"
  ON personalization_milestones FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert milestones (cron jobs, server-side detection)
CREATE POLICY "Service role can insert milestones"
  ON personalization_milestones FOR INSERT
  WITH CHECK (true);

-- Add first_session_nudge to email types for the nudge cron
ALTER TABLE public.email_send_log
  DROP CONSTRAINT IF EXISTS email_send_log_email_type_check;

ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_email_type_check
  CHECK (email_type IN (
    'welcome',
    'forecast_digest',
    'reengagement',
    'weekly_recap',
    'conditions_alert',
    'session_prompt',
    'first_session_nudge'
  ));

COMMENT ON TABLE personalization_milestones IS
  'Tracks user personalization milestones for progress messaging and celebration UI';

COMMENT ON CONSTRAINT email_send_log_email_type_check ON public.email_send_log IS
  'Allowed email types: welcome, forecast_digest, reengagement, weekly_recap, conditions_alert, session_prompt, first_session_nudge';

COMMIT;
