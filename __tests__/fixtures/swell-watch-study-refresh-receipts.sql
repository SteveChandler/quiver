-- Reuse the validated receipt builder without changing prior fixtures' synthetic coordinates.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.fixture_study_scopes(text,numeric,numeric,uuid[],numeric,numeric,numeric,numeric)'::regprocedure)
    INTO definition;
  definition:=replace(definition,'public.fixture_study_scopes(','public.fixture_study_catalog_scopes(');
  definition:=replace(definition,
    'CASE WHEN source_point_id::text LIKE ''1111%'' THEN 32.8 ELSE 33.1 END AS latitude',
    '(SELECT lat::numeric FROM public.beaches WHERE id=source_point_id) AS latitude');
  definition:=replace(definition,
    'CASE WHEN source_point_id::text LIKE ''1111%'' THEN -117.3 ELSE -117.6 END AS longitude',
    '(SELECT lon::numeric FROM public.beaches WHERE id=source_point_id) AS longitude');
  IF definition LIKE '%CASE WHEN source_point_id%' THEN RAISE EXCEPTION 'receipt fixture adaptation failed'; END IF;
  EXECUTE definition;
END; $$;
