SELECT public.ingest_swell_watch_evaluation(
  '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555', 'synthetic_fixture:one',
  '11111111-1111-4111-8111-111111111111', 'southern-california', 'pacific-swell', 'noaa',
  '2026-09-03T12:00:00Z', 's2', 1, 13, 170, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64),
  'synthetic_fixture', '2026-09-06T12:00:00Z', '2026-09-06T18:00:00Z'
);
-- A mutable period/direction key is retained as an alias when the matcher supplies the existing UUID.
SELECT public.ingest_swell_watch_evaluation(
  '15151515-1515-4151-8151-151515151515', '16161616-1616-4161-8161-161616161616',
  '55555555-5555-4555-8555-555555555555', 'synthetic_fixture:three',
  '11111111-1111-4111-8111-111111111111', 'southern-california', 'pacific-swell-shifted', 'noaa',
  '2026-09-04T00:00:00Z', 's2', 1, 14, 175, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64),
  'synthetic_fixture', '2026-09-06T14:00:00Z', '2026-09-06T20:00:00Z'
);
-- Retry with caller-generated IDs: canonical observation, impact, and event IDs must be reused.
SELECT public.ingest_swell_watch_evaluation(
  '66666666-6666-4666-8666-666666666666', '77777777-7777-4777-8777-777777777777',
  '55555555-5555-4555-8555-555555555555', 'synthetic_fixture:one',
  '11111111-1111-4111-8111-111111111111', 'southern-california', 'pacific-swell', 'noaa',
  '2026-09-03T12:00:00Z', 's2', 1, 13, 170, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64),
  'synthetic_fixture', '2026-09-06T12:00:00Z', '2026-09-06T18:00:00Z'
);
-- The same source issuance at a second beach is distinct source evidence, not a duplicate row.
SELECT public.ingest_swell_watch_evaluation(
  '99999999-9999-4999-8999-999999999999', 'aaaaaaaa-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555', 'synthetic_fixture:one',
  '22222222-2222-4222-8222-222222222222', 'southern-california', 'pacific-swell', 'noaa',
  '2026-09-03T12:00:00Z', 's2', 1, 13, 170, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64),
  'synthetic_fixture', '2026-09-06T12:00:00Z', '2026-09-06T18:00:00Z'
);
SELECT public.ingest_swell_watch_evaluation(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '55555555-5555-4555-8555-555555555555', 'synthetic_fixture:two',
  '11111111-1111-4111-8111-111111111111', 'southern-california', 'pacific-swell', 'noaa',
  '2026-09-03T18:00:00Z', 's2', 1, 13, 171, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64),
  'synthetic_fixture', '2026-09-06T13:00:00Z', '2026-09-06T19:00:00Z'
);
-- The same descriptive measurement can be a separate episode only when the matcher supplies a new UUID.
SELECT public.ingest_swell_watch_evaluation(
  '17171717-1717-4171-8171-171717171717', '18181818-1818-4181-8181-181818181818',
  '19191919-1919-4191-8191-191919191919', 'synthetic_fixture:four',
  '11111111-1111-4111-8111-111111111111', 'southern-california', 'pacific-swell', 'noaa',
  '2026-09-04T06:00:00Z', 's2', 1, 13, 170, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64),
  'synthetic_fixture', '2026-09-09T12:00:00Z', '2026-09-09T18:00:00Z'
);
-- One completed batch may contain distinct partitions in the same region; IDs must stay separate.
SELECT public.ingest_swell_watch_evaluation(
  '20202020-2020-4020-8020-202020202020', '21212121-2121-4121-8121-212121212121',
  '22222222-2222-4222-8222-222222222223', 'synthetic_fixture:batch',
  '11111111-1111-4111-8111-111111111111', 'southern-california', 'batch-partition-one', 'noaa',
  '2026-09-04T12:00:00Z', 's1', 1, 11, 140, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64),
  'synthetic_fixture', '2026-09-08T12:00:00Z', '2026-09-08T18:00:00Z'
);
SELECT public.ingest_swell_watch_evaluation(
  '23232323-2323-4232-8232-232323232323', '24242424-2424-4242-8242-242424242424',
  '25252525-2525-4252-8252-252525252525', 'synthetic_fixture:batch',
  '11111111-1111-4111-8111-111111111111', 'southern-california', 'batch-partition-two', 'noaa',
  '2026-09-04T12:00:00Z', 's2', 1, 15, 190, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64),
  'synthetic_fixture', '2026-09-08T12:00:00Z', '2026-09-08T18:00:00Z'
);

RESET ROLE;

DO $$
DECLARE v_version integer;
BEGIN
  SELECT max(version) INTO v_version FROM public.swell_watch_event_state_transitions;
  IF v_version IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'expected exactly one stable transition'; END IF;
  IF (SELECT count(*) FROM public.swell_watch_observations) <> 9 THEN RAISE EXCEPTION 'observation retry/cross-beach identity failed'; END IF;
  IF (SELECT count(*) FROM public.swell_watch_beach_impacts) <> 9 THEN RAISE EXCEPTION 'impact identity failed'; END IF;
  IF (SELECT count(*) FROM public.swell_watch_regional_events) <> 5 THEN RAISE EXCEPTION 'regional identity failed: %', (SELECT count(*) FROM public.swell_watch_regional_events); END IF;
  IF (SELECT count(*) FROM public.swell_watch_event_evaluations) <> 8 THEN RAISE EXCEPTION 'evaluation idempotence failed'; END IF;
  IF (SELECT count(*) FROM public.swell_watch_event_impacts) <> 9 THEN RAISE EXCEPTION 'cross-beach association lost'; END IF;
  IF (SELECT count(*) FROM public.swell_watch_event_aliases) <> 6 THEN RAISE EXCEPTION 'event alias reconciliation failed'; END IF;
END;
$$;

SELECT public.append_swell_watch_state_transition(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '55555555-5555-4555-8555-555555555555', 1, 'candidate', 'synthetic_fixture:two'
);
