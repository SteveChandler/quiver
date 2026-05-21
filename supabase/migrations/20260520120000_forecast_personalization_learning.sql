BEGIN;

CREATE OR REPLACE FUNCTION public.compute_implicit_preferences(target_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  processed_count integer := 0;
BEGIN
  RAISE NOTICE 'compute_implicit_preferences: starting (target_user_id=%)', target_user_id;

  INSERT INTO public.user_implicit_preferences (
    user_id,
    inferred_wave_min_ft,
    inferred_wave_max_ft,
    break_type_weights,
    location_centroid_lat,
    location_centroid_lon,
    top_engaged_beach_ids,
    confidence,
    event_count,
    last_computed_at,
    computed_from,
    computed_to
  )
  WITH
    weighted_events AS (
      SELECT
        e.user_id,
        e.beach_id,
        e.event_type,
        e.created_at,
        e.metadata,
        COALESCE(
          ((regexp_match(e.metadata->>'wave_height_ft', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'forecast_wave_height_ft', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'wave_height', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'waveHeight', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'height_ft', '-?\d+(?:\.\d+)?'))[1])::numeric
        ) AS metadata_wave_ft,
        CASE e.event_type
          WHEN 'location_update' THEN 10.0
          WHEN 'discovery_click' THEN 3.0
          WHEN 'forecast_check' THEN 2.5
          WHEN 'beach_view' THEN 0.5
          WHEN 'discovery_skip' THEN -1.0
          ELSE 0
        END AS weight,
        GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (now() - e.created_at)) / (90 * 86400)) AS recency_factor
      FROM public.user_events e
      JOIN public.profiles p
        ON p.id = e.user_id
       AND p.allow_implicit_tracking = true
      WHERE e.user_id IS NOT NULL
        AND e.created_at > now() - interval '90 days'
        AND e.event_type IN (
          'location_update',
          'discovery_click',
          'forecast_check',
          'beach_view',
          'discovery_skip'
        )
        AND (target_user_id IS NULL OR e.user_id = target_user_id)
    ),

    event_wave_samples AS (
      SELECT
        samples.user_id,
        samples.wave_height_ft
      FROM (
        SELECT
          we.user_id,
          COALESCE(we.metadata_wave_ft, forecast_wave.wave_height_ft) AS wave_height_ft
        FROM weighted_events we
        LEFT JOIN LATERAL (
          SELECT
            ((regexp_match(ef.wave_height::text, '-?\d+(?:\.\d+)?'))[1])::numeric AS wave_height_ft
          FROM public.enhanced_forecasts ef
          WHERE we.beach_id IS NOT NULL
            AND ef.beach_id = we.beach_id
            AND ef.forecast_at IS NOT NULL
            AND ef.forecast_at BETWEEN we.created_at - interval '6 hours'
                                  AND we.created_at + interval '6 hours'
          ORDER BY abs(EXTRACT(EPOCH FROM (ef.forecast_at - we.created_at))) ASC
          LIMIT 1
        ) forecast_wave ON true
        WHERE we.weight > 0
      ) samples
      WHERE samples.wave_height_ft BETWEEN 0 AND 50
    ),

    wave_ranges AS (
      SELECT
        user_id,
        CASE
          WHEN count(*) >= 3 THEN round((percentile_cont(0.1) WITHIN GROUP (ORDER BY wave_height_ft))::numeric, 1)
          ELSE NULL::numeric
        END AS inferred_wave_min_ft,
        CASE
          WHEN count(*) >= 3 THEN round((percentile_cont(0.9) WITHIN GROUP (ORDER BY wave_height_ft))::numeric, 1)
          ELSE NULL::numeric
        END AS inferred_wave_max_ft
      FROM event_wave_samples
      GROUP BY user_id
    ),

    user_metrics AS (
      SELECT
        we.user_id,
        count(*) AS event_count,
        min(we.created_at) AS computed_from,
        max(we.created_at) AS computed_to,
        sum(abs(we.weight)) AS total_abs_weight,
        array_agg(
          jsonb_build_object(
            'beach_id', we.beach_id,
            'lat', b.lat,
            'lon', b.lon,
            'break_type', b.break_type,
            'weighted_engagement', we.weight * we.recency_factor
          )
          ORDER BY (we.weight * we.recency_factor) DESC
        ) FILTER (WHERE we.beach_id IS NOT NULL) AS beach_data
      FROM weighted_events we
      LEFT JOIN public.beaches b ON we.beach_id = b.id
      GROUP BY we.user_id
      HAVING count(*) >= 3
    )

  SELECT
    um.user_id,
    wr.inferred_wave_min_ft,
    wr.inferred_wave_max_ft,
    coalesce(
      (
        SELECT jsonb_object_agg(break_type, round(weight_pct::numeric, 2))
        FROM (
          SELECT
            (beach_obj->>'break_type')::text AS break_type,
            sum((beach_obj->>'weighted_engagement')::numeric) /
              nullif(sum(sum((beach_obj->>'weighted_engagement')::numeric)) OVER (), 0) AS weight_pct
          FROM unnest(um.beach_data) AS beach_obj
          WHERE beach_obj->>'break_type' IS NOT NULL
            AND (beach_obj->>'weighted_engagement')::numeric > 0
          GROUP BY (beach_obj->>'break_type')::text
        ) bt
        WHERE weight_pct > 0
      ),
      '{}'::jsonb
    ),
    round(
      (
        SELECT sum((beach_obj->>'lat')::numeric * (beach_obj->>'weighted_engagement')::numeric) /
               nullif(sum(CASE WHEN beach_obj->>'lat' IS NOT NULL
                               THEN (beach_obj->>'weighted_engagement')::numeric
                               ELSE 0 END), 0)
        FROM unnest(um.beach_data) AS beach_obj
        WHERE (beach_obj->>'weighted_engagement')::numeric > 0
      ),
      6
    ),
    round(
      (
        SELECT sum((beach_obj->>'lon')::numeric * (beach_obj->>'weighted_engagement')::numeric) /
               nullif(sum(CASE WHEN beach_obj->>'lon' IS NOT NULL
                               THEN (beach_obj->>'weighted_engagement')::numeric
                               ELSE 0 END), 0)
        FROM unnest(um.beach_data) AS beach_obj
        WHERE (beach_obj->>'weighted_engagement')::numeric > 0
      ),
      6
    ),
    coalesce(
      (
        SELECT array_agg(beach_id ORDER BY weighted_engagement DESC)
        FROM (
          SELECT
            (beach_obj->>'beach_id')::uuid AS beach_id,
            sum((beach_obj->>'weighted_engagement')::numeric) AS weighted_engagement
          FROM unnest(um.beach_data) AS beach_obj
          WHERE (beach_obj->>'weighted_engagement')::numeric > 0
          GROUP BY (beach_obj->>'beach_id')::uuid
          ORDER BY weighted_engagement DESC
          LIMIT 5
        ) ranked
      ),
      ARRAY[]::uuid[]
    ),
    round(
      (1.0 / (1.0 + exp(-0.05 * (um.total_abs_weight - 20))))::numeric,
      2
    ),
    um.event_count::int,
    now(),
    um.computed_from,
    um.computed_to
  FROM user_metrics um
  LEFT JOIN wave_ranges wr ON wr.user_id = um.user_id
  ON CONFLICT (user_id) DO UPDATE SET
    inferred_wave_min_ft = excluded.inferred_wave_min_ft,
    inferred_wave_max_ft = excluded.inferred_wave_max_ft,
    break_type_weights = excluded.break_type_weights,
    location_centroid_lat = excluded.location_centroid_lat,
    location_centroid_lon = excluded.location_centroid_lon,
    top_engaged_beach_ids = excluded.top_engaged_beach_ids,
    confidence = excluded.confidence,
    event_count = excluded.event_count,
    last_computed_at = now(),
    computed_from = excluded.computed_from,
    computed_to = excluded.computed_to;

  GET DIAGNOSTICS processed_count = ROW_COUNT;

  DELETE FROM public.user_implicit_preferences prefs
  WHERE (target_user_id IS NULL OR prefs.user_id = target_user_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_events e
      JOIN public.profiles p
        ON p.id = e.user_id
       AND p.allow_implicit_tracking = true
      WHERE e.user_id = prefs.user_id
        AND e.created_at > now() - interval '90 days'
        AND e.event_type IN (
          'location_update',
          'discovery_click',
          'forecast_check',
          'beach_view',
          'discovery_skip'
        )
      GROUP BY e.user_id
      HAVING count(*) >= 3
    );

  RAISE NOTICE 'compute_implicit_preferences: completed (processed_count=%)', processed_count;

  RETURN processed_count;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'compute_implicit_preferences: error - % (%)', sqlerrm, sqlstate;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.compute_implicit_preferences(uuid) IS
  'Computes implicit preferences from opted-in user_events with weighted decay. Wave range is inferred from positive implicit event metadata first, then nearest enhanced_forecasts.forecast_at within +/- 6 hours. Pass NULL for batch processing all users, or user_id for single-user update.';

