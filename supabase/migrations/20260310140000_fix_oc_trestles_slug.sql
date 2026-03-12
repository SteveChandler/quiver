-- Fix stored /spots/lowers-trestles link → /spots/lower-trestles (canonical slug)
-- The plural "lowers" variant was set in 20260120105635 and 20251204030000.
-- Middleware handles the redirect, but stored data should use the canonical slug.

BEGIN;

UPDATE city_editorial_content
SET quick_links = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'href' = '/spots/lowers-trestles'
      THEN jsonb_set(elem, '{href}', '"/spots/lower-trestles"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(quick_links) AS elem
)
WHERE city_slug = 'orange-county'
  AND state_slug = 'ca'
  AND quick_links::text LIKE '%lowers-trestles%';

COMMIT;
