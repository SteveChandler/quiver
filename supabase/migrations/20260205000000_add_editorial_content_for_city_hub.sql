-- Migration: Add editorial content for city hub feature
-- This migration extends city_editorial_content with an intent column and creates
-- beach_editorial_content for per-beach AI-generated editorial notes.
--
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, execute the following SQL:
--
-- DROP TABLE IF EXISTS beach_editorial_content CASCADE;
-- ALTER TABLE city_editorial_content DROP CONSTRAINT IF EXISTS city_editorial_content_intent_unique;
-- ALTER TABLE city_editorial_content DROP COLUMN IF EXISTS intent;
-- DROP INDEX IF EXISTS idx_city_editorial_intent;
--
-- WARNING: Rolling back will delete all beach_editorial_content data and remove
-- the intent column from city_editorial_content (existing intent-specific rows will be lost).

-- ================================================
-- PART 1: Extend city_editorial_content with intent
-- ================================================

-- Add intent column (nullable for backwards compatibility with existing general editorial)
ALTER TABLE city_editorial_content
ADD COLUMN IF NOT EXISTS intent TEXT;

-- Add check constraint for valid intent values
ALTER TABLE city_editorial_content
ADD CONSTRAINT city_editorial_content_intent_check
CHECK (intent IS NULL OR intent IN ('beginner', 'tide', 'water-temp', 'general', 'least-crowded'));

-- Update the unique constraint to include intent
-- Drop the old constraint first
ALTER TABLE city_editorial_content
DROP CONSTRAINT IF EXISTS city_editorial_content_city_slug_state_slug_country_slug_key;

-- Add new unique constraint that includes intent
ALTER TABLE city_editorial_content
ADD CONSTRAINT city_editorial_content_intent_unique
UNIQUE (city_slug, state_slug, country_slug, intent);

-- Create index for intent-based lookups
CREATE INDEX IF NOT EXISTS idx_city_editorial_intent
ON city_editorial_content(city_slug, state_slug, country_slug, intent)
WHERE intent IS NOT NULL;

-- Add comment to explain intent column usage
COMMENT ON COLUMN city_editorial_content.intent IS
'The intent/purpose of this editorial content. NULL or "general" for general city editorial,
"beginner" for beginner-specific content, "tide" for tide-focused content,
"water-temp" for water temperature content, "least-crowded" for crowd-focused content.
This allows storing multiple editorial variations for the same city, each targeting a different user intent.';

-- ================================================
-- PART 2: Create beach_editorial_content table
-- ================================================

CREATE TABLE IF NOT EXISTS beach_editorial_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to beaches table
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,

  -- Type of editorial content
  content_type TEXT NOT NULL CHECK (
    content_type IN ('beginner_notes', 'tide_notes', 'safety_notes', 'advanced_notes', 'crowd_notes')
  ),

  -- Structured JSONB content
  -- Example structure:
  -- {
  --   "why_beginners_love_it": ["Gentle rolling waves", "Sand bottom", "Lifeguards year-round"],
  --   "logistics": {
  --     "parking": "Large lot with $15 fee",
  --     "walk_distance": "0.2 mi",
  --     "lifeguards": true,
  --     "best_hours": "7am-11am"
  --   },
  --   "description": "La Jolla Shores offers the most beginner-friendly conditions...",
  --   "what_to_expect": {
  --     "wave_size": "1-3 ft typically",
  --     "wave_type": "Soft, rolling",
  --     "bottom": "Sand",
  --     "hazards": ["Occasional stingrays", "Seals present"]
  --   }
  -- }
  content JSONB NOT NULL,

  -- When this content was generated (for cache/freshness tracking)
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Track updates separately
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure unique content_type per beach
  UNIQUE(beach_id, content_type)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_beach_editorial_beach_id
ON beach_editorial_content(beach_id);

CREATE INDEX IF NOT EXISTS idx_beach_editorial_content_type
ON beach_editorial_content(content_type);

CREATE INDEX IF NOT EXISTS idx_beach_editorial_beach_type
ON beach_editorial_content(beach_id, content_type);

