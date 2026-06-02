BEGIN;

WITH target(slug) AS (
  VALUES
    ('salt-creek'),
    ('strands'),
    ('doheny'),
    ('doheny-state-beach'),
    ('poche-beach'),
    ('204s'),
    ('san-clemente-pier-northside'),
    ('t-street'),
    ('riviera'),
    ('san-clemente-state-beach'),
    ('cottons'),
    ('upper-trestles'),
    ('lower-trestles'),
    ('middles'),
    ('church'),
    ('old-mans-sano'),
    ('san-onofre-state-beach'),
    ('trails')
)
UPDATE public.beaches AS b
SET
  features = COALESCE(b.features, ARRAY[]::text[])
    || ARRAY['south_oc_sano_shadow_guardrail']::text[]
FROM target
WHERE b.slug = target.slug
  AND b.deleted_at IS NULL
  AND NOT (
    'south_oc_sano_shadow_guardrail' = ANY(COALESCE(b.features, ARRAY[]::text[]))
  );

COMMIT;
