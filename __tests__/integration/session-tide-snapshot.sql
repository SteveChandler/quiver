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

SELECT 'session-tide-snapshot: all assertions passed' AS result;