-- Enable Row Level Security
ALTER TABLE beach_editorial_content ENABLE ROW LEVEL SECURITY;

-- Public read access (editorial content is public-facing)
CREATE POLICY "beach_editorial_content_public_read"
  ON beach_editorial_content
  FOR SELECT
  USING (true);

-- Only service_role and admins can write
CREATE POLICY "beach_editorial_content_admin_write"
  ON beach_editorial_content
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users
      WHERE raw_app_meta_data->>'is_admin' = 'true'
    )
  );

-- Create updated_at trigger for beach_editorial_content
CREATE OR REPLACE FUNCTION update_beach_editorial_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER beach_editorial_content_updated_at
  BEFORE UPDATE ON beach_editorial_content
  FOR EACH ROW
  EXECUTE FUNCTION update_beach_editorial_updated_at();

-- Add table and column comments for documentation
COMMENT ON TABLE beach_editorial_content IS
'Stores AI-generated editorial content for individual beaches, targeting specific user intents.
Used for beginner notes, tide guidance, safety warnings, and other content types that enhance
the user experience on beach detail pages. Content is stored as JSONB for flexibility.';

COMMENT ON COLUMN beach_editorial_content.content_type IS
'Type of editorial content: beginner_notes, tide_notes, safety_notes, advanced_notes, crowd_notes';

COMMENT ON COLUMN beach_editorial_content.content IS
'Structured JSONB content with flexible schema. Common fields include:
- why_beginners_love_it: array of bullet points
- logistics: object with parking, walk_distance, lifeguards, best_hours
- description: string paragraph
- what_to_expect: object with wave_size, wave_type, bottom, hazards';

-- ================================================
-- PART 3: Seed San Diego beginner editorial content
-- ================================================

-- Insert beginner-specific editorial for San Diego into city_editorial_content
INSERT INTO city_editorial_content (
  city_slug,
  state_slug,
  country_slug,
  city_name,
  region_label,
  intent,
  description,
  session_timing,
  quick_links,
  featured_intents,
  planning_checklist
) VALUES (
  'san-diego',
  'ca',
  'usa',
  'San Diego',
  'San Diego County, California',
  'beginner',
  ARRAY[
    'San Diego is consistently ranked as one of the best places in the world to learn surfing. With 70 miles of coastline, warm water year-round (ranging from 55°F in winter to 70°F in summer), and a variety of gentle beach breaks perfect for beginners, it''s the ideal training ground.',
    'The city offers multiple beginner-friendly zones: La Jolla Shores provides the most forgiving waves with a sandy bottom and lifeguard presence. Pacific Beach and Mission Beach offer mellow conditions with surf schools lining the boardwalk. Coronado''s Silver Strand is perfect for ultra-beginners wanting the gentlest possible introduction.',
    'What makes San Diego special for learners is the consistency. Unlike other surf destinations that require precise timing, San Diego has rideable waves almost every day. Summer brings small, clean south swells perfect for first-timers. Winter sees slightly larger northwest swells, but the protected coves still offer manageable conditions.',
    'The local surf community is welcoming to beginners. Multiple surf schools operate year-round, rental shops are everywhere, and the lineups at beginner breaks are generally friendly. Morning sessions (7-10am) offer the cleanest conditions before the afternoon sea breeze kicks in.'
  ],
  '[
    {
      "icon": "sun",
      "title": "Today",
      "summary": "Check the marine layer forecast. Most beginner spots are best from dawn until mid-morning when the layer burns off and before afternoon winds. Use Quiver''s crowd meter to avoid peak surf school hours (typically 9am-12pm)."
    },
    {
      "icon": "clock",
      "title": "Right Now",
      "summary": "Watch for tide transitions at beach breaks. La Jolla Shores and Pacific Beach work on almost any tide, but lower tides expose sandbars that create gentler shoulders. Check wind direction—offshore or calm is ideal for learning."
    },
    {
      "icon": "calendar",
      "title": "This Weekend",
      "summary": "Plan for earlier sessions on weekends to avoid crowds. If the main beginner spots are packed (La Jolla Shores, Pacific Beach), try Coronado or the north end of Mission Beach. Summer weekends bring small, clean surf ideal for progression."
    }
  ]'::jsonb,
  '[
    {"label": "Beginner spot map", "href": "/map?city=san-diego&intent=beginner"},
    {"label": "Surf lessons near you", "href": "/beginner/san-diego#lessons"},
    {"label": "Equipment rentals", "href": "/beginner/san-diego#gear"},
    {"label": "Safety & etiquette guide", "href": "/beginner/san-diego#safety"}
  ]'::jsonb,
  ARRAY['beginner'],
  ARRAY[
    'Start with a soft-top foam board (8-9 feet for adults) for maximum float and safety.',
    'Apply waterproof sunscreen 30 minutes before entering the water—San Diego sun is intense.',
    'Do the stingray shuffle when entering shallow water (slide feet rather than stepping).',
    'Watch experienced surfers for 10 minutes to understand wave patterns and lineup etiquette.',
    'Log your first sessions in Quiver to track progression and remember what worked.'
  ]
)
ON CONFLICT (city_slug, state_slug, country_slug, intent)
DO UPDATE SET
  description = EXCLUDED.description,
  session_timing = EXCLUDED.session_timing,
  quick_links = EXCLUDED.quick_links,
  featured_intents = EXCLUDED.featured_intents,
  planning_checklist = EXCLUDED.planning_checklist,
  updated_at = now();

