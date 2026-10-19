-- Disposable databases only: replay reviewed authority windows even after they expire.
CREATE TABLE public.native_sampling_test_clock(instant timestamptz NOT NULL);
INSERT INTO public.native_sampling_test_clock VALUES ('2026-10-04T14:00:00Z');
CREATE FUNCTION public.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog AS 'SELECT instant FROM public.native_sampling_test_clock';
CREATE FUNCTION public.now() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS 'SELECT instant FROM public.native_sampling_test_clock';
CREATE FUNCTION public.transaction_timestamp() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS 'SELECT instant FROM public.native_sampling_test_clock';
CREATE FUNCTION public.statement_timestamp() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS 'SELECT instant FROM public.native_sampling_test_clock';
DO $$ DECLARE f regprocedure; field record; expression text; BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path=public,extensions,pg_catalog,pg_temp',current_database());
  FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname NOT IN ('clock_timestamp','now','transaction_timestamp','statement_timestamp') LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path=public,extensions,pg_catalog,pg_temp',f);
  END LOOP;
  -- Defaults bind built-ins at migration time; search_path alone cannot redirect them.
  FOR field IN SELECT c.oid::regclass AS relation,a.attname,pg_get_expr(d.adbin,d.adrelid) AS expression
    FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
    JOIN pg_class c ON c.oid=d.adrelid WHERE c.relnamespace='public'::regnamespace LOOP
    expression := replace(replace(replace(replace(field.expression,
      'pg_catalog.clock_timestamp()','clock_timestamp()'),'pg_catalog.now()','now()'),
      'pg_catalog.transaction_timestamp()','transaction_timestamp()'),'pg_catalog.statement_timestamp()','statement_timestamp()');
    expression := replace(replace(replace(replace(expression,
      'clock_timestamp()','public.clock_timestamp()'),'now()','public.now()'),
      'transaction_timestamp()','public.now()'),'statement_timestamp()','public.now()');
    IF expression IS DISTINCT FROM field.expression THEN
      EXECUTE format('ALTER TABLE %s ALTER COLUMN %I SET DEFAULT %s',field.relation,field.attname,expression);
    END IF;
  END LOOP;
END $$;
SET search_path=public,extensions,pg_catalog,pg_temp;
-- The fail-closed seed was inserted before clock injection; keep fixture controls newer.
ALTER TABLE public.swell_watch_automation_control DISABLE TRIGGER swell_watch_control_append_only;
UPDATE public.swell_watch_automation_control SET created_at=public.now()-interval '1 second'
WHERE state='disabled' AND reason_code='phase_26_initial_fail_closed';
ALTER TABLE public.swell_watch_automation_control ENABLE TRIGGER swell_watch_control_append_only;