CREATE OR REPLACE FUNCTION public.create_session_forecast_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  forecast_data jsonb;
  conditions_data jsonb;
  forecast_vs_actual_data jsonb := '{}'::jsonb;
  snapshot_exists boolean;
  forecast_wave_height numeric;
  forecast_wind_speed numeric;
  forecast_tide_height numeric;
BEGIN
  IF new.status IS DISTINCT FROM 'completed' THEN
    RETURN new;
  END IF;

  conditions_data := jsonb_build_object(
    'wave_quality', new.wave_quality,
    'water_temp', new.water_temp,
    'crowd_level', new.crowd_level,
    'parking_ease', new.parking_ease,
    'rating', new.rating,
    'notes', new.notes,
    'duration_minutes', new.duration_minutes,
    'arrival_time', new.arrival_time,
    'wave_height_ft', new.wave_height_ft,
    'wind_speed_mph', new.wind_speed_mph,
    'wind_direction', new.wind_direction,
    'forecast_accuracy', new.forecast_accuracy,
    'tide_height_ft', new.tide_height_ft,
    'tide_status', new.tide_status
  );

  IF tg_op = 'UPDATE' THEN
    IF old.status = 'completed' THEN
      SELECT sfs.forecast_snapshot
      INTO forecast_data
      FROM public.session_forecast_snapshots sfs
      WHERE sfs.session_id = new.id;

      IF forecast_data IS NOT NULL THEN
        IF forecast_data->>'wave_height' IS NOT NULL AND new.wave_height_ft IS NOT NULL THEN
          BEGIN
            forecast_wave_height := (forecast_data->>'wave_height')::numeric;
            IF forecast_wave_height IS DISTINCT FROM new.wave_height_ft THEN
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'wave_height_ft', jsonb_build_object(
                  'forecast', forecast_wave_height,
                  'actual', new.wave_height_ft,
                  'diff', new.wave_height_ft - forecast_wave_height
                )
              );
            END IF;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;

        IF forecast_data->>'wind_speed_mph' IS NOT NULL AND new.wind_speed_mph IS NOT NULL THEN
          BEGIN
            forecast_wind_speed := (forecast_data->>'wind_speed_mph')::numeric;
            IF forecast_wind_speed IS DISTINCT FROM new.wind_speed_mph THEN
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'wind_speed_mph', jsonb_build_object(
                  'forecast', forecast_wind_speed,
                  'actual', new.wind_speed_mph,
                  'diff', new.wind_speed_mph - forecast_wind_speed
                )
              );
            END IF;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;

        IF forecast_data->>'wind_direction' IS NOT NULL AND new.wind_direction IS NOT NULL THEN
          IF forecast_data->>'wind_direction' <> new.wind_direction THEN
            forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
              'wind_direction', jsonb_build_object(
                'forecast', forecast_data->>'wind_direction',
                'actual', new.wind_direction
              )
            );
          END IF;
        END IF;

        IF forecast_data->>'tide_height' IS NOT NULL AND new.tide_height_ft IS NOT NULL THEN
          BEGIN
            forecast_tide_height := (forecast_data->>'tide_height')::numeric;
            IF forecast_tide_height IS DISTINCT FROM new.tide_height_ft THEN
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'tide_height_ft', jsonb_build_object(
                  'forecast', forecast_tide_height,
                  'actual', new.tide_height_ft,
                  'diff', new.tide_height_ft - forecast_tide_height
                )
              );
            END IF;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;

        IF forecast_data->>'tide_status' IS NOT NULL AND new.tide_status IS NOT NULL THEN
          IF forecast_data->>'tide_status' <> new.tide_status THEN
            forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
              'tide_status', jsonb_build_object(
                'forecast', forecast_data->>'tide_status',
                'actual', new.tide_status
              )
            );
          END IF;
        END IF;

        UPDATE public.session_forecast_snapshots
        SET
          actual_conditions = coalesce(actual_conditions, '{}'::jsonb) || conditions_data,
          forecast_vs_actual = forecast_vs_actual_data,
          session_date = new.arrival_time::date,
          updated_at = now()
        WHERE session_id = new.id;

        RETURN new;
      END IF;
    END IF;
  END IF;

  SELECT exists(
    SELECT 1
    FROM public.session_forecast_snapshots
    WHERE session_id = new.id
  ) INTO snapshot_exists;

  IF snapshot_exists THEN
    RETURN new;
  END IF;

  SELECT to_jsonb(ef.*)
  INTO forecast_data
  FROM public.enhanced_forecasts ef
  WHERE ef.beach_id::uuid = new.beach_id::uuid
    AND ef.forecast_at IS NOT NULL
    AND ef.forecast_at BETWEEN new.arrival_time - interval '6 hours'
                          AND new.arrival_time + interval '6 hours'
  ORDER BY abs(EXTRACT(EPOCH FROM (ef.forecast_at - new.arrival_time))) ASC
  LIMIT 1;

  IF forecast_data IS NOT NULL THEN
    forecast_vs_actual_data := '{}'::jsonb;

    IF forecast_data->>'wave_height' IS NOT NULL AND new.wave_height_ft IS NOT NULL THEN
      BEGIN
        forecast_wave_height := (forecast_data->>'wave_height')::numeric;
        IF forecast_wave_height IS DISTINCT FROM new.wave_height_ft THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'wave_height_ft', jsonb_build_object(
              'forecast', forecast_wave_height,
              'actual', new.wave_height_ft,
              'diff', new.wave_height_ft - forecast_wave_height
            )
          );
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;

    IF forecast_data->>'wind_speed_mph' IS NOT NULL AND new.wind_speed_mph IS NOT NULL THEN
      BEGIN
        forecast_wind_speed := (forecast_data->>'wind_speed_mph')::numeric;
        IF forecast_wind_speed IS DISTINCT FROM new.wind_speed_mph THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'wind_speed_mph', jsonb_build_object(
              'forecast', forecast_wind_speed,
              'actual', new.wind_speed_mph,
              'diff', new.wind_speed_mph - forecast_wind_speed
            )
          );
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;

    IF forecast_data->>'wind_direction' IS NOT NULL AND new.wind_direction IS NOT NULL THEN
      IF forecast_data->>'wind_direction' <> new.wind_direction THEN
        forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
          'wind_direction', jsonb_build_object(
            'forecast', forecast_data->>'wind_direction',
            'actual', new.wind_direction
          )
        );
      END IF;
    END IF;

    IF forecast_data->>'tide_height' IS NOT NULL AND new.tide_height_ft IS NOT NULL THEN
      BEGIN
        forecast_tide_height := (forecast_data->>'tide_height')::numeric;
        IF forecast_tide_height IS DISTINCT FROM new.tide_height_ft THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'tide_height_ft', jsonb_build_object(
              'forecast', forecast_tide_height,
              'actual', new.tide_height_ft,
              'diff', new.tide_height_ft - forecast_tide_height
            )
          );
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;

    IF forecast_data->>'tide_status' IS NOT NULL AND new.tide_status IS NOT NULL THEN
      IF forecast_data->>'tide_status' <> new.tide_status THEN
        forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
          'tide_status', jsonb_build_object(
            'forecast', forecast_data->>'tide_status',
            'actual', new.tide_status
          )
        );
      END IF;
    END IF;

    BEGIN
      INSERT INTO public.session_forecast_snapshots (
        session_id, user_id, beach_id, forecast_snapshot, actual_conditions,
        forecast_vs_actual, forecast_confidence_score, data_source, session_date
      ) VALUES (
        new.id, new.user_id, new.beach_id::uuid, forecast_data, conditions_data,
        forecast_vs_actual_data, (forecast_data->>'confidence_score')::integer,
        forecast_data->>'data_source', new.arrival_time::date
      );
    EXCEPTION
      WHEN unique_violation THEN NULL;
      WHEN others THEN RAISE WARNING 'Failed to create forecast snapshot for session %: %', new.id, sqlerrm;
    END;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_session_forecast_snapshot ON public.sessions;

CREATE TRIGGER trigger_create_session_forecast_snapshot
  AFTER INSERT OR UPDATE OF
    status, wave_quality, water_temp, crowd_level, parking_ease, rating, notes,
    duration_minutes, arrival_time, wave_height_ft, wind_speed_mph, wind_direction,
    forecast_accuracy, tide_height_ft, tide_status
  ON public.sessions
  FOR EACH ROW
  WHEN (new.status = 'completed')
  EXECUTE FUNCTION public.create_session_forecast_snapshot();

COMMENT ON FUNCTION public.create_session_forecast_snapshot() IS
  'Creates session forecast snapshots and keeps actual_conditions synced. Forecast rows are matched by nearest enhanced_forecasts.forecast_at within +/- 6 hours of session arrival_time.';

COMMIT;
