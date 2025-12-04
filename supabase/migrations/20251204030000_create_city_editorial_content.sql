-- Migration: Create city_editorial_content table for editorial content on city pages
-- This table stores curated editorial content (session timing, guides, checklists)
-- for city landing pages. The content is separate from dynamic beach data.

-- Create the table
CREATE TABLE IF NOT EXISTS city_editorial_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Location identifiers (match the /beaches/[country]/[state]/[city] route)
  city_slug TEXT NOT NULL,
  state_slug TEXT NOT NULL DEFAULT 'ca',
  country_slug TEXT NOT NULL DEFAULT 'usa',

  -- Display info
  city_name TEXT NOT NULL,
  region_label TEXT NOT NULL,  -- e.g., "San Diego County, California"

  -- About section content (collapsible accordion)
  -- Array of paragraphs to display in the "About {City} Surf" section
  description TEXT[] NOT NULL DEFAULT '{}',

  -- Session timing modules (Today, Now, Weekend tactical advice)
  -- JSONB structure: { today: { title, summary, icon }, now: {...}, weekend: {...} }
  session_timing JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Quick action navigation links
  -- JSONB array: [{ label, href, icon }]
  quick_links JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Featured intent slugs for "Guides by Intent" section
  -- Array of intent slugs: ["beginner", "least-crowded", "tide", "water-temp"]
  -- The intent definitions (heading, intro, etc.) come from code constants
  featured_intents TEXT[] NOT NULL DEFAULT '{}',

  -- Planning checklist items
  planning_checklist TEXT[] NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure unique city per location
  UNIQUE(city_slug, state_slug, country_slug)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_city_editorial_city_slug
  ON city_editorial_content(city_slug);
CREATE INDEX IF NOT EXISTS idx_city_editorial_location
  ON city_editorial_content(city_slug, state_slug, country_slug);

-- Enable Row Level Security
ALTER TABLE city_editorial_content ENABLE ROW LEVEL SECURITY;

-- Public read access (editorial content is public)
CREATE POLICY "city_editorial_content_public_read"
  ON city_editorial_content
  FOR SELECT
  USING (true);

-- Only admins can modify (via service role)
CREATE POLICY "city_editorial_content_admin_write"
  ON city_editorial_content
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users
      WHERE raw_app_meta_data->>'is_admin' = 'true'
    )
  );

-- Create function to fetch editorial content for a city
CREATE OR REPLACE FUNCTION get_city_editorial(
  p_city TEXT,
  p_state TEXT DEFAULT 'ca',
  p_country TEXT DEFAULT 'usa'
)
RETURNS city_editorial_content
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM city_editorial_content
  WHERE city_slug = p_city
    AND state_slug = p_state
    AND country_slug = p_country
  LIMIT 1;
$$;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_city_editorial_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER city_editorial_content_updated_at
  BEFORE UPDATE ON city_editorial_content
  FOR EACH ROW
  EXECUTE FUNCTION update_city_editorial_updated_at();