-- ================================================
-- PART 4: Seed beginner beach editorial content for San Diego beaches
-- ================================================

-- First, we need to look up the actual beach IDs for San Diego beginner beaches.
-- We'll insert based on beach name matching, using a subquery to get the beach_id.

-- La Jolla Shores
INSERT INTO beach_editorial_content (
  beach_id,
  content_type,
  content
)
SELECT
  id,
  'beginner_notes',
  jsonb_build_object(
    'why_beginners_love_it', jsonb_build_array(
      'Gentle, rolling waves perfect for learning',
      'Wide sandy beach with plenty of space',
      'Lifeguards on duty year-round',
      'Protected from harsh swells by offshore canyon',
      'Sandy bottom—no rocks or reef',
      'Multiple surf schools operate here daily',
      'Warm water in summer (68-72°F)'
    ),
    'logistics', jsonb_build_object(
      'parking', 'Large paid lot ($3/hour, $15/day). Fills by 10am on weekends.',
      'walk_distance', '50 yards from lot to water',
      'lifeguards', true,
      'best_hours', '7am-10am for smallest crowds and best conditions',
      'facilities', 'Restrooms, outdoor showers, nearby cafes'
    ),
    'description', 'La Jolla Shores is widely considered the best beginner beach in San Diego. The waves here are consistently gentle thanks to the offshore La Jolla Canyon, which filters out larger swells. The beach faces southwest, providing protection from northwest winter storms while still catching summer south swells. The sandy bottom extends far offshore, eliminating hazards and providing a forgiving learning environment. With lifeguards present year-round and numerous surf schools operating daily, it''s the safest place to start your surfing journey.',
    'what_to_expect', jsonb_build_object(
      'wave_size', '1-3 ft typically (waist to chest high)',
      'wave_type', 'Soft, crumbly beach break with long ride potential',
      'bottom', 'Pure sand',
      'hazards', jsonb_build_array('Occasional stingrays (shuffle your feet)', 'Seals and sea lions (give them space)', 'Moderate crowds during summer'),
      'water_temp', '57°F in winter, 68-72°F in summer',
      'skill_level', 'Perfect for absolute beginners and progressing intermediates'
    ),
    'seasonal_guide', jsonb_build_object(
      'summer', 'Small, clean south swells. Warmest water. Most crowded but most forgiving conditions.',
      'fall', 'Transition period with variable swells. Still warm water. Fewer crowds.',
      'winter', 'Slightly larger northwest swells, but the cove stays protected. Wetsuit required (4/3mm).',
      'spring', 'Smallest waves of the year. Ideal for first-timers. Water starting to warm up.'
    )
  )
