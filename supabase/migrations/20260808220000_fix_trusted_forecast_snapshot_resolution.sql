BEGIN;

-- Applications must hash and persist the same snapshot dimensions that identify
-- the first-write prediction row. CREATE OR REPLACE preserves the existing
-- function owner and grants.
CREATE OR REPLACE FUNCTION public.trusted_forecast_canonical_application(
  p_row jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'adjustedMaxFaceFt', public.trusted_forecast_canonical_number(
      p_row -> 'adjustedMaxFaceFt'
    ),
    'appliedDeltaFt', public.trusted_forecast_canonical_number(
      p_row -> 'appliedDeltaFt'
    ),
    'baselineMaxFaceFt', public.trusted_forecast_canonical_number(
      p_row -> 'baselineMaxFaceFt'
    ),
    'beachId', p_row -> 'beachId',
    'displaySource', p_row -> 'displaySource',
    'forecastAt', public.trusted_forecast_canonical_timestamp(
      p_row -> 'forecastAt'
    ),
    'forecastHorizonBucket', p_row -> 'forecastHorizonBucket',
    'localDate', p_row -> 'localDate'
  );
$$;

-- The RPC is deliberately replaced from its installed definition so its
-- signature and permissions stay unchanged while the application lookup uses
-- the full ml_predictions_log uniqueness key.
DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_before_lookup text;
  v_application_keys_replaced boolean := false;
  v_snapshot_lookup_replaced boolean := false;
BEGIN
  SELECT pg_get_functiondef(
    'public.persist_trusted_forecast_build(jsonb)'::regprocedure
  ) INTO v_definition;

  v_updated := replace(
    v_definition,
    $application_keys$
  c_application_keys CONSTANT text[] := ARRAY[
    'beachId',
    'localDate',
    'forecastAt',
    'appliedDeltaFt',
    'baselineMaxFaceFt',
    'adjustedMaxFaceFt'
  ];$application_keys$,
    $application_keys$
  c_application_keys CONSTANT text[] := ARRAY[
    'beachId',
    'localDate',
    'forecastAt',
    'forecastHorizonBucket',
    'displaySource',
    'appliedDeltaFt',
    'baselineMaxFaceFt',
    'adjustedMaxFaceFt'
  ];$application_keys$
  );

  IF v_updated = v_definition THEN
    RAISE EXCEPTION
      'trusted forecast snapshot-resolution migration did not find the application key contract';
  END IF;
  v_application_keys_replaced := true;

  v_before_lookup := v_updated;
  v_updated := replace(
    v_updated,
    $snapshot_lookup$
    SELECT id
    INTO v_snapshot_id
    FROM public.ml_predictions_log
    WHERE beach_id = (v_element ->> 'beachId')::uuid
      AND predicted_at = (v_element ->> 'forecastAt')::timestamptz
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1;$snapshot_lookup$,
    $snapshot_lookup$
    SELECT id
    INTO v_snapshot_id
    FROM public.ml_predictions_log
    WHERE beach_id = (v_element ->> 'beachId')::uuid
      AND predicted_at = (v_element ->> 'forecastAt')::timestamptz
      AND forecast_horizon_bucket = (v_element ->> 'forecastHorizonBucket')
      AND display_source = (v_element ->> 'displaySource')
    LIMIT 1;$snapshot_lookup$
  );

  IF v_updated = v_before_lookup THEN
    RAISE EXCEPTION
      'trusted forecast snapshot-resolution migration did not find the snapshot lookup';
  END IF;
  v_snapshot_lookup_replaced := true;

  IF NOT v_application_keys_replaced OR NOT v_snapshot_lookup_replaced THEN
    RAISE EXCEPTION
      'trusted forecast snapshot-resolution migration did not apply every required replacement';
  END IF;

  EXECUTE v_updated;
END;
$migration$;

COMMIT;
