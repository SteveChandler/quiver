BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- ponytail: global lease; use cohort leases if independent collection needs throughput.
-- Ten minutes exceeds the
-- five-minute route lifetime; the write fence also rejects stale owners.
CREATE TABLE public.swell_watch_collection_lease (
  id integer PRIMARY KEY CHECK (id = 1),
  owner_token uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.swell_watch_collection_lease ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swell_watch_collection_lease FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.try_acquire_swell_watch_collection_lease(p_owner uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_owner IS NULL THEN RAISE EXCEPTION 'collection owner required'; END IF;
  INSERT INTO public.swell_watch_collection_lease(id,owner_token,expires_at)
  VALUES (1,p_owner,clock_timestamp()+interval '10 minutes')
  ON CONFLICT (id) DO UPDATE SET owner_token=EXCLUDED.owner_token,
    expires_at=clock_timestamp()+interval '10 minutes'
  WHERE swell_watch_collection_lease.expires_at <= clock_timestamp();
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.release_swell_watch_collection_lease(p_owner uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_owner IS NULL THEN RAISE EXCEPTION 'collection owner required'; END IF;
  DELETE FROM public.swell_watch_collection_lease WHERE id=1 AND owner_token=p_owner;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.record_leased_swell_watch_provider_run_receipt(p_owner uuid,p_scopes jsonb)
RETURNS TABLE(issuance_id uuid,run_batch_id uuid,revision_set_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_expires timestamptz;
BEGIN
  SELECT expires_at INTO v_expires FROM public.swell_watch_collection_lease
  WHERE id=1 AND owner_token=p_owner FOR UPDATE;
  IF NOT FOUND OR v_expires <= clock_timestamp() THEN
    RAISE EXCEPTION 'collection lease unavailable';
  END IF;
  -- Hold the lease row lock through the existing atomic receipt transaction.
  RETURN QUERY SELECT * FROM public.record_swell_watch_provider_run_receipt(p_scopes);
END;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_swell_watch_collection_lease(uuid),
  public.release_swell_watch_collection_lease(uuid),
  public.record_leased_swell_watch_provider_run_receipt(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_swell_watch_collection_lease(uuid),
  public.release_swell_watch_collection_lease(uuid),
  public.record_leased_swell_watch_provider_run_receipt(uuid,jsonb) TO service_role;

COMMIT;
