-- Nine manually attested issuances six hours apart (k=0..8); run k has primary height 0.4+0.1*k metres.
-- Requires swell-watch-study-receipts.sql (fixture_study_scopes). Evidence is manual, so no study acceptance is involved.
CREATE FUNCTION public.e7_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'assertion failed: %',label; END IF; END; $$;
CREATE FUNCTION public.e7_error(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF position(expected IN SQLERRM)>0 THEN RETURN; END IF;
    RAISE EXCEPTION 'expected %, got %',expected,SQLERRM;
  END;
  RAISE EXCEPTION 'expected failure: %',expected;
END; $$;
INSERT INTO public.beaches(id) VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222') ON CONFLICT DO NOTHING;
CREATE TABLE public.e7_runs(k integer PRIMARY KEY,run_utc timestamptz NOT NULL,revision_set_id uuid NOT NULL,provider_batch_id uuid NOT NULL,attestation_id uuid NOT NULL);
DO $$
DECLARE k integer; run_at timestamptz; r record; c record; attestation uuid;
BEGIN
  FOR k IN 0..8 LOOP
    run_at := date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '4 days'+make_interval(hours=>6*k);
    SELECT * INTO r FROM public.record_swell_watch_provider_run_receipt(public.fixture_study_scopes(to_char(run_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0.4+0.1*k));
    attestation := gen_random_uuid();
    PERFORM public.attest_swell_watch_provider_run(attestation,r.revision_set_id,'accepted','fixture',repeat('b',64),'manual contract');
    SELECT * INTO c FROM public.complete_swell_watch_provider_run_receipt(r.revision_set_id);
    INSERT INTO public.e7_runs VALUES(k,run_at,r.revision_set_id,c.provider_batch_id,attestation);
  END LOOP;
END;
$$;
