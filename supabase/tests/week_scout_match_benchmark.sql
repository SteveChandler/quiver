SELECT set_config('test.match_version', :'benchmark_version',false);
DO $bench$
DECLARE version text := current_setting('test.match_version'); source text; query text; slots integer;
BEGIN
  FOREACH slots IN ARRAY ARRAY[1,252,5040] LOOP
    IF slots=1 THEN
      query := $$SELECT public.compute_user_match_score(fixture_id(13),fixture_id(101),'3 ft','12s','12 mph','90','2.3')$$;
    ELSE
      source := CASE WHEN slots=252 THEN 'perf_252' ELSE 'perf_slots' END;
      IF version='legacy' THEN
        query := format($q$SELECT jsonb_agg(jsonb_build_object('beach_id',s.beach_id,'forecast_at',s.forecast_at,
          'result',public.compute_user_match_score(fixture_id(13),s.beach_id,s.wave_height,
            s.wave_period,s.wind_speed,s.wind_direction,s.tide_height))) FROM %I s$q$,source);
      ELSE
        query := format($q$SELECT public.get_week_scout_personalization(fixture_id(13),
          ARRAY(SELECT id FROM public.beaches),(SELECT jsonb_agg(to_jsonb(s)) FROM %I s))$q$,source);
      END IF;
    END IF;
    PERFORM pg_temp.benchmark_match(version,slots,query);
  END LOOP;
END $bench$;
