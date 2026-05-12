BEGIN;

UPDATE public.city_editorial_content
SET quick_links = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'href' = '/spots/lowers-trestles'
        THEN jsonb_set(elem, '{href}', '"/spots/lower-trestles"')
      ELSE elem
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(quick_links) WITH ORDINALITY AS links(elem, ordinality)
)
WHERE city_slug = 'orange-county'
  AND state_slug = 'ca'
  AND quick_links::text LIKE '%/spots/lowers-trestles%';

COMMIT;