-- Seed San Diego editorial content
INSERT INTO city_editorial_content (
  city_slug,
  state_slug,
  country_slug,
  city_name,
  region_label,
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
  ARRAY[
    'San Diego surf culture is a rhythm of dawn patrols, parking lot burritos, and checking canyon buoys more often than work email. North County reefs translate long-period northwest lines into running walls, while Mission Bay sandbars stay approachable for crews still dialing their pop-up.',
    'Seasonality matters. Autumn brings glassy peaks with combo swells, winter lights up submarine canyons like Blacks, and spring favors wind-sensitive windows with south pulses. Summer stays playful along La Jolla Shores and the Coronado sandbars with warm water and forgiving tides.',
    'Whether you''re logging sessions for bragging rights or tracking progression in the Quiver journal, San Diego gives you enough spot diversity to chase goals year-round. The key is pairing the right tide with the right bank and having a backup when the lot is full.'
  ],
  '[
    {"icon": "sun", "title": "Today", "summary": "Track marine layer burn-off and watch the tide flip around mid-morning. Use the crowd meter in Quiver to find gaps between surf school lessons."},
    {"icon": "clock", "title": "Now", "summary": "Check live wind before you paddle. Kelp-protected reefs hold shape longer, while open beachbreaks favor lighter boards once the breeze arrives."},
    {"icon": "calendar", "title": "Weekend", "summary": "Pair the rising morning tides with combo swells for longer rides. If the main peak is slammed, drive five minutes to the alternates listed above."}
  ]'::jsonb,
  '[
    {"label": "San Diego surf map", "href": "/map?city=san-diego"},
    {"label": "Today''s tide chart", "href": "/tide/san-diego"},
    {"label": "Beginner-friendly breaks", "href": "/beginner/san-diego"},
    {"label": "Session log templates", "href": "/features"}
  ]'::jsonb,
  ARRAY['beginner', 'least-crowded', 'tide', 'water-temp'],
  ARRAY[
    'Refresh buoy readings before dawn to confirm swell angle.',
    'Screenshot tide windows and share with your crew inside Quiver chat.',
    'Log the session afterward to tag crowd levels, wave quality, and board choice.'
  ]
);

-- Seed Orange County editorial content
INSERT INTO city_editorial_content (
  city_slug,
  state_slug,
  country_slug,
  city_name,
  region_label,
  description,
  session_timing,
  quick_links,
  featured_intents,
  planning_checklist
) VALUES (
  'orange-county',
  'ca',
  'usa',
  'Orange County',
  'Orange County, California',
  ARRAY[
    'Orange County''s surf scene revolves around tides and traffic. Dawn patrol still wins, but late-morning Santa Ana winds can polish shoulders midweek. South swells wake up the points while combo windswell keeps beachies rippable even when long-period energy fades.',
    'San Clemente is the training ground for pros for a reason. Consistent energy, organized lineups, and cobblestone reefs reward rail-to-rail surfing. Newport and Huntington bring punchy sandbars with localism focused near the pier peaks, leaving outer sandbars approachable.',
    'Families, longboard crews, and beginners flock to Doheny and Old Man''s for predictable rollers that stay fun through higher tides. When the pack stacks up, shifting north to Bolsa or Seal Beach can save the session with less competitive peaks.'
  ],
  '[
    {"icon": "sun", "title": "Today", "summary": "Check for Santa Ana wind patterns that groom morning faces. The cobblestone points light up with any south component in the swell."},
    {"icon": "clock", "title": "Now", "summary": "Watch for tide transitions at the points. Trestles and San Onofre favor mid-tide windows when the reef is covered but the wave still has push."},
    {"icon": "calendar", "title": "Weekend", "summary": "Arrive before the gates open at San Onofre. If Trestles is maxed, pivot to Churches or Old Man''s for similar quality with fewer surfers."}
  ]'::jsonb,
  '[
    {"label": "Orange County surf camera list", "href": "/map?city=orange-county"},
    {"label": "Weekend crowd forecast", "href": "/least-crowded/orange-county"},
    {"label": "Warm-water breaks", "href": "/water-temp/orange-county"},
    {"label": "Plan a Trestles strike mission", "href": "/spots/lowers-trestles"}
  ]'::jsonb,
  ARRAY['beginner', 'least-crowded', 'tide', 'water-temp'],
  ARRAY[
    'Check gate opening times for state beach access.',
    'Pack water and snacks—the Trestles walk is 15+ minutes each way.',
    'Log your session to track which tides work best at each cobblestone reef.'
  ]
);

-- Add comment for documentation
COMMENT ON TABLE city_editorial_content IS
'Stores curated editorial content for city landing pages including session timing modules,
quick action links, about section paragraphs, and planning checklists.
This content is shown on /beaches/[country]/[state]/[city] pages when available.
To add editorial content for a new city, insert a row into this table.';
