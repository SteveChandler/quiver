-- Migration: Create session shares tracking system (FIXED)
-- Purpose: Track social media shares for viral growth analytics
-- Date: 2025-10-24
-- Note: This fixes the syntax error in the previous migration

-- Drop the table if it exists from the failed migration
DROP TABLE IF EXISTS session_shares CASCADE;

-- Remove share_count column if it was added
ALTER TABLE sessions DROP COLUMN IF EXISTS share_count;

-- Create session_shares table to track individual share events
CREATE TABLE session_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'facebook', 'copy', 'native', 'other')),
  share_url text,
  variant text DEFAULT 'story' CHECK (variant IN ('story', 'square')),
  created_at timestamptz NOT NULL DEFAULT now(),
  share_date date NOT NULL DEFAULT CURRENT_DATE
);

-- Add share_count column to sessions for quick access
ALTER TABLE sessions
ADD COLUMN share_count integer NOT NULL DEFAULT 0;

-- Create indexes for efficient querying
CREATE INDEX idx_session_shares_session_id ON session_shares(session_id);
CREATE INDEX idx_session_shares_user_id ON session_shares(user_id);
CREATE INDEX idx_session_shares_platform ON session_shares(platform);
CREATE INDEX idx_session_shares_created_at ON session_shares(created_at DESC);
CREATE INDEX idx_sessions_share_count ON sessions(share_count DESC) WHERE share_count > 0;

-- Prevent spam: one share per user per session per platform per day
-- Uses the share_date column to avoid timezone/immutability issues with expressions
CREATE UNIQUE INDEX idx_unique_daily_share
  ON session_shares (session_id, user_id, platform, share_date);

-- Enable Row Level Security
ALTER TABLE session_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_shares

-- Users can view shares for:
-- 1. Their own sessions
-- 2. Public sessions
-- 3. Shares they created
CREATE POLICY "Users can view shares for public sessions or own sessions" ON session_shares
  FOR SELECT
  USING (
    -- User created this share
    user_id = auth.uid()
    OR
    -- Session is public
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_shares.session_id
      AND sessions.is_public = true
    )
    OR
    -- User owns the session being shared
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_shares.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Users can insert shares for any session they can view
CREATE POLICY "Users can create shares for sessions they can view" ON session_shares
  FOR INSERT
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- User ID must match authenticated user
    user_id = auth.uid()
    AND
    -- Session must be viewable (public or owned by user)
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_shares.session_id
      AND (
        sessions.is_public = true
        OR sessions.user_id = auth.uid()
      )
    )
  );

-- Users can only delete their own shares
CREATE POLICY "Users can delete their own shares" ON session_shares
  FOR DELETE
  USING (user_id = auth.uid());

-- Function to increment session share count
CREATE OR REPLACE FUNCTION increment_session_share_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sessions
  SET share_count = share_count + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement session share count
CREATE OR REPLACE FUNCTION decrement_session_share_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sessions
  SET share_count = GREATEST(0, share_count - 1)
  WHERE id = OLD.session_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers to maintain share_count
CREATE TRIGGER trigger_increment_share_count
  AFTER INSERT ON session_shares
  FOR EACH ROW
  EXECUTE FUNCTION increment_session_share_count();

CREATE TRIGGER trigger_decrement_share_count
  AFTER DELETE ON session_shares
  FOR EACH ROW
  EXECUTE FUNCTION decrement_session_share_count();

-- Function to get share statistics for a session
CREATE OR REPLACE FUNCTION get_session_share_stats(p_session_id uuid)
RETURNS TABLE (
  total_shares bigint,
  instagram_shares bigint,
  tiktok_shares bigint,
  twitter_shares bigint,
  facebook_shares bigint,
  copy_shares bigint,
  unique_sharers bigint,
  last_shared_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_shares,
    COUNT(*) FILTER (WHERE platform = 'instagram')::bigint AS instagram_shares,
    COUNT(*) FILTER (WHERE platform = 'tiktok')::bigint AS tiktok_shares,
    COUNT(*) FILTER (WHERE platform = 'twitter')::bigint AS twitter_shares,
    COUNT(*) FILTER (WHERE platform = 'facebook')::bigint AS facebook_shares,
    COUNT(*) FILTER (WHERE platform = 'copy')::bigint AS copy_shares,
    COUNT(DISTINCT user_id)::bigint AS unique_sharers,
    MAX(created_at) AS last_shared_at
  FROM session_shares
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_session_share_stats(uuid) TO authenticated;

-- Function to get user's viral coefficient (average shares per session)
CREATE OR REPLACE FUNCTION get_user_viral_coefficient(p_user_id uuid)
RETURNS numeric AS $$
DECLARE
  total_sessions bigint;
  total_shares bigint;
  viral_coefficient numeric;
BEGIN
  -- Count user's public sessions
  SELECT COUNT(*)
  INTO total_sessions
  FROM sessions
  WHERE user_id = p_user_id
  AND status = 'completed'
  AND is_public = true;

  -- Return 0 if no sessions
  IF total_sessions = 0 THEN
    RETURN 0;
  END IF;

  -- Count total shares of user's sessions
  SELECT COUNT(*)
  INTO total_shares
  FROM session_shares ss
  INNER JOIN sessions s ON s.id = ss.session_id
  WHERE s.user_id = p_user_id;

  -- Calculate coefficient
  viral_coefficient := total_shares::numeric / total_sessions::numeric;

  RETURN ROUND(viral_coefficient, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_viral_coefficient(uuid) TO authenticated;

-- Comment the tables and columns
COMMENT ON TABLE session_shares IS 'Tracks social media shares of surf sessions for viral growth analytics';
COMMENT ON COLUMN session_shares.platform IS 'Social media platform: instagram, tiktok, twitter, facebook, copy, native, other';
COMMENT ON COLUMN session_shares.variant IS 'Share image variant: story (1080x1920) or square (1080x1080)';
COMMENT ON COLUMN session_shares.share_url IS 'Generated share URL with UTM parameters for tracking';
COMMENT ON COLUMN session_shares.share_date IS 'Date of share (used for daily uniqueness constraint)';
COMMENT ON COLUMN sessions.share_count IS 'Cached count of shares for this session (maintained by triggers)';
COMMENT ON FUNCTION get_session_share_stats(uuid) IS 'Get detailed share statistics for a session';
COMMENT ON FUNCTION get_user_viral_coefficient(uuid) IS 'Calculate viral coefficient (avg shares per session) for a user';
