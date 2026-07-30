BEGIN;

-- The set-based batch optimization from 20260723120000 changed the
-- centroid inputs from numeric JSONB values to beaches.lat/lon, which are
-- double precision. PostgreSQL only supports round(value, scale) for numeric,
-- so cast the completed centroid ratios before rounding.
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
    weighted_events AS MATERIALIZED (
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
        GREATEST(
          0,
          1.0 - EXTRACT(EPOCH FROM (now() - e.created_at)) / (90 * 86400)
        ) AS recency_factor
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

    positive_weighted_events AS MATERIALIZED (
      SELECT *
      FROM weighted_events
      WHERE weight > 0
    ),

    event_wave_samples AS (
      SELECT samples.user_id, samples.wave_height_ft
      FROM (
        SELECT
          we.user_id,
          COALESCE(we.metadata_wave_ft, forecast_wave.wave_height_ft) AS wave_height_ft
        FROM positive_weighted_events we
        LEFT JOIN LATERAL (
          SELECT
            ((regexp_match(ef.wave_height::text, '-?\d+(?:\.\d+)?'))[1])::numeric AS wave_height_ft
          FROM public.enhanced_forecasts ef
          WHERE we.metadata_wave_ft IS NULL
            AND we.beach_id IS NOT NULL
            AND ef.beach_id = we.beach_id
            AND ef.forecast_at IS NOT NULL
            AND ef.forecast_at BETWEEN we.created_at - interval '6 hours'
                                  AND we.created_at + interval '6 hours'
          ORDER BY abs(EXTRACT(EPOCH FROM (ef.forecast_at - we.created_at))) ASC
          LIMIT 1
        ) forecast_wave ON true
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
        sum(abs(we.weight)) AS total_abs_weight
      FROM weighted_events we
      GROUP BY we.user_id
      HAVING count(*) >= 3
    ),

    positive_beach_metrics AS (
      SELECT
        we.user_id,
        we.beach_id,
        b.lat,
        b.lon,
        b.break_type,
        sum(we.weight * we.recency_factor) AS weighted_engagement
      FROM positive_weighted_events we
      LEFT JOIN public.beaches b ON b.id = we.beach_id
      WHERE we.beach_id IS NOT NULL
      GROUP BY we.user_id, we.beach_id, b.lat, b.lon, b.break_type
    ),

    break_type_weights AS (
      SELECT
        user_id,
        jsonb_object_agg(break_type, round(weight_pct::numeric, 2)) AS weights
      FROM (
        SELECT
          user_id,
          break_type,
          sum(weighted_engagement) /
            nullif(sum(sum(weighted_engagement)) OVER (PARTITION BY user_id), 0) AS weight_pct
        FROM positive_beach_metrics
        WHERE break_type IS NOT NULL
        GROUP BY user_id, break_type
      ) weighted_break_types
      WHERE weight_pct > 0
      GROUP BY user_id
    ),

    beach_centroids AS (
      SELECT
        user_id,
        round(
          (
            sum(lat * weighted_engagement) FILTER (WHERE lat IS NOT NULL) /
              nullif(sum(weighted_engagement) FILTER (WHERE lat IS NOT NULL), 0)
          )::numeric,
          6
        ) AS location_centroid_lat,
        round(
          (
            sum(lon * weighted_engagement) FILTER (WHERE lon IS NOT NULL) /
              nullif(sum(weighted_engagement) FILTER (WHERE lon IS NOT NULL), 0)
          )::numeric,
          6
        ) AS location_centroid_lon
      FROM positive_beach_metrics
      GROUP BY user_id
    ),

    top_beaches AS (
      SELECT user_id, array_agg(beach_id ORDER BY weighted_engagement DESC) AS top_engaged_beach_ids
      FROM (
        SELECT
          user_id,
          beach_id,
          sum(weighted_engagement) AS weighted_engagement,
          row_number() OVER (
            PARTITION BY user_id
            ORDER BY sum(weighted_engagement) DESC
          ) AS beach_rank
        FROM positive_beach_metrics
        GROUP BY user_id, beach_id
      ) ranked_beaches
      WHERE beach_rank <= 5
      GROUP BY user_id
    )

  SELECT
    um.user_id,
    wr.inferred_wave_min_ft,
    wr.inferred_wave_max_ft,
    COALESCE(btw.weights, '{}'::jsonb),
    bc.location_centroid_lat,
    bc.location_centroid_lon,
    COALESCE(tb.top_engaged_beach_ids, ARRAY[]::uuid[]),
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
  LEFT JOIN break_type_weights btw ON btw.user_id = um.user_id
  LEFT JOIN beach_centroids bc ON bc.user_id = um.user_id
  LEFT JOIN top_beaches tb ON tb.user_id = um.user_id
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
  'Computes implicit preferences from opted-in user_events with weighted decay. Uses set-based beach aggregates and numeric centroid rounding to keep the nightly batch valid and within the database statement timeout. Pass NULL for batch processing all users, or user_id for single-user update.';

COMMIT;
