BEGIN;

ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS seo_indexable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS editorial_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS editorial_sources jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.city_editorial_content
  ADD COLUMN IF NOT EXISTS seo_indexable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS editorial_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS editorial_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_intro text,
  ADD COLUMN IF NOT EXISTS seo_local_guidance text;

ALTER TABLE public.city_editorial_content
  DROP CONSTRAINT IF EXISTS city_editorial_content_intent_check;

ALTER TABLE public.city_editorial_content
  ADD CONSTRAINT city_editorial_content_intent_check
  CHECK (intent IS NULL OR intent IN (
    'beginner', 'tide', 'water-temp', 'general', 'least-crowded',
    'longboard', 'dawn-patrol', 'sunset', 'best-time'
  ));

ALTER TABLE public.beaches
  DROP CONSTRAINT IF EXISTS beaches_editorial_sources_array_check;

ALTER TABLE public.beaches
  ADD CONSTRAINT beaches_editorial_sources_array_check
  CHECK (jsonb_typeof(editorial_sources) = 'array');

ALTER TABLE public.city_editorial_content
  DROP CONSTRAINT IF EXISTS city_editorial_content_sources_array_check;

ALTER TABLE public.city_editorial_content
  ADD CONSTRAINT city_editorial_content_sources_array_check
  CHECK (jsonb_typeof(editorial_sources) = 'array');

CREATE INDEX IF NOT EXISTS idx_beaches_seo_indexable
  ON public.beaches (state, city, slug)
  WHERE seo_indexable = true;

CREATE INDEX IF NOT EXISTS idx_city_editorial_content_seo_indexable
  ON public.city_editorial_content (country_slug, state_slug, city_slug, intent)
  WHERE seo_indexable = true;

DROP FUNCTION IF EXISTS public.get_city_editorial(text, text, text);

CREATE FUNCTION public.get_city_editorial(
  p_city text,
  p_state text DEFAULT 'ca',
  p_country text DEFAULT 'usa',
  p_intent text DEFAULT NULL
)
RETURNS public.city_editorial_content
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.city_editorial_content c
  WHERE lower(c.city_slug) = lower(p_city)
    AND lower(c.state_slug) = lower(p_state)
    AND lower(c.country_slug) = lower(p_country)
    AND (
      (p_intent IS NULL AND (c.intent IS NULL OR c.intent = 'general'))
      OR (p_intent IS NOT NULL AND c.intent IS NOT DISTINCT FROM p_intent)
    )
  ORDER BY
    CASE WHEN c.editorial_reviewed_at IS NULL THEN 1 ELSE 0 END,
    c.editorial_reviewed_at DESC NULLS LAST,
    c.updated_at DESC NULLS LAST,
    CASE WHEN c.intent IS NULL THEN 0 ELSE 1 END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_city_editorial(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_city_editorial(text, text, text, text)
  TO anon, authenticated, service_role;

COMMENT ON COLUMN public.beaches.seo_indexable IS
  'Set true only after human review confirms location-specific editorial evidence.';
COMMENT ON COLUMN public.beaches.editorial_sources IS
  'Reviewed source provenance: [{"url","publisher","retrievedAt"}].';
COMMENT ON COLUMN public.city_editorial_content.seo_indexable IS
  'Set true only after human review of the matching city intent content.';

COMMIT;
