-- Flag bot-generated events retroactively
-- Bot fingerprint: Windows/Chrome/desktop/1280px viewport, anonymous sessions
-- Analysis showed this bot generates 53% of anonymous sessions and corrupts analytics

BEGIN;

-- Add bot_flagged column for filtering in analytics queries
ALTER TABLE public.user_events ADD COLUMN IF NOT EXISTS bot_flagged boolean DEFAULT false;

-- Flag known bot events matching the invariant fingerprint
UPDATE public.user_events
SET bot_flagged = true
WHERE user_id IS NULL
  AND bot_flagged = false
  AND metadata->>'_viewport_width' = '1280'
  AND metadata->'_device'->>'os' = 'Windows'
  AND metadata->'_device'->>'browser' = 'Chrome'
  AND metadata->'_device'->>'device_type' = 'desktop';

COMMIT;

-- Index must be outside transaction for CONCURRENTLY support
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_events_bot_flagged
  ON public.user_events (bot_flagged)
  WHERE bot_flagged = true;
