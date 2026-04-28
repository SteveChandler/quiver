-- Beach persona system: replaces fragile per-beach shoaling_factors JSONB with
-- physics-based archetypes.
--
-- Problem: shoaling_factors only works with CDIP buoy data and disables ML
-- bias-correction (correct_forecasts.py skips any beach with non-NULL
-- shoaling_factors). The persona approach groups beaches into archetypes
-- that share a single deepwater_decay_factor — a scalar representing energy
-- loss (or gain) from the deep-water model grid point to the actual beach.
--
-- Decay factor semantics:
--   0.3–0.4 = heavy sheltering (reefs, headlands blocking swell windows)
--   0.6     = moderate sheltering (point breaks, direction-critical)
--   0.7     = jetty/harbor funneling
--   1.0     = fully exposed (open beach break, default)
--   1.15+   = canyon amplification (submarine canyons focus wave energy)
--
-- This migration only adds the schema and assigns personas. The read-time
-- transform that consumes deepwater_decay_factor is a separate code change.

BEGIN;

-- 1. Create the persona enum (idempotent guard for re-runs)
DO $$ BEGIN
  CREATE TYPE beach_persona AS ENUM (
    'sheltered_reef',
    'exposed_beach_break',
    'canyon_amplified',
    'point_break',
    'jetty_harbor'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE beach_persona IS
  'Archetype classification for beach wave physics. Determines how deep-water '
  'model energy translates to nearshore face height.';

-- 2. Add columns to beaches
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS persona beach_persona;
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS deepwater_decay_factor real DEFAULT 1.0;

COMMENT ON COLUMN beaches.persona IS
  'Physics-based archetype: sheltered_reef, exposed_beach_break, canyon_amplified, '
  'point_break, or jetty_harbor. NULL means unclassified (defaults to exposed_beach_break '
  'behavior at read time).';

COMMENT ON COLUMN beaches.deepwater_decay_factor IS
  'Energy ratio from deep-water model grid to nearshore face height. '
  '0.4 = heavy sheltering, 1.0 = fully exposed (default), 1.15+ = canyon amplification.';

-- 3. Assign personas to key beaches

-- Sheltered reef (decay 0.4) — heavy shadowing from reefs/headlands
UPDATE beaches
SET    persona = 'sheltered_reef',
       deepwater_decay_factor = 0.4
WHERE  name IN (
         'Tourmaline Beach',
         'Tourmaline Surf Park',
         'Crystal Pier',
         'PB Point',
         'Big Jetty'
       );

-- Canyon amplified (decay 1.15) — submarine canyons focus wave energy
UPDATE beaches
SET    persona = 'canyon_amplified',
       deepwater_decay_factor = 1.15
WHERE  name IN (
         'Blacks Beach',
         'Scripps',
         'La Jolla Shores',
         'The Wedge',
         'Rockpile'
       );

-- Exposed beach break (decay 1.0) — model ≈ nearshore, no correction needed
UPDATE beaches
SET    persona = 'exposed_beach_break',
       deepwater_decay_factor = 1.0
WHERE  name IN (
         'Huntington Beach Pier',
         'Manhattan Beach Pier',
         'Mission Beach',
         'Mission Beach (Central)',
         'Imperial Beach',
         'Imperial Beach Pier',
         'Huntington State Beach',
         'El Porto (Manhattan)',
         'Hermosa Pier',
         'Venice Breakwater',
         'Silver Strand State Beach',
         'Hotel Del Coronado',
         'Coronado North Jetty'
       );

-- Point break (decay 0.6) — direction-critical, moderate sheltering
UPDATE beaches
SET    persona = 'point_break',
       deepwater_decay_factor = 0.6
WHERE  name IN (
         'Rincon',
         'Malibu First Point (Surfrider)',
         'Swami''s',
         'Lower Trestles',
         'Upper Trestles',
         'San Onofre State Beach',
         'Topanga',
         'County Line'
       );

-- Jetty/harbor (decay 0.7) — direction funneling from hard structures
UPDATE beaches
SET    persona = 'jetty_harbor',
       deepwater_decay_factor = 0.7
WHERE  name IN (
         'Oceanside Pier',
         'Oceanside Harbor',
         'Newport Lower Jetties',
         'Newport Upper Jetties',
         'River Jetties',
         'Redondo Breakwall',
         'Doheny Beach'
       );

-- 4. Safe default for all other calibrated beaches (have shoaling_factors
--    or cdip_station but no persona assigned above)
UPDATE beaches
SET    persona = 'exposed_beach_break',
       deepwater_decay_factor = 1.0
WHERE  persona IS NULL
  AND  (shoaling_factors IS NOT NULL OR cdip_station IS NOT NULL);

COMMIT;
