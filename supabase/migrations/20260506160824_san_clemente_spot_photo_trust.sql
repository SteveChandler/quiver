BEGIN;

UPDATE public.beaches
SET
  city = 'San Clemente',
  region = 'Orange County',
  lat = 33.38013937,
  lon = -117.5798893
WHERE lower(name) = 'church'
  AND deleted_at IS NULL;

UPDATE public.beaches
SET
  city = 'San Clemente',
  region = 'Orange County',
  lat = 33.390733,
  lon = -117.598633
WHERE lower(name) = 'cottons'
  AND deleted_at IS NULL;

INSERT INTO public.beaches (
  name,
  slug,
  city,
  state,
  country,
  region,
  lat,
  lon,
  break_type,
  skill_level,
  timezone
)
SELECT
  'Riviera',
  'riviera',
  'San Clemente',
  'CA',
  'USA',
  'Orange County',
  33.40579414,
  -117.60840654,
  'beach',
  'intermediate',
  'America/Los_Angeles'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.beaches
  WHERE lower(name) = 'riviera'
    AND deleted_at IS NULL
);

INSERT INTO public.roadmap_items (
  title,
  description,
  category,
  status
)
SELECT
  'Replace generated diorama loops with real surf media',
  'Users can read the looping generated dioramas as artificial. Prefer real beach photos, real surf clips, or approved user-submitted media for spot heroes instead of always-looping animated dioramas.',
  'other',
  'under_consideration'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.roadmap_items
  WHERE title = 'Replace generated diorama loops with real surf media'
);

WITH rejected_photo_titles(beach_name, title_pattern) AS (
  VALUES
    ('Bay Street', '^Automobile routes from Los Angeles to neighboring beach cities'),
    ('Church', '^(Lhok Nga Beach|kiter after work)$'),
    ('Del Mar', '(mcallen - isla del padre 2009|Corona Del Mar|Corona del Mar)'),
    ('George''s', '^USS GEORGE H\\.W\\. BUSH'),
    ('Hermosa Beach South', '(Automobile road map|Automobile routes|Braley Building)'),
    ('Long Branch Beach', '^(Lofting Timmy|Washington DC Cherry Blossoms|Controlling IT Costs)'),
    ('Lower Trestles', '^USA Surfing Competition, Pismo Beach California$'),
    ('Middles', '(Foggy Fame|Ophiomorpha|Hexagonaria|swimming hole|Berkeley and the Golden Gate)'),
    ('Mission Beach', 'San Luis water Reservoir'),
    ('Pipes', '^Horseneck Beach$'),
    ('San Clemente State Beach', '^Orange County$'),
    ('Satellite Beach', '^(California-06413|Mugabe swaps|Ballooning in the constant sun)'),
    ('Scripps', '^120630-N-PO203-498$'),
    ('Sebastian Inlet', '^Agama picticauda'),
    ('South Padre Island – Isla Blanca Park', 'cargo ship'),
    ('Strands', '(Naples|Border-USA-Mexico|Manhattan Beach|Algiers Beach)'),
    ('The Rock, Oceanside', '^Great Lives, Great Deeds'),
    ('The Wedge', '^Basaltic marine beach sand'),
    ('Topanga', '^Barnacles and sand$'),
    ('Trails', '(Indian Beach Native|Winding Winter Road - Gettysburg|Coney Island|Reservoir)'),
    ('Venice Beach', '^Venice Muscle Beach$'),
    ('Westport Beach', '^(Horseneck Beach|Compo beach)'),
    ('Wrightsville Beach', '^Physeter macrocephalus')
)
UPDATE public.beach_photos AS bp
SET approved = false
FROM public.beaches AS b,
     rejected_photo_titles AS rejected
WHERE bp.beach_id = b.id
  AND b.name = rejected.beach_name
  AND bp.approved = true
  AND bp.deleted_at IS NULL
  AND bp.title ~* rejected.title_pattern;

COMMIT;
