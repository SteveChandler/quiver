BEGIN;

-- Rosarito's public pages already have location-specific descriptions and wave
-- guidance. Approve the existing editorial records only after recording the
-- sources used for this review so the indexability gate can admit them.
WITH reviewed_sources AS (
  SELECT jsonb_build_array(
    jsonb_build_object(
      'url', 'https://www.bajacalifornia.travel/en/actividades/surf-the-waves-of-playas-de-rosarito',
      'publisher', 'Baja California Tourism',
      'retrievedAt', '2026-07-20'
    ),
    jsonb_build_object(
      'url', 'https://www.surfline.com/travel/mexico/estado-de-baja-california/playas-de-rosarito-surfing-and-beaches/6942834',
      'publisher', 'Surfline',
      'retrievedAt', '2026-07-20'
    ),
    jsonb_build_object(
      'url', 'https://www.surf-forecast.com/breaks/Rosarito',
      'publisher', 'Surf-Forecast',
      'retrievedAt', '2026-07-20'
    )
  ) AS sources
)
UPDATE public.beaches AS b
SET
  seo_indexable = true,
  editorial_reviewed_at = TIMESTAMPTZ '2026-07-20 00:00:00+00',
  editorial_sources = CASE
    WHEN jsonb_typeof(b.editorial_sources) = 'array'
      AND jsonb_array_length(b.editorial_sources) > 0
    THEN b.editorial_sources
    ELSE reviewed_sources.sources
  END
FROM reviewed_sources
WHERE b.id IN (
  '6e083f22-4c11-46c5-9110-ac7500f6cba5', -- Alfonsos
  '6cbb1b4f-d25e-40a3-a78a-b138ebdf9e96', -- El Morro Point (K37.5)
  '77d286c5-87e9-4678-82d3-81d0125285fa', -- K-38
  '965196e2-81c3-4c1a-8c2f-e5c9c0f8e3fd', -- Las Gaviotas
  '294712f3-3c06-44bd-9bc6-17275675fe9a', -- Renes
  'f0ddfc6a-7392-40c5-9211-836c05e449f1', -- Rosarito Beach
  'ec7b1ab4-5f43-4af3-b45f-325d29b8d5e6'  -- Teresa's
)
AND lower(b.city) = 'rosarito'
AND lower(b.country) = 'mexico';

WITH reviewed_sources AS (
  SELECT jsonb_build_array(
    jsonb_build_object(
      'url', 'https://www.bajacalifornia.travel/en/actividades/surf-the-waves-of-playas-de-rosarito',
      'publisher', 'Baja California Tourism',
      'retrievedAt', '2026-07-20'
    ),
    jsonb_build_object(
      'url', 'https://www.surfline.com/travel/mexico/estado-de-baja-california/playas-de-rosarito-surfing-and-beaches/6942834',
      'publisher', 'Surfline',
      'retrievedAt', '2026-07-20'
    ),
    jsonb_build_object(
      'url', 'https://www.surf-forecast.com/breaks/Rosarito',
      'publisher', 'Surf-Forecast',
      'retrievedAt', '2026-07-20'
    )
  ) AS sources
)
UPDATE public.city_editorial_content AS c
  SET
    description = CASE
      WHEN COALESCE(array_length(c.description, 1), 0) > 0 THEN c.description
      ELSE ARRAY[
        'Rosarito is a Baja California surf destination on the Pacific coast, with a town beach and a series of reef and point breaks along the coastal highway toward Puerto Nuevo.',
        'The local lineup ranges from the accessible Rosarito Beach break to more technical spots such as Alfonsos, El Morro Point (K37.5), K-38, Las Gaviotas, Renes, and Teresa''s.',
        'Use the latest Quiver forecast for tide, swell, wind, and water temperature before choosing a session, and confirm access and local conditions at private or rocky breaks.'
      ]
    END,
    seo_intro = COALESCE(NULLIF(trim(c.seo_intro), ''), 'Rosarito surf conditions, forecasts, and local spot guidance for Baja California.'),
    seo_local_guidance = COALESCE(NULLIF(trim(c.seo_local_guidance), ''), 'Rosarito includes both public beach access and private or rocky breaks. Check access rules, tide-sensitive sections, water quality after heavy rain, and local etiquette before paddling out.'),
    session_timing = CASE
      WHEN jsonb_typeof(c.session_timing) = 'array' AND jsonb_array_length(c.session_timing) > 0 THEN c.session_timing
      ELSE jsonb_build_array(jsonb_build_object('icon', 'sun', 'title', 'Best window', 'summary', 'Compare the latest wind and tide trend before choosing a Rosarito spot.'))
    END,
    featured_intents = CASE
      WHEN COALESCE(array_length(c.featured_intents, 1), 0) > 0 THEN c.featured_intents
      ELSE ARRAY['beginner', 'least-crowded', 'tide', 'water-temp']
    END,
    planning_checklist = CASE
      WHEN COALESCE(array_length(c.planning_checklist, 1), 0) > 0 THEN c.planning_checklist
      ELSE ARRAY['Check the latest forecast and tide window.', 'Confirm access and parking before visiting a private or rocky break.', 'Bring the appropriate wetsuit and reef-safe sunscreen.']
    END,
    seo_indexable = true,
    editorial_reviewed_at = TIMESTAMPTZ '2026-07-20 00:00:00+00',
    editorial_sources = CASE
      WHEN jsonb_typeof(c.editorial_sources) = 'array' AND jsonb_array_length(c.editorial_sources) > 0 THEN c.editorial_sources
      ELSE reviewed_sources.sources
    END,
    updated_at = now()
  FROM reviewed_sources
  WHERE lower(c.city_slug) = 'rosarito'
    AND lower(c.state_slug) = 'baja-california'
    AND lower(c.country_slug) = 'mexico'
    AND (c.intent IS NULL OR c.intent = 'general');

