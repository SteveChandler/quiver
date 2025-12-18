-- Migration: Update Session log templates link from /app to /features in city_editorial_content
-- Updates both San Diego and Orange County records where the link exists

UPDATE city_editorial_content
SET quick_links = (
  SELECT jsonb_agg(
    CASE
      WHEN link->>'label' = 'Session log templates' THEN
        jsonb_set(link, '{href}', '"/features"')
      ELSE
        link
    END
  )
  FROM jsonb_array_elements(quick_links) AS link
)
WHERE quick_links @> '[{"label": "Session log templates"}]';










