-- Add preferred_tide_direction column to beaches table
-- This indicates whether a beach works best on rising, falling, slack, or any tide

ALTER TABLE beaches
ADD COLUMN IF NOT EXISTS preferred_tide_direction text
CHECK (preferred_tide_direction IN ('rising', 'falling', 'either', 'slack'));

COMMENT ON COLUMN beaches.preferred_tide_direction IS
'Optimal tide movement for this beach: rising (incoming), falling (outgoing), slack, or either. NULL means unknown.';

-- Seed data extracted from best_conditions_prose field
-- Beaches with explicit "rising" or "incoming" tide preference
UPDATE beaches SET preferred_tide_direction = 'rising' WHERE name = '38th Avenue (Santa Cruz)';
UPDATE beaches SET preferred_tide_direction = 'rising' WHERE name = 'Avalon Pier';
UPDATE beaches SET preferred_tide_direction = 'rising' WHERE name = 'Flagler Beach';
UPDATE beaches SET preferred_tide_direction = 'rising' WHERE name = 'Mesa Lane';
UPDATE beaches SET preferred_tide_direction = 'rising' WHERE name = 'Rockview (Santa Cruz)';
UPDATE beaches SET preferred_tide_direction = 'rising' WHERE name = 'Sebastian Inlet';
UPDATE beaches SET preferred_tide_direction = 'rising' WHERE name = 'Shipwrecks';
UPDATE beaches SET preferred_tide_direction = 'rising' WHERE name = 'South Beach';

-- Beaches with explicit "falling" tide preference
UPDATE beaches SET preferred_tide_direction = 'falling' WHERE name = 'Kill Devil Hills';

-- Beaches with "all tides" or "any tide" (works on either direction)
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Belmar';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Crash Boat';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Deerfield Beach Pier';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Jobos';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Long Beach';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Middles Isabela';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Pensacola Pier';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Refugio State Beach';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Scarborough Beach';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Shacks';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Surfer''s Beach';
UPDATE beaches SET preferred_tide_direction = 'either' WHERE name = 'Surfside Beach';

-- Remaining beaches are left as NULL (unknown/to be researched)
-- Can be updated later via:
-- UPDATE beaches SET preferred_tide_direction = 'rising' WHERE name = 'Beach Name';