FROM beaches
WHERE LOWER(name) LIKE '%la jolla shores%'
  OR (LOWER(name) LIKE '%shores%' AND LOWER(city) LIKE '%la jolla%')
LIMIT 1
ON CONFLICT (beach_id, content_type) DO UPDATE
SET content = EXCLUDED.content, updated_at = now();

-- Tourmaline Surf Park
INSERT INTO beach_editorial_content (
  beach_id,
  content_type,
  content
)
SELECT
  id,
  'beginner_notes',
  jsonb_build_object(
    'why_beginners_love_it', jsonb_build_array(
      'Designated longboard and beginner zone',
      'Mellow, playful waves ideal for learning',
      'Strong local surf community that welcomes newcomers',
      'Sandy beach with gradual slope',
      'Less crowded than La Jolla Shores',
      'Easy parking with multiple lots',
      'Year-round consistent conditions'
    ),
    'logistics', jsonb_build_object(
      'parking', 'Free street parking and paid lots. Generally easier than La Jolla Shores.',
      'walk_distance', '100-200 yards depending on parking spot',
      'lifeguards', true,
      'best_hours', '6:30am-9am for glassy conditions and smaller crowds',
      'facilities', 'Restrooms, outdoor showers, grassy picnic area'
    ),
    'description', 'Tourmaline Surf Park is a legendary spot for longboarders and beginners in San Diego. The wave quality is more forgiving than high-performance breaks, making it perfect for learning and progressing. The local community is known for being welcoming to beginners who follow proper surf etiquette. The waves here rarely get too large, and the sandy bottom provides a safe environment. It''s also one of the few beaches in San Diego where longboards are encouraged—in fact, it''s primarily a longboard and beginner wave.',
    'what_to_expect', jsonb_build_object(
      'wave_size', '2-4 ft typically (waist to shoulder high)',
      'wave_type', 'Slow, rolling waves with long walls—perfect for learning turns',
      'bottom', 'Sand with occasional kelp',
      'hazards', jsonb_build_array('Stingrays in shallow water', 'Kelp during certain seasons', 'Can get crowded with longboarders on good days'),
      'water_temp', '57-60°F in winter, 66-70°F in summer',
      'skill_level', 'Great for beginners ready to progress beyond whitewater'
    ),
    'seasonal_guide', jsonb_build_object(
      'summer', 'Small, fun south swells. Peak beginner season with warmest water.',
      'fall', 'Larger northwest swells arrive but waves stay manageable. Less crowded.',
      'winter', 'Best swell consistency. Requires 3/2mm or 4/3mm wetsuit.',
      'spring', 'Smaller, mellower conditions return. Good for building confidence.'
    )
  )
FROM beaches
WHERE LOWER(name) LIKE '%tourmaline%'
LIMIT 1
ON CONFLICT (beach_id, content_type) DO UPDATE
SET content = EXCLUDED.content, updated_at = now();