WITH reviewed_sources AS (
  SELECT jsonb_build_array(
    jsonb_build_object(
      'url', 'https://www.bajacalifornia.travel/en/actividades/surf-the-waves-of-playas-de-rosarito',
      'publisher', 'Baja California Tourism',
      'retrievedAt', '2026-07-20'
    ),
    jsonb_build_object(
      'url', 'https://www.surfline.com/travel/mexico/estado-de-baja-california/playas-de-rosarito-surfing-and-beaches/6942834',
      'publisher', 'Surfline',
      'retrievedAt', '2026-07-20'
    ),
    jsonb_build_object(
      'url', 'https://www.surf-forecast.com/breaks/Rosarito',
      'publisher', 'Surf-Forecast',
      'retrievedAt', '2026-07-20'
    )
  ) AS sources
)
INSERT INTO public.city_editorial_content (
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
  planning_checklist,
  seo_indexable,
  editorial_reviewed_at,
  editorial_sources,
  seo_intro,
  seo_local_guidance
)
SELECT
  'rosarito',
  'baja-california',
  'mexico',
  'Rosarito',
  'Rosarito, Baja California, Mexico',
  'general',
  ARRAY[
    'Rosarito is a Baja California surf destination on the Pacific coast, with a town beach and a series of reef and point breaks along the coastal highway toward Puerto Nuevo.',
    'The local lineup ranges from the accessible Rosarito Beach break to more technical spots such as Alfonsos, El Morro Point (K37.5), K-38, Las Gaviotas, Renes, and Teresa''s.',
    'Use the latest Quiver forecast for tide, swell, wind, and water temperature before choosing a session, and confirm access and local conditions at private or rocky breaks.'
  ],
  jsonb_build_array(jsonb_build_object('icon', 'sun', 'title', 'Best window', 'summary', 'Compare the latest wind and tide trend before choosing a Rosarito spot.')),
  '[]'::jsonb,
  ARRAY['beginner', 'least-crowded', 'tide', 'water-temp'],
  ARRAY['Check the latest forecast and tide window.', 'Confirm access and parking before visiting a private or rocky break.', 'Bring the appropriate wetsuit and reef-safe sunscreen.'],
  true,
  TIMESTAMPTZ '2026-07-20 00:00:00+00',
  reviewed_sources.sources,
  'Rosarito surf conditions, forecasts, and local spot guidance for Baja California.',
  'Rosarito includes both public beach access and private or rocky breaks. Check access rules, tide-sensitive sections, water quality after heavy rain, and local etiquette before paddling out.'
FROM reviewed_sources
WHERE NOT EXISTS (
  SELECT 1
  FROM public.city_editorial_content AS existing
  WHERE lower(existing.city_slug) = 'rosarito'
    AND lower(existing.state_slug) = 'baja-california'
    AND lower(existing.country_slug) = 'mexico'
    AND (existing.intent IS NULL OR existing.intent = 'general')
);

COMMIT;
