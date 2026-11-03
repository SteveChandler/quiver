-- Study progress follows the slowest feed: the no-send study completes only when every cohort feed has
-- its own 30 qualifying days (Steven Chandler, 2026-10-22). Each feed is its own sample; the best-feed
-- basis (20260924180000) let one feed end acquisition for all ten. Only the feed selection changes.
-- Rollback on the reviewed post-change definition (SHA-256:
-- c07b36b5c134ddacd099eda8a71488c83903f71ad25af7a4150e2330d3cfdf53):
-- Copy this transaction and change the guard to accept only the post-change hash above.
-- Change the position check to require "ORDER BY (value->>'qualifyingDays')::integer ASC, key LIMIT 1".
-- Reverse the replace arguments: ASC -> DESC and 'every_feed' -> 'best_completed_feed'.
-- Execute the transaction, then verify the restored SHA-256 is
-- db17c16e2c3af8f092f34f8cb7feacd6f23e55984d96b7731ffaf16d2ab9d1b2.
BEGIN;

DO $amend$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex') <>
    'db17c16e2c3af8f092f34f8cb7feacd6f23e55984d96b7731ffaf16d2ab9d1b2' THEN
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
