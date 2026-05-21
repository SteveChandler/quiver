\set ON_ERROR_STOP on

-- Read-only preflight for the Supabase extension_in_public advisor warnings.
-- Run this before scripts/db/extension-relocation-apply.sql and save the output
-- as the pre snapshot for rollback validation.

SELECT
  e.extname,
  n.nspname AS installed_schema,
  e.extversion,
  e.extrelocatable,
  CASE
    WHEN e.extname = 'postgis' AND e.extrelocatable = false THEN 'support_or_drop_recreate_required'
    WHEN n.nspname = 'public' THEN 'eligible_for_relocation_check_dependencies'
    ELSE 'already_outside_public'
  END AS relocation_status
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname IN ('pg_trgm', 'unaccent', 'postgis')
ORDER BY e.extname;

SELECT
  e.extname,
  split_part(pg_describe_object(d.classid, d.objid, d.objsubid), ' ', 1) AS member_kind,
  count(*) AS member_count
FROM pg_extension e
JOIN pg_depend d ON d.refclassid = 'pg_extension'::regclass
  AND d.refobjid = e.oid
  AND d.deptype = 'e'
WHERE e.extname IN ('pg_trgm', 'unaccent', 'postgis')
GROUP BY e.extname, member_kind
ORDER BY e.extname, member_kind;

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    JOIN pg_extension e ON e.oid = d.refobjid
    WHERE d.classid = 'pg_proc'::regclass
      AND d.objid = p.oid
      AND d.deptype = 'e'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(value)
    WHERE config.value LIKE 'search_path=%'
  )
ORDER BY function_name, arguments;

SELECT DISTINCT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  m.symbol AS matched_extension_symbol
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL regexp_matches(
  lower(pg_get_functiondef(p.oid)),
  '\m(st_[a-z0-9_]+|geometry|geography|unaccent|similarity|word_similarity|show_trgm)\M',
  'g'
) AS m(symbol)
WHERE n.nspname = 'public'
  AND p.prokind IN ('f', 'p')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    JOIN pg_extension e ON e.oid = d.refobjid
    WHERE d.classid = 'pg_proc'::regclass
      AND d.objid = p.oid
      AND d.deptype = 'e'
  )
ORDER BY schema_name, function_name, arguments, matched_extension_symbol;

SELECT
  v.schemaname AS schema_name,
  v.viewname AS relation_name,
  'view' AS relation_type
FROM pg_views v
WHERE v.schemaname = 'public'
  AND lower(v.definition) ~ '\m(st_[a-z0-9_]+|geometry|geography|unaccent|similarity|word_similarity|show_trgm)\M'
UNION ALL
SELECT
  m.schemaname AS schema_name,
  m.matviewname AS relation_name,
  'materialized view' AS relation_type
FROM pg_matviews m
WHERE m.schemaname = 'public'
  AND lower(m.definition) ~ '\m(st_[a-z0-9_]+|geometry|geography|unaccent|similarity|word_similarity|show_trgm)\M'
ORDER BY schema_name, relation_name;