-- Pacific Beach
INSERT INTO beach_editorial_content (
  beach_id,
  content_type,
  content
)
SELECT
  id,
  'beginner_notes',
  jsonb_build_object(
    'why_beginners_love_it', jsonb_build_array(
      'Multiple surf schools and rental shops right on the beach',
      'Long stretch of beach with various peaks to choose from',
      'Vibrant beach community with restaurants and cafes nearby',
      'Sandy bottom throughout',
      'Consistent small waves in summer',
      'Easy access to amenities and post-surf food',
      'Great for first-timers with instructor support available'
    ),
    'logistics', jsonb_build_object(
      'parking', 'Metered street parking ($2.50/hour) and paid lots. Challenging on weekends.',
      'walk_distance', 'Varies—can be 50 yards to 1/4 mile from parking',
      'lifeguards', true,
      'best_hours', '7am-9am before crowds and wind. Avoid 10am-2pm on weekends.',
      'facilities', 'Full amenities—restrooms, showers, boardwalk, restaurants'
    ),
    'description', 'Pacific Beach (often called PB) is the most accessible beginner spot in San Diego, with a bustling beach culture and numerous resources for new surfers. The beachbreak creates multiple peaks, so you can usually find a less crowded spot even on busy days. The waves here are forgiving in summer but can get hollow and powerful in winter, so it''s best for beginners during the warmer months. The proximity to surf shops, rentals, and instructors makes it easy to get gear and lessons. The vibrant atmosphere also makes it a fun social experience—many beginners meet fellow learners here.',
    'what_to_expect', jsonb_build_object(
      'wave_size', '1-3 ft in summer, 3-6 ft in winter',
      'wave_type', 'Beach break with shifting peaks. Soft in summer, hollow in winter.',
      'bottom', 'Sand',
      'hazards', jsonb_build_array('Crowded on weekends and summer', 'Stingrays in shallow areas', 'Can get powerful during winter swells', 'Shore break on larger days'),
      'water_temp', '58-60°F in winter, 68-72°F in summer',
      'skill_level', 'Best for beginners in summer (June-September). Intermediates year-round.'
    ),
    'seasonal_guide', jsonb_build_object(
      'summer', 'Ideal beginner conditions. Small, gentle waves. Warmest water. Very crowded.',
      'fall', 'Larger waves arrive. Better for progressing beginners and intermediates.',
      'winter', 'Can get powerful and hollow. Not recommended for true beginners.',
      'spring', 'Transitional conditions. Still manageable for improving beginners.'
    )
  )
FROM beaches
WHERE LOWER(name) LIKE '%pacific beach%'
  AND LOWER(name) NOT LIKE '%north%'
  AND LOWER(name) NOT LIKE '%south%'
LIMIT 1
ON CONFLICT (beach_id, content_type) DO UPDATE
SET content = EXCLUDED.content, updated_at = now();

-- Mission Beach
INSERT INTO beach_editorial_content (
  beach_id,
  content_type,
  content
)
SELECT
  id,
  'beginner_notes',
  jsonb_build_object(
    'why_beginners_love_it', jsonb_build_array(
      'Gentle waves protected by offshore topography',
      'Wide sandy beach with plenty of space',
      'Famous boardwalk for post-surf relaxation',
      'Lifeguards stationed throughout',
      'Sandy bottom with no hazards',
      'Family-friendly atmosphere',
      'Multiple surf rental shops within walking distance'
    ),
    'logistics', jsonb_build_object(
      'parking', 'Metered street parking and paid lots. Can fill up by 10am on sunny days.',
      'walk_distance', '100-300 yards depending on parking availability',
      'lifeguards', true,
      'best_hours', '7am-10am for best conditions before afternoon sea breeze',
      'facilities', 'Restrooms, showers, boardwalk, Belmont Park amusement area nearby'
    ),
    'description', 'Mission Beach is one of San Diego''s most iconic beaches, offering a quintessential Southern California surf experience. The waves here are generally smaller and softer than neighboring Pacific Beach, making it excellent for absolute beginners. The beach is protected from large swells, so conditions remain manageable even during bigger winter storms. The surrounding area is full of surf culture—from rental shops to casual eateries—making it easy to spend an entire day here. The famous Mission Beach boardwalk provides a scenic backdrop and post-surf entertainment.',
    'what_to_expect', jsonb_build_object(
      'wave_size', '1-3 ft typically (knee to waist high for beginners)',
      'wave_type', 'Slow, rolling beach break waves. Very forgiving.',
      'bottom', 'Consistent sand',
      'hazards', jsonb_build_array('Weekend crowds', 'Stingrays (shuffle your feet)', 'Occasional strong currents during high tide'),
      'water_temp', '58-61°F in winter, 68-73°F in summer',
      'skill_level', 'Perfect for first-time surfers and early progressors'
    ),
    'seasonal_guide', jsonb_build_object(
      'summer', 'Prime beginner season. Small, soft waves. Warm water. Peak crowds but worth it.',
      'fall', 'Slightly larger swells. Still very manageable. Fewer tourists.',
      'winter', 'Smallest of the winter breaks. Wetsuit required but waves stay friendly.',
      'spring', 'Variable conditions. Good learning environment as water warms up.'
    )
  )
FROM beaches
WHERE LOWER(name) LIKE '%mission beach%'
  AND LOWER(name) NOT LIKE '%north%'
  AND LOWER(name) NOT LIKE '%south%'
