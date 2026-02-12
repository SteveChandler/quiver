BEGIN;

-- Create fallback_events table for tracking data fallback/substitution events
-- This is an internal monitoring table to help identify data quality issues
-- No RLS policies: service-role access only (inserts from server-side trackFallback())
CREATE TABLE IF NOT EXISTS fallback_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  domain text NOT NULL,
  field text NOT NULL,
  fallback_value text,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'dangerous')),
  reason text,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by severity level
CREATE INDEX IF NOT EXISTS idx_fallback_events_severity_created
  ON fallback_events (severity, created_at DESC);

-- Index for querying by domain
CREATE INDEX IF NOT EXISTS idx_fallback_events_domain_created
  ON fallback_events (domain, created_at DESC);

ALTER TABLE fallback_events ENABLE ROW LEVEL SECURITY;

-- Schedule auto-prune job (only if pg_cron extension is available)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'prune-fallback-events',
      '0 3 * * *',
      $cron$DELETE FROM fallback_events WHERE created_at < now() - interval '7 days'$cron$
    );
  END IF;
END $$;

COMMIT;
