-- Study progress follows the slowest feed: the no-send study completes only when every cohort feed has
-- its own 30 qualifying days (Steven Chandler, 2026-10-22). Each feed is its own sample; the best-feed
-- basis (20260924180000) let one feed end acquisition for all ten. Only the feed selection changes.
-- Rollback: rerun this amend with ASC/'every_feed' and DESC/'best_completed_feed' swapped.
BEGIN;

DO $amend$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex') NOT IN
    ('db17c16e2c3af8f092f34f8cb7feacd6f23e55984d96b7731ffaf16d2ab9d1b2',
     'LOCAL_HASH') THEN
    RAISE EXCEPTION 'HASH=%', encode(extensions.digest(definition,'sha256'),'hex');
  END IF;
  IF position('ORDER BY (value->>''qualifyingDays'')::integer DESC, key LIMIT 1' IN definition)=0 THEN
    RAISE EXCEPTION 'study health feed selection missing';
  END IF;
  definition := replace(definition,
    'ORDER BY (value->>''qualifyingDays'')::integer DESC, key LIMIT 1',
    'ORDER BY (value->>''qualifyingDays'')::integer ASC, key LIMIT 1');
  definition := replace(definition, '''best_completed_feed''', '''every_feed''');
  EXECUTE definition;
END;
$amend$;

COMMIT;
