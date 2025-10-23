-- Add structured beach content fields for better UX and SEO

-- Features array (filterable beach characteristics)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS features TEXT[];

-- Practical tips (structured from local knowledge)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS parking_tips TEXT;
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS access_tips TEXT;
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS wave_tips TEXT;
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS crowd_tips TEXT;

-- Best conditions (human-readable)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS best_conditions_prose TEXT;

-- Warnings (safety/hazards)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS warnings TEXT[];

-- Local etiquette
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS local_etiquette TEXT;

-- Crowd level
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS crowd_level TEXT;

-- Description (2-3 paragraphs)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS description TEXT;

-- Real takeaways (emoji-prefixed local tips)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS real_takeaways TEXT[];

-- Best months for surfing (1-12)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS best_months INTEGER[];

-- Add indexes for filtering
CREATE INDEX IF NOT EXISTS idx_beaches_features ON beaches USING GIN (features);
CREATE INDEX IF NOT EXISTS idx_beaches_crowd_level ON beaches (crowd_level);
CREATE INDEX IF NOT EXISTS idx_beaches_best_months ON beaches USING GIN (best_months);

-- Column descriptions
COMMENT ON COLUMN beaches.features IS 'Feature tags for filtering (e.g., "Beginner friendly", "Lifeguard on duty")';
COMMENT ON COLUMN beaches.best_conditions_prose IS 'Human-readable best conditions (e.g., "Mid tide with offshore winds")';
COMMENT ON COLUMN beaches.warnings IS 'Safety warnings and hazards';
COMMENT ON COLUMN beaches.real_takeaways IS 'Emoji-prefixed local tips';

