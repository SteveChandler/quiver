-- Tide capture on sessions (migration 20261002090000). Computed tide at 15:30Z from the fixture's
-- current-station noaa series: 3.38 → 4.09 ft, so ~3.735 ft and 'rising'.

-- (c) One series: the latest station's direct noaa row beats its hilo row and the old station's row.
DO $$ DECLARE h numeric; BEGIN
  INSERT INTO public.sessions (id, beach_id, arrival_time)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z');
  SELECT tide_height_ft INTO h FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000003';
  ASSERT h IS NOT NULL AND abs(h - 3.735) < 0.02, format('(c) expected ~3.735 ft from the noaa S1 series, got %s', h);
END $$;

-- (a) A tide chip alone keeps the user's status and still gets the computed height.
DO $$ DECLARE r record; BEGIN
  INSERT INTO public.sessions (id, beach_id, arrival_time, tide_status)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z', 'high');
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000001';
  ASSERT r.tide_height_ft IS NOT NULL AND abs(r.tide_height_ft - 3.735) < 0.02, format('(a) height should be filled, got %s', r.tide_height_ft);
  ASSERT r.tide_status = 'high', format('(a) the user''s status must stay, got %s', r.tide_status);
  ASSERT r.tide_status_user_set, '(a) tide_status_user_set should be true';
  ASSERT r.tide_data_source = 'noaa', format('(a) height came from the snapshot, source %s', r.tide_data_source);
  ASSERT r.tide_rate_ft_per_hr > 0, '(a) rate should be filled';
END $$;

-- (b) A user-entered height is left alone.
DO $$ DECLARE r record; BEGIN
  INSERT INTO public.sessions (id, beach_id, arrival_time, tide_height_ft, tide_status)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z', 4.2, 'high');
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002';
  ASSERT r.tide_height_ft = 4.2 AND r.tide_status = 'high' AND r.tide_data_source = 'user', format('(b) manual tide changed: %s', row_to_json(r));
  ASSERT NOT r.tide_status_user_set, '(b) a manual height is not a chip-only status';
END $$;

-- (d) Moving a chip session's arrival recomputes the height but keeps the user's status.
DO $$ DECLARE r record; BEGIN
  UPDATE public.sessions SET arrival_time = '2026-09-30T17:00:00Z' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000001';
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000001';
  ASSERT abs(r.tide_height_ft - 4.83) < 0.02, format('(d) height should follow arrival, got %s', r.tide_height_ft);
  ASSERT r.tide_status = 'high' AND r.tide_status_user_set, format('(d) status must stay the user''s, got %s', r.tide_status);
  UPDATE public.sessions SET arrival_time = '2026-09-30T15:30:00Z' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000001';
END $$;

-- (f) An edit that rewrites the same status (a full-row save) keeps it.
DO $$ DECLARE r record; BEGIN
  UPDATE public.sessions SET tide_status = 'high', tide_rate_ft_per_hr = tide_rate_ft_per_hr WHERE id = 'bbbbbbbb-0000-4000-8000-000000000001';
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000001';
  ASSERT r.tide_status = 'high' AND r.tide_data_source = 'noaa', format('(f) full-row save changed the tide: %s', row_to_json(r));
END $$;

-- (g) Clearing the chip falls back to the computed tide.
DO $$ DECLARE r record; BEGIN
  UPDATE public.sessions SET tide_status = NULL WHERE id = 'bbbbbbbb-0000-4000-8000-000000000001';
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000001';
  ASSERT r.tide_status = 'rising' AND NOT r.tide_status_user_set AND r.tide_data_source = 'noaa', format('(g) cleared chip: %s', row_to_json(r));
END $$;

-- (e) The migration's backfill gave the pre-migration chip session its height.
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000099';
  ASSERT abs(r.tide_height_ft - 3.735) < 0.02 AND r.tide_status = 'high' AND r.tide_status_user_set AND r.tide_data_source = 'noaa',
    format('(e) backfill: %s', row_to_json(r));
END $$;

-- (h) No tide rows near arrival: a chip still records the status, nothing else.
DO $$ DECLARE r record; BEGIN
  INSERT INTO public.sessions (id, beach_id, arrival_time, tide_status)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-06-01T15:30:00Z', 'low');
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000004';
  ASSERT r.tide_status = 'low' AND r.tide_status_user_set AND r.tide_height_ft IS NULL AND r.tide_data_source IS NULL,
    format('(h) no snapshot: %s', row_to_json(r));
END $$;

-- (q) The backfill skips a chip session whose user has no auth row (its UPDATE would fail the migration).
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000098';
  ASSERT r.tide_height_ft IS NULL AND r.tide_data_source = 'user' AND NOT r.tide_status_user_set, format('(q) orphan backfilled: %s', row_to_json(r));
END $$;

-- (i) Moving arrival and picking a chip in one save keeps the chip and recomputes the height.
DO $$ DECLARE r record; BEGIN
  INSERT INTO public.sessions (id, beach_id, arrival_time)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z');
  UPDATE public.sessions SET arrival_time = '2026-09-30T17:00:00Z', tide_status = 'high' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000005';
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000005';
  ASSERT r.tide_status = 'high' AND r.tide_status_user_set, format('(i) chip lost on arrival edit: %s', row_to_json(r));
  ASSERT abs(r.tide_height_ft - 4.83) < 0.02 AND r.tide_data_source = 'noaa', format('(i) height not recomputed: %s', row_to_json(r));
END $$;

