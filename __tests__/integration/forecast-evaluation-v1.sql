\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  beach uuid := '00000000-0000-0000-0000-000000000001';
  fallback uuid := '00000000-0000-0000-0000-000000000002';
  prediction uuid := '00000000-0000-0000-0000-000000000003';
  valid timestamptz := now() - interval '1 day';
  cutoff timestamptz := clock_timestamp() + interval '1 minute';
  selected jsonb;
  frozen jsonb;
  result record;
BEGIN
  selected := select_wave_observation_v1(beach, valid, cutoff);
  ASSERT selected->>'available_at' IS NULL, 'legacy provenance must remain unknown';
  ASSERT selected->>'qualification' IS NULL, 'range checking cannot fabricate qualification';
  DELETE FROM ioos_observations;
  DELETE FROM ioos_stations;
  INSERT INTO ioos_stations(station_id, nearest_beach_id) VALUES ('z',beach),('a',beach);
  INSERT INTO ndbc_direct_stations(station_id,nearest_beach_id) VALUES ('ndbc',beach);
  INSERT INTO ioos_observations(station_id,observed_at,wave_height_m) VALUES
    ('z',valid-interval '11 hours',1), ('z',valid-interval '10 minutes',2),
    ('a',valid+interval '10 minutes',3), ('a',valid-interval '10 minutes',4),
    ('a',valid,99), ('z',valid,-1);
  INSERT INTO ndbc_direct_observations(station_id,observed_at,wave_height_m) VALUES
    ('ndbc',valid-interval '10 minutes',5);
  selected := select_wave_observation_v1(beach,valid,cutoff);
  ASSERT (selected->>'value')::numeric = 4, 'nearest, earlier tie, source priority, station tie';
  ASSERT selected->>'station_id' = 'a';
  ASSERT selected->>'source' = 'ioos';
  ASSERT selected->>'revision' = '1';
  ASSERT selected->>'delta_seconds' = '600.000000';
  ASSERT selected->>'strict_time_eligible' = 'true';
  ASSERT selected->>'strict_eligible' = 'false', 'QC not established';
  ASSERT selected->>'ingested_at' IS NOT NULL;
  ASSERT selected->>'available_at' IS NOT NULL;
  -- A later ingestion cannot exist in an earlier as-of dataset.
  ASSERT select_wave_observation_v1(beach,valid,now()-interval '1 hour') IS NULL;
  -- A revision is timed; the frozen outcome must not change retroactively.
  frozen := selected;
  UPDATE ioos_observations SET wave_height_m=6 WHERE station_id='a' AND observed_at=valid-interval '10 minutes';
  selected := select_wave_observation_v1(beach,valid,cutoff);
  ASSERT selected->>'revision' = '2';
  ASSERT (frozen->>'value')::numeric = 4;
  ASSERT (selected->>'value')::numeric = 6;
  -- Atomic updater preserves raw/corrected/display values and existing labels.
  INSERT INTO ml_predictions_log(id,beach_id,predicted_at,raw_forecast_m,corrected_forecast_m,raw_display_height_m)
  VALUES(prediction,beach,valid,8,NULL,9);
  ASSERT match_ml_observation_v1(prediction,cutoff)->>'status' = 'matched';
  SELECT * INTO result FROM ml_predictions_log WHERE id=prediction;
  ASSERT result.raw_forecast_m=8 AND result.raw_display_height_m=9;
  ASSERT result.raw_error_m=2 AND result.corrected_error_m IS NULL;
  frozen := result.observation_match;
  UPDATE ioos_observations SET wave_height_m=7 WHERE station_id='a' AND observed_at=valid-interval '10 minutes';
  ASSERT match_ml_observation_v1(prediction,cutoff)->>'status' = 'already_matched';
  ASSERT (SELECT observation_match=frozen FROM ml_predictions_log WHERE id=prediction);
  -- Sparse readings still match operationally at 11 hours; strict time fails.
  DELETE FROM ioos_observations WHERE observed_at<>valid-interval '11 hours';
  DELETE FROM ndbc_direct_observations;
  selected := select_wave_observation_v1(beach,valid,cutoff);
  ASSERT (selected->>'value')::numeric = 1;
  ASSERT selected->>'strict_time_eligible' = 'false';
  ASSERT select_wave_observation_v1(beach,valid+interval '2 hours',cutoff) IS NULL;
  -- Missing rows stay retryable; a late arrival can fill them.
  UPDATE ml_predictions_log SET observed_m=NULL, observation_match=NULL, predicted_at=valid+interval '2 hours' WHERE id=prediction;
  ASSERT match_ml_observation_v1(prediction,cutoff)->>'status'='no_match';
  ASSERT (SELECT observed_m IS NULL FROM ml_predictions_log WHERE id=prediction);
  INSERT INTO ioos_observations(station_id,observed_at,wave_height_m) VALUES ('a',valid+interval '2 hours',3);
  ASSERT match_ml_observation_v1(prediction,cutoff)->>'status'='matched';
  -- Existing historical sentinels never reopen.
  UPDATE ml_predictions_log SET observed_m=-1 WHERE id=prediction;
  ASSERT match_ml_observation_v1(prediction,cutoff)->>'status'='already_matched';
  ASSERT (SELECT observed_m=-1 FROM ml_predictions_log WHERE id=prediction);
  -- Real resolver SQL, explicit CDIP fallback, same matcher for Python/backup.
  INSERT INTO beaches VALUES(fallback,'201',0,0,360);
  INSERT INTO ioos_stations(station_id,nearest_beach_id) VALUES('edu_ucsd_cdip_201',beach);
  INSERT INTO ioos_observations(station_id,observed_at,wave_height_m) VALUES('edu_ucsd_cdip_201',valid,2);
  selected := select_wave_observation_v1(fallback,valid,cutoff);
  ASSERT selected->>'station_tier'='resolved_station';
  ASSERT selected->>'station_id'='edu_ucsd_cdip_201';
  UPDATE ml_predictions_log SET observed_m=NULL, observation_match=NULL, beach_id=fallback,predicted_at=valid WHERE id=prediction;
  SELECT * INTO result FROM backfill_ml_observations_batch(10);
  ASSERT result.matched=1 AND result.expired_deleted=0 AND result.sentinel_marked=0;
  ASSERT (SELECT observation_match->>'station_id'='edu_ucsd_cdip_201' FROM ml_predictions_log WHERE id=prediction);
  -- Least-recent-attempt ordering keeps seven-day missing-label retries fair.
  UPDATE ml_predictions_log SET observed_m=NULL,
    observation_match=jsonb_build_object('matched_at',clock_timestamp()) WHERE id=prediction;
  INSERT INTO ml_predictions_log(id,beach_id,predicted_at,raw_forecast_m)
    VALUES('00000000-0000-0000-0000-000000000004',fallback,valid+interval '1 hour',4);
  SELECT * INTO result FROM backfill_ml_observations_batch(1);
  ASSERT result.matched=1;
  ASSERT (SELECT observed_m IS NULL FROM ml_predictions_log WHERE id=prediction);
  ASSERT (SELECT observed_m IS NOT NULL FROM ml_predictions_log
          WHERE id='00000000-0000-0000-0000-000000000004');
  -- Invalid numeric values never win, including PostgreSQL numeric NaN/Infinity.
  UPDATE ioos_observations SET wave_height_m='NaN' WHERE station_id='edu_ucsd_cdip_201';
  ASSERT select_wave_observation_v1(fallback,valid,cutoff) IS NULL;
  ASSERT NOT has_function_privilege('anon','public.match_ml_observation_v1(uuid,timestamptz)','EXECUTE');
  ASSERT NOT has_function_privilege('authenticated','public.select_wave_observation_v1(uuid,timestamptz,timestamptz)','EXECUTE');
  ASSERT has_function_privilege('service_role','public.match_ml_observation_v1(uuid,timestamptz)','EXECUTE');
  ASSERT (SELECT 'security_invoker=true'=ANY(reloptions) FROM pg_class WHERE relname='evaluation_wave_observations_v1');
END;
$$;
ROLLBACK;
