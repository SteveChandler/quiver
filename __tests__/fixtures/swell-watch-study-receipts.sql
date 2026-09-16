CREATE OR REPLACE FUNCTION public.fixture_study_scopes(
  p_run text,
  p_height numeric,
  p_generationtime numeric DEFAULT 1,
  p_source_points uuid[] DEFAULT ARRAY[
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  ],
  p_primary_period numeric DEFAULT 12,
  p_secondary_height numeric DEFAULT 0.6,
  p_secondary_period numeric DEFAULT 9,
  p_secondary_direction numeric DEFAULT 225
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
  WITH points AS (
    SELECT source_point_id,
      CASE WHEN source_point_id::text LIKE '1111%' THEN 32.8 ELSE 33.1 END AS latitude,
      CASE WHEN source_point_id::text LIKE '1111%' THEN -117.3 ELSE -117.6 END AS longitude
    FROM unnest(p_source_points) source_point_id
  ), payloads AS (
    SELECT points.*, jsonb_build_object(
      'time',(SELECT jsonb_agg(to_char(p_run::timestamptz+make_interval(hours=>slot),'YYYY-MM-DD"T"HH24:MI') ORDER BY slot) FROM generate_series(0,167) slot),
      'swell_wave_height',(SELECT jsonb_agg(p_height ORDER BY slot) FROM generate_series(0,167) slot),
          'swell_wave_period',(SELECT jsonb_agg(p_primary_period ORDER BY slot) FROM generate_series(0,167) slot),
      'swell_wave_direction',(SELECT jsonb_agg(170 ORDER BY slot) FROM generate_series(0,167) slot),
      'secondary_swell_wave_height',(SELECT jsonb_agg(p_secondary_height ORDER BY slot) FROM generate_series(0,167) slot),
      'secondary_swell_wave_period',(SELECT jsonb_agg(p_secondary_period ORDER BY slot) FROM generate_series(0,167) slot),
      'secondary_swell_wave_direction',(SELECT jsonb_agg(p_secondary_direction ORDER BY slot) FROM generate_series(0,167) slot)
    ) AS hourly
    FROM points
  ), semantic AS (
    SELECT payloads.*, jsonb_build_object(
      'latitude',latitude,'longitude',longitude,'utc_offset_seconds',0,'timezone','GMT','timezone_abbreviation','GMT','elevation',0,
      'hourly_units','{"time":"iso8601","swell_wave_height":"m","swell_wave_period":"s","swell_wave_direction":"°","secondary_swell_wave_height":"m","secondary_swell_wave_period":"s","secondary_swell_wave_direction":"°"}'::jsonb,
      'hourly',hourly
    ) AS semantic_payload
    FROM payloads
  ), evidence AS (
    SELECT semantic.*, semantic_payload || jsonb_build_object('generationtime_ms',p_generationtime) AS raw_payload
    FROM semantic
  )
  SELECT jsonb_agg(jsonb_build_object(
    'sourcePointId', source_point_id,
    'receipt', jsonb_build_object(
      'schemaVersion', 'open-meteo-single-runs-receipt.v1',
      'parserVersion', 'open-meteo-single-runs-receipt.v1',
      'requested', jsonb_build_object(
        'canonicalRequest', jsonb_build_object(
          'method', 'GET',
          'url', format(
            'https://single-runs-api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&models=ncep_gfswave016&hourly=swell_wave_height%%2Cswell_wave_period%%2Cswell_wave_direction%%2Csecondary_swell_wave_height%%2Csecondary_swell_wave_period%%2Csecondary_swell_wave_direction&run=%s&cell_selection=sea&timezone=UTC&forecast_days=7',
            latitude,
            longitude,
            replace(left(p_run, 16), ':', '%3A')
          ),
          'requestedRunUtc', p_run
        ),
        'runUtc', p_run,
        'model', 'ncep_gfswave016',
        'transportProvider', 'open_meteo_single_runs',
        'upstreamModelProvider', 'ncep'
      ),
      'rawResponse', raw_payload::text,
      'canonicalSemanticPayload', semantic_payload::text,
      'rawResponseSha256', encode(extensions.digest(raw_payload::text,'sha256'),'hex'),
      'revisionHash', encode(extensions.digest(semantic_payload::text,'sha256'),'hex'),
      'qualification', jsonb_build_object(
        'status', 'prototype_unqualified',
        'reason', 'provider_response_does_not_echo_run_and_completion_not_operationally_proven'
      ),
      'hourlyUnits', '{"time":"iso8601","swell_wave_height":"m","swell_wave_period":"s","swell_wave_direction":"°","secondary_swell_wave_height":"m","secondary_swell_wave_period":"s","secondary_swell_wave_direction":"°"}'::jsonb,
      'selectedGrid', jsonb_build_object(
        'latitude', latitude,
        'longitude', longitude,
        'elevationM', 0,
        'distanceFromRequestedKm', 0,
        'policy', jsonb_build_object('status', 'prototype_local_mapping_policy', 'maxDistanceKm', 30, 'providerGuarantee', false)
      ),
      'observations', (
        SELECT jsonb_agg(jsonb_build_object(
          'providerForecastAt', to_char(p_run::timestamptz + make_interval(hours => slot), 'YYYY-MM-DD"T"HH24:MI'),
          'forecastAtUtc', to_char(p_run::timestamptz + make_interval(hours => slot), 'YYYY-MM-DD"T"HH24:MI"Z"'),
          'timeProvenance', jsonb_build_object('field', 'time', 'timezone', 'UTC'),
          'components', jsonb_build_array(
            jsonb_build_object('sourceSlot', 's1', 'heightM', p_height, 'periodS', p_primary_period, 'directionDeg', 170, 'rawFieldProvenance', jsonb_build_object('height', 'swell_wave_height', 'period', 'swell_wave_period', 'direction', 'swell_wave_direction')),
            jsonb_build_object('sourceSlot', 's2', 'heightM', p_secondary_height, 'periodS', p_secondary_period, 'directionDeg', p_secondary_direction, 'rawFieldProvenance', jsonb_build_object('height', 'secondary_swell_wave_height', 'period', 'secondary_swell_wave_period', 'direction', 'secondary_swell_wave_direction'))
          )
        ) ORDER BY slot)
        FROM generate_series(0, 167) slot
      )
    )
  ) ORDER BY source_point_id)
  FROM evidence;
$$;