LIMIT 1
ON CONFLICT (beach_id, content_type) DO UPDATE
SET content = EXCLUDED.content, updated_at = now();

-- Ocean Beach (noting it can be more advanced, but has beginner sections)
INSERT INTO beach_editorial_content (
  beach_id,
  content_type,
  content
)
SELECT
  id,
  'beginner_notes',
  jsonb_build_object(
    'why_beginners_love_it', jsonb_build_array(
      'North end (Dog Beach area) has mellower waves for learners',
      'Strong local surf culture and community vibe',
      'Beautiful, less commercialized beach setting',
      'Good for beginners who want to progress to intermediate',
      'Less crowded than Pacific Beach and Mission Beach',
      'Authentic surf town atmosphere',
      'Variety of peaks to choose from'
    ),
    'logistics', jsonb_build_object(
      'parking', 'Free street parking and paid lots. Usually easier than PB/Mission Beach.',
      'walk_distance', '100-400 yards depending on which peak you target',
      'lifeguards', true,
      'best_hours', '6:30am-9am for cleanest conditions. Afternoon winds are common.',
      'facilities', 'Restrooms, showers, pier area, restaurants in OB neighborhood'
    ),
    'description', 'Ocean Beach (OB) is known for its authentic surf culture and powerful waves, but the north end near Dog Beach offers beginner-friendly sections. While the main pier area and south end can be intense, beginners should stick to the northern sections where waves are smaller and less hollow. OB is ideal for beginners ready to challenge themselves and progress toward intermediate surfing. The local community is passionate about surfing, so understanding and respecting surf etiquette is especially important here. Consider taking a lesson or going with someone experienced for your first few sessions.',
    'what_to_expect', jsonb_build_object(
      'wave_size', '2-4 ft typical at north end, larger near pier',
      'wave_type', 'Beach break. Can be powerful and hollow, especially near pier.',
      'bottom', 'Sand',
      'hazards', jsonb_build_array('Stronger currents than other beginner beaches', 'Pier pilings (stay clear)', 'Can get powerful quickly', 'Local crowds near the pier', 'Rip currents during larger swells'),
      'water_temp', '56-59°F in winter, 65-68°F in summer',
      'skill_level', 'Best for progressing beginners (after mastering basics elsewhere)'
    ),
    'seasonal_guide', jsonb_build_object(
      'summer', 'Smallest and most beginner-friendly conditions. North end is safest.',
      'fall', 'Swells increase. Stick to north end and smaller days.',
      'winter', 'Most powerful season. Not recommended for beginners unless waves are small.',
      'spring', 'Variable conditions. Check reports before paddling out.'
    ),
    'important_note', 'Ocean Beach can be deceptively powerful. If you''re an absolute beginner, start at La Jolla Shores or Mission Beach first. Come to OB once you''re comfortable paddling, catching waves, and understanding currents. Always check conditions and consider the north end (Dog Beach area) for the mellower waves.'
  )
FROM beaches
WHERE LOWER(name) LIKE '%ocean beach%'
  AND LOWER(city) LIKE '%san diego%'
LIMIT 1
ON CONFLICT (beach_id, content_type) DO UPDATE
SET content = EXCLUDED.content, updated_at = now();

-- Add comment for future reference
COMMENT ON COLUMN city_editorial_content.intent IS
'The intent/purpose of this editorial content. Values: NULL/"general" for general city editorial,
"beginner" for beginner-specific content, "tide" for tide-focused content,
"water-temp" for water temperature content, "least-crowded" for crowd-focused content.
This allows storing multiple editorial variations for the same city targeting different user intents.';

COMMENT ON CONSTRAINT city_editorial_content_intent_unique ON city_editorial_content IS
'Ensures only one editorial content row per city+intent combination.
NULL intent values are treated as distinct, allowing one general editorial per city.';

-- Grant permissions (match existing pattern)
GRANT SELECT ON beach_editorial_content TO anon, authenticated;
GRANT ALL ON beach_editorial_content TO service_role;
