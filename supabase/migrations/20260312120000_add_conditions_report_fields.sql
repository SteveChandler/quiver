BEGIN;

-- Add structured conditions report fields to intel_posts
ALTER TABLE intel_posts
  ADD COLUMN IF NOT EXISTS wave_size_range TEXT,
  ADD COLUMN IF NOT EXISTS vibe TEXT;

-- Add source column to sessions to track how a session record was created.
-- Values: 'manual' | 'conditions_report' | 'email_one_tap'
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Index to efficiently query recent conditions reports for a beach
-- (used by getRecentConditionsReports to find posts within the last 24 hours)
CREATE INDEX IF NOT EXISTS idx_intel_posts_beach_created
  ON intel_posts (beach_id, created_at DESC);

-- Constrain vibe to known values (nullable — existing rows unaffected)
ALTER TABLE intel_posts
  ADD CONSTRAINT intel_posts_vibe_check
  CHECK (vibe IS NULL OR vibe IN ('firing', 'fun', 'meh', 'rough'));

-- Constrain wave_size_range to known values (nullable — existing rows unaffected)
ALTER TABLE intel_posts
  ADD CONSTRAINT intel_posts_wave_size_range_check
  CHECK (wave_size_range IS NULL OR wave_size_range IN ('1-2ft', '2-3ft', '3-4ft', '4-5ft', '5+ft'));

-- Constrain sessions.source to known values (nullable — existing rows unaffected)
ALTER TABLE sessions
  ADD CONSTRAINT sessions_source_check
  CHECK (source IS NULL OR source IN ('manual', 'conditions_report', 'email_one_tap'));

COMMIT;
