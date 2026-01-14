-- Create table for AI-generated content templates
-- Templates use {{variables}} that get hydrated with real forecast data at runtime

BEGIN;

CREATE TABLE IF NOT EXISTS public.npc_content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('intel', 'session_note', 'review')),
  personality TEXT NOT NULL CHECK (personality IN ('rookie', 'local', 'traveler', 'photographer', 'tactical', 'competitor', 'forecaster')),
  tag TEXT, -- For intel posts: 'conditions', 'parking', 'crowd', 'access'
  template TEXT NOT NULL, -- Content with {{variables}} like {{beach_name}}, {{wave_range}}
  variables TEXT[] NOT NULL, -- Array of variable names used in template
  use_count INT DEFAULT 0, -- Tracks usage for staleness detection
  last_used_at TIMESTAMPTZ,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient template lookup during content generation
CREATE INDEX IF NOT EXISTS idx_templates_lookup
ON npc_content_templates(content_type, personality, tag)
WHERE archived = false;

-- Index for staleness detection queries
CREATE INDEX IF NOT EXISTS idx_templates_freshness
ON npc_content_templates(use_count, last_used_at)
WHERE archived = false;

-- Enable RLS
ALTER TABLE npc_content_templates ENABLE ROW LEVEL SECURITY;

-- Allow public read access (templates are not sensitive)
CREATE POLICY npc_templates_select_all ON npc_content_templates
  FOR SELECT USING (true);

COMMIT;
