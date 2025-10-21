-- Create forecast_accuracy_votes table for community forecast verification
-- Part of forecast transparency and social engagement features
-- Migration: 20251021000000

BEGIN;

-- Create forecast_accuracy_votes table
CREATE TABLE IF NOT EXISTS forecast_accuracy_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  forecast_id uuid NOT NULL REFERENCES enhanced_forecasts(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  was_accurate boolean NOT NULL,
  actual_conditions jsonb DEFAULT NULL,  -- Optional: what the user observed
  notes text DEFAULT NULL,
  photo_url text DEFAULT NULL,  -- Optional: photo proof from session
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Ensure one vote per user per forecast
  CONSTRAINT unique_user_forecast_vote UNIQUE(user_id, forecast_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_forecast_votes_user
  ON forecast_accuracy_votes(user_id);

CREATE INDEX IF NOT EXISTS idx_forecast_votes_forecast
  ON forecast_accuracy_votes(forecast_id);

CREATE INDEX IF NOT EXISTS idx_forecast_votes_beach
  ON forecast_accuracy_votes(beach_id);

CREATE INDEX IF NOT EXISTS idx_forecast_votes_created
  ON forecast_accuracy_votes(created_at DESC);

-- Composite index for beach accuracy aggregations
CREATE INDEX IF NOT EXISTS idx_forecast_votes_beach_created
  ON forecast_accuracy_votes(beach_id, created_at DESC);

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger
CREATE TRIGGER update_forecast_accuracy_votes_updated_at
  BEFORE UPDATE ON forecast_accuracy_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE forecast_accuracy_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Anyone can read votes (public transparency)
CREATE POLICY forecast_votes_select_policy ON forecast_accuracy_votes
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert their own votes
CREATE POLICY forecast_votes_insert_policy ON forecast_accuracy_votes
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Policy: Users can update their own votes
CREATE POLICY forecast_votes_update_policy ON forecast_accuracy_votes
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Policy: Users can delete their own votes
CREATE POLICY forecast_votes_delete_policy ON forecast_accuracy_votes
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Add comments for documentation
COMMENT ON TABLE forecast_accuracy_votes IS
  'Community verification votes for forecast accuracy. Users can vote on whether a forecast was accurate, with optional notes and photo evidence.';

COMMENT ON COLUMN forecast_accuracy_votes.was_accurate IS
  'Boolean indicating if the user found the forecast accurate for their session.';

COMMENT ON COLUMN forecast_accuracy_votes.actual_conditions IS
  'JSON object describing what the user actually observed (optional). Can include wave_height, wave_period, wind_speed, etc.';

COMMENT ON COLUMN forecast_accuracy_votes.photo_url IS
  'Optional URL to a session photo that serves as evidence for the verification.';

COMMIT;
