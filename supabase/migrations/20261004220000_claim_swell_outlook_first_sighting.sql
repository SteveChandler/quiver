-- A first-sighting claim reserves the user's 72-hour slot before enqueueing.
-- The existing event ledger provides deduplication even if engagement saving fails.
BEGIN;

CREATE OR REPLACE FUNCTION public.claim_swell_outlook_first_sighting(
  p_user_id uuid,
  p_event_key text,
  p_event_keys text[],
  p_peak_date date,
  p_beach_id uuid,
  p_payload jsonb,
  p_now timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  claimed_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-outlook-first:' || p_user_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.swell_event_alerts
    WHERE user_id = p_user_id
      AND (event_key = p_event_key OR event_key = ANY(p_event_keys)
        OR created_at > p_now - interval '72 hours')
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.swell_event_alerts (user_id, event_key, peak_date, lead_beach_id, payload, created_at)
  VALUES (p_user_id, p_event_key, p_peak_date, p_beach_id, p_payload, p_now)
  ON CONFLICT (user_id, event_key) DO NOTHING
  RETURNING id INTO claimed_id;
  RETURN claimed_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_swell_outlook_first_sighting(uuid, text, text[], date, uuid, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_swell_outlook_first_sighting(uuid, text, text[], date, uuid, jsonb, timestamptz)
  TO service_role;

COMMIT;
