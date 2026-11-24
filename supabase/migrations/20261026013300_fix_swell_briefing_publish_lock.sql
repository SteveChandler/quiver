-- `SELECT max(...) ... FOR UPDATE` is rejected by Postgres -- FOR UPDATE is not
-- allowed with aggregate functions -- so every publish failed with a 503. It
-- also locked nothing on the first edition of a day, when there are no rows to
-- lock, which is precisely when two jobs can race.
--
-- An advisory lock keyed on the edition serializes publishers for that
-- user/region/day whether or not a row exists yet, and the freshness read goes
-- back to being a plain aggregate.
--
-- Rollback: restore the prior body from 20261026010000, accepting that publish
-- fails. There is no reason to.

BEGIN;

CREATE OR REPLACE FUNCTION public.publish_swell_briefing_edition(
  p_artifact_id text,
  p_user_id uuid,
  p_region text,
  p_edition_date date,
  p_input_hash text,
  p_source_published_at timestamptz,
  p_valid_until timestamptz,
  p_generation_version text,
  p_model text,
  p_briefing jsonb,
  p_provenance jsonb
)
RETURNS TABLE (artifact_id text, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.swell_briefing_editions%ROWTYPE;
  v_newest_source timestamptz;
BEGIN
  -- Serialize publishers for this edition before anything is read, so the
  -- freshness check and the insert cannot interleave. Released at commit.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_region || ':' || p_edition_date::text, 0)
  );

  SELECT * INTO v_existing
  FROM public.swell_briefing_editions e
  WHERE e.artifact_id = p_artifact_id;

  IF FOUND THEN
    IF v_existing.user_id <> p_user_id THEN
      RAISE EXCEPTION 'artifact_owner_mismatch' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY SELECT v_existing.artifact_id, false;
    RETURN;
  END IF;

  PERFORM 1
  FROM public.swell_briefing_inputs i
  WHERE i.input_hash = p_input_hash
    AND i.user_id = p_user_id
    AND i.region = p_region
    AND i.edition_date = p_edition_date;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_input_hash' USING ERRCODE = '22023';
  END IF;

  SELECT max(e.source_published_at) INTO v_newest_source
  FROM public.swell_briefing_editions e
  WHERE e.user_id = p_user_id
    AND e.region = p_region
    AND e.edition_date = p_edition_date;

  IF v_newest_source IS NOT NULL AND p_source_published_at < v_newest_source THEN
    RAISE EXCEPTION 'stale_source' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.swell_briefing_editions (
    artifact_id, user_id, region, edition_date, input_hash,
    source_published_at, valid_until, generation_version, model,
    briefing, provenance
  )
  VALUES (
    p_artifact_id, p_user_id, p_region, p_edition_date, p_input_hash,
    p_source_published_at, p_valid_until, p_generation_version, p_model,
    p_briefing, p_provenance
  );

  RETURN QUERY SELECT p_artifact_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_swell_briefing_edition(
  text, uuid, text, date, text, timestamptz, timestamptz, text, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;

COMMIT;
