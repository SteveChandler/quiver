SET ROLE service_role;
DO $$
DECLARE
  first_ids uuid[];
  second_ids uuid[];
  all_ids uuid[];
  reported bigint;
  total_rows integer;
BEGIN
  SELECT array_agg(id), min(total_count) INTO first_ids, reported
  FROM public.get_weekend_scout_candidates_page('10000000-0000-4000-8000-000000000001',32.75,-117.1,1000);
  IF cardinality(first_ids) IS DISTINCT FROM 500 OR reported IS DISTINCT FROM 501 THEN
    RAISE EXCEPTION 'default first page/count mismatch';
  END IF;
  SELECT array_agg(id), min(total_count) INTO second_ids, reported
  FROM public.get_weekend_scout_candidates_page('10000000-0000-4000-8000-000000000001',32.75,-117.1,1000,500,500);
  IF second_ids IS DISTINCT FROM ARRAY['00000000-0000-4000-8000-000000000501'::uuid] OR reported IS DISTINCT FROM 501 THEN
    RAISE EXCEPTION '501st eligible candidate or stable total missing';
  END IF;
  all_ids := first_ids || second_ids;
  IF all_ids IS DISTINCT FROM (SELECT array_agg(('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid ORDER BY i) FROM generate_series(1,501) i) THEN
    RAISE EXCEPTION 'missing, duplicate, out-of-order or ineligible ID';
  END IF;
  SELECT count(*) INTO total_rows FROM public.get_weekend_scout_candidates_page('10000000-0000-4000-8000-000000000001',32.75,-117.1,1000,1000,500);
  IF total_rows <> 0 THEN RAISE EXCEPTION 'terminal page not empty'; END IF;
  SELECT count(*) INTO total_rows FROM public.get_weekend_scout_candidates_page('10000000-0000-4000-8000-000000000001',91,-117.1,1000);
  IF total_rows <> 0 THEN RAISE EXCEPTION 'invalid origin admitted'; END IF;
  IF has_function_privilege('anon','public.get_weekend_scout_candidates_page(uuid,double precision,double precision,integer,integer,integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.get_weekend_scout_candidates_page(uuid,double precision,double precision,integer,integer,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'paging RPC exposed outside service role';
  END IF;
  RAISE NOTICE 'PASS: real RPC 500+1 paging, complete ID set, stable ties/count, eligibility/exclusion filters, terminal page, invalid location and service-role grants';
END;
$$;
