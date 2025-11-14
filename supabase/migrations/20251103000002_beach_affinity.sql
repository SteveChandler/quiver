-- Migration: Beach Affinity Tracking
-- Purpose: Create user_beach_affinity table to track user familiarity with beaches
-- Based on session history: frequency, recency, and consistency
-- Part of: Phase 4 - Personalization Implementation (Workpath 4.1)

-- Create user_beach_affinity table
CREATE TABLE user_beach_affinity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,

  -- Metrics
  session_count int NOT NULL DEFAULT 0,
  last_surfed_at timestamptz,
  affinity_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (affinity_score >= 0 AND affinity_score <= 100),

  -- Metadata
  computed_at timestamptz DEFAULT now(),

  CONSTRAINT unique_user_beach_affinity UNIQUE(user_id, beach_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_user_beach_affinity_user ON user_beach_affinity(user_id);
CREATE INDEX idx_user_beach_affinity_beach ON user_beach_affinity(beach_id);
CREATE INDEX idx_user_beach_affinity_score ON user_beach_affinity(user_id, affinity_score DESC);

-- RLS policies
ALTER TABLE user_beach_affinity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own affinities"
  ON user_beach_affinity FOR SELECT
  USING (user_id = auth.uid());

-- Compute affinity function
-- Algorithm: base (10*sessions, max 50) + recency (30*exp(-days/180)) + frequency (+20 if 5+ sessions)
CREATE OR REPLACE FUNCTION compute_beach_affinity(
  _user_id uuid,
  _beach_id uuid
) RETURNS numeric AS $$
DECLARE
  session_count int;
  last_surfed timestamptz;
  days_since_last numeric;
  base_score numeric;
  recency_bonus numeric;
  frequency_bonus numeric;
  affinity numeric;
BEGIN
  -- Count sessions and get last surf date
  SELECT COUNT(*), MAX(arrival_time)
  INTO session_count, last_surfed
  FROM sessions
  WHERE user_id = _user_id AND beach_id = _beach_id;

  -- No sessions = 0 affinity
  IF session_count = 0 THEN
    RETURN 0;
  END IF;

  -- Base score: 10 points per session, capped at 50
  base_score := LEAST(session_count * 10, 50);

  -- Recency bonus: 30 points max, exponential decay over 180 days
  days_since_last := EXTRACT(DAY FROM (NOW() - last_surfed));
  recency_bonus := 30 * EXP(-days_since_last / 180.0);

  -- Frequency bonus: +20 if 5+ sessions
  frequency_bonus := CASE WHEN session_count >= 5 THEN 20 ELSE 0 END;

  -- Total affinity (capped at 100)
  affinity := base_score + recency_bonus + frequency_bonus;

  RETURN LEAST(100, affinity);
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger function to auto-update affinity on session changes
CREATE OR REPLACE FUNCTION update_beach_affinity_on_session_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Recompute affinity for this user-beach pair
    INSERT INTO user_beach_affinity (user_id, beach_id, session_count, last_surfed_at, affinity_score)
    SELECT
      NEW.user_id,
      NEW.beach_id,
      COUNT(*),
      MAX(arrival_time),
      compute_beach_affinity(NEW.user_id, NEW.beach_id)
    FROM sessions
    WHERE user_id = NEW.user_id AND beach_id = NEW.beach_id
    GROUP BY user_id, beach_id
    ON CONFLICT (user_id, beach_id) DO UPDATE SET
      session_count = EXCLUDED.session_count,
      last_surfed_at = EXCLUDED.last_surfed_at,
      affinity_score = EXCLUDED.affinity_score,
      computed_at = NOW();
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Recompute or delete if no sessions remain
    DELETE FROM user_beach_affinity
    WHERE user_id = OLD.user_id AND beach_id = OLD.beach_id
    AND NOT EXISTS (
      SELECT 1 FROM sessions
      WHERE user_id = OLD.user_id AND beach_id = OLD.beach_id
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on sessions table
CREATE TRIGGER update_beach_affinity_trigger
AFTER INSERT OR UPDATE OR DELETE ON sessions
FOR EACH ROW
EXECUTE FUNCTION update_beach_affinity_on_session_change();

-- Add documentation comments
COMMENT ON TABLE user_beach_affinity IS 'Tracks user familiarity with beaches based on surf history';
COMMENT ON COLUMN user_beach_affinity.affinity_score IS 'Computed score (0-100) based on session count, recency, and frequency';
COMMENT ON FUNCTION compute_beach_affinity IS 'Calculates beach affinity: base (10*sessions, max 50) + recency (30*exp(-days/180)) + frequency (+20 if 5+ sessions)';
COMMENT ON FUNCTION update_beach_affinity_on_session_change IS 'Trigger function that automatically updates beach affinity when sessions are added, modified, or deleted';
COMMENT ON TRIGGER update_beach_affinity_trigger ON sessions IS 'Maintains user_beach_affinity table in sync with session changes';

-- Initial bulk computation function (Workpath 4.2)
-- Purpose: One-time backfill of user_beach_affinity table from existing session history
-- Safe to run multiple times (idempotent via ON CONFLICT)
CREATE OR REPLACE FUNCTION compute_all_affinities_initial()
RETURNS void AS $$
BEGIN
  INSERT INTO user_beach_affinity (user_id, beach_id, session_count, last_surfed_at, affinity_score)
  SELECT
    user_id,
    beach_id,
    COUNT(*) as session_count,
    MAX(arrival_time) as last_surfed_at,
    compute_beach_affinity(user_id, beach_id) as affinity_score
  FROM sessions
  GROUP BY user_id, beach_id
  ON CONFLICT (user_id, beach_id) DO UPDATE SET
    session_count = EXCLUDED.session_count,
    last_surfed_at = EXCLUDED.last_surfed_at,
    affinity_score = EXCLUDED.affinity_score,
    computed_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION compute_all_affinities_initial IS 'One-time bulk computation of beach affinities from existing session history. Idempotent - safe to run multiple times. Used by scripts/compute-initial-affinities.ts';
