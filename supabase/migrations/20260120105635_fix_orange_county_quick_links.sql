-- Fix Orange County quick_links to use state-level intent URLs
-- The intent page system doesn't support county-level slugs (orange-county)
-- so we redirect to state-level pages (ca) which are valid

UPDATE city_editorial_content
SET quick_links = '[
  {"label": "Orange County surf camera list", "href": "/map?city=orange-county"},
  {"label": "Weekend crowd forecast", "href": "/least-crowded/ca"},
  {"label": "Warm-water breaks", "href": "/water-temp/ca"},
  {"label": "Plan a Trestles strike mission", "href": "/spots/lowers-trestles"}
]'::jsonb
WHERE city_slug = 'orange-county' AND state_slug = 'ca';
