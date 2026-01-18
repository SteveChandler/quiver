-- Migration: Create NPC Content Templates Table
-- Part of the Realistic NPC System implementation
-- This table stores AI-generated content templates for NPC posts

-- Create the npc_content_templates table
CREATE TABLE IF NOT EXISTS npc_content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template classification
  content_type TEXT NOT NULL CHECK (content_type IN ('intel', 'session_note', 'review')),
  personality TEXT NOT NULL CHECK (personality IN ('rookie', 'local', 'traveler', 'photographer', 'tactical', 'competitor', 'forecaster')),
  tag TEXT CHECK (tag IN ('conditions', 'parking', 'crowd', 'access') OR tag IS NULL),

  -- Template content
  template TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',

  -- Usage tracking for staleness detection
  use_count INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Lifecycle
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE npc_content_templates IS 'AI-generated content templates for NPC (mock user) posts. Templates contain {{variables}} that are hydrated with real forecast data at runtime.';

-- Indexes for efficient template lookup
CREATE INDEX idx_npc_templates_lookup
ON npc_content_templates(content_type, personality, tag)
WHERE archived = false;

CREATE INDEX idx_npc_templates_freshness
ON npc_content_templates(use_count, last_used_at)
WHERE archived = false;

-- Add is_system_account column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_system_account'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_system_account BOOLEAN DEFAULT false;
    COMMENT ON COLUMN profiles.is_system_account IS 'True for system accounts like Quiver Surf Forecast bot';
  END IF;
END $$;

-- Add posting_window column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'posting_window'
  ) THEN
    ALTER TABLE profiles ADD COLUMN posting_window JSONB;
    COMMENT ON COLUMN profiles.posting_window IS 'JSON object defining primary and secondary posting time windows, e.g., {"primary": [5, 8], "secondary": [16, 19]}';
  END IF;
END $$;

-- RLS policies for npc_content_templates
ALTER TABLE npc_content_templates ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users (templates are not sensitive)
CREATE POLICY "Templates are readable by authenticated users"
ON npc_content_templates FOR SELECT
TO authenticated
USING (true);

-- Only service role can insert/update/delete templates
CREATE POLICY "Only service role can manage templates"
ON npc_content_templates FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_npc_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER npc_templates_updated_at
  BEFORE UPDATE ON npc_content_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_npc_template_updated_at();