-- (j) Moving arrival and typing a height in one save keeps the typed height.
DO $$ DECLARE r record; BEGIN
  INSERT INTO public.sessions (id, beach_id, arrival_time)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z');
  UPDATE public.sessions SET arrival_time = '2026-09-30T17:00:00Z', tide_height_ft = 6.1 WHERE id = 'bbbbbbbb-0000-4000-8000-000000000006';
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000006';
  ASSERT r.tide_height_ft = 6.1 AND r.tide_data_source = 'user', format('(j) typed height lost: %s', row_to_json(r));
END $$;

-- (p) Every existing session is queued for conditions by the migration.
DO $$ BEGIN
  ASSERT (SELECT bool_and(conditions_queued_at IS NOT NULL) FROM public.sessions), '(p) existing sessions not queued';
END $$;

-- (o) The job's own write (wind null → value, marker false → true) keeps the marker.
DO $$ DECLARE r record; BEGIN
  INSERT INTO public.sessions (id, beach_id, arrival_time)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z');
  UPDATE public.sessions
  SET swell_period_s = 13, swell_direction_deg = 270, conditions_source = 'forecast_row', conditions_forecast_at = '2026-09-30T15:00:00Z',
      wind_speed_mph = 5, wind_direction = 'NW', wind_direction_deg = 315, conditions_wind_filled = true,
      nearshore_point_id = 'D0505', nearshore_hs_m = 1.2, nearshore_source = 'cdip_mop_nowcast'
  WHERE id = 'bbbbbbbb-0000-4000-8000-000000000007';
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000007';
  ASSERT r.conditions_wind_filled AND r.wind_speed_mph = 5, format('(o) job write lost the marker: %s', row_to_json(r));
END $$;

-- (k) Moving a job-filled session clears what the job wrote and queues it again.
DO $$ DECLARE r record; BEGIN
  UPDATE public.sessions SET conditions_queued_at = '2026-01-01T00:00:00Z' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000007';
  UPDATE public.sessions SET arrival_time = '2026-09-30T17:00:00Z' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000007';
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000007';
  ASSERT r.swell_period_s IS NULL AND r.swell_direction_deg IS NULL AND r.conditions_source IS NULL AND r.conditions_forecast_at IS NULL,
    format('(k) swell not cleared: %s', row_to_json(r));
  ASSERT r.wind_speed_mph IS NULL AND r.wind_direction IS NULL AND r.wind_direction_deg IS NULL AND NOT r.conditions_wind_filled,
    format('(k) job wind not cleared: %s', row_to_json(r));
  ASSERT r.nearshore_point_id IS NULL AND r.nearshore_hs_m IS NULL AND r.nearshore_source IS NULL, format('(k) nearshore not cleared: %s', row_to_json(r));
  ASSERT r.conditions_queued_at > '2026-01-01T00:00:00Z', '(k) not requeued';
END $$;

-- (l) A user's wind survives an arrival edit; the job's swell doesn't.
DO $$ DECLARE r record; BEGIN
  INSERT INTO public.sessions (id, beach_id, arrival_time, wind_speed_mph, wind_direction)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z', 12, 'W');
  UPDATE public.sessions SET swell_period_s = 13, conditions_source = 'forecast_row' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000008';
  UPDATE public.sessions SET beach_id = 'aaaaaaaa-0000-4000-8000-000000000001', arrival_time = '2026-09-30T16:00:00Z' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000008';
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000008';
  ASSERT r.wind_speed_mph = 12 AND r.wind_direction = 'W' AND r.swell_period_s IS NULL AND r.conditions_source IS NULL,
    format('(l) user wind or job swell wrong: %s', row_to_json(r));
END $$;

-- (n) Editing job-filled wind makes it the user's: a later arrival edit keeps it.
DO $$ DECLARE r record; BEGIN
  INSERT INTO public.sessions (id, beach_id, arrival_time)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z');
  UPDATE public.sessions SET wind_speed_mph = 5, wind_direction = 'NW', conditions_wind_filled = true, conditions_source = 'forecast_row'
  WHERE id = 'bbbbbbbb-0000-4000-8000-000000000009';
  UPDATE public.sessions SET wind_speed_mph = 15 WHERE id = 'bbbbbbbb-0000-4000-8000-000000000009';
  UPDATE public.sessions SET arrival_time = '2026-09-30T17:00:00Z' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000009';
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000009';
  ASSERT r.wind_speed_mph = 15 AND r.wind_direction = 'NW' AND NOT r.conditions_wind_filled, format('(n) user-edited wind cleared: %s', row_to_json(r));
END $$;

-- (m) Conditions a client supplied stay through an arrival edit; nearshore (always the job's) is redone.
DO $$ DECLARE r record; BEGIN
  INSERT INTO public.sessions (id, beach_id, arrival_time, swell_period_s, conditions_source, nearshore_source, nearshore_point_id)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000010', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z', 11, 'client', 'cdip_mop_nowcast', 'D0505');
  UPDATE public.sessions SET arrival_time = '2026-09-30T17:00:00Z' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000010';
  SELECT * INTO r FROM public.sessions WHERE id = 'bbbbbbbb-0000-4000-8000-000000000010';
  ASSERT r.swell_period_s = 11 AND r.conditions_source = 'client' AND r.nearshore_source IS NULL AND r.nearshore_point_id IS NULL,
    format('(m) client conditions or nearshore wrong: %s', row_to_json(r));
END $$;

SELECT 'session-tide-snapshot: all assertions passed' AS result;
