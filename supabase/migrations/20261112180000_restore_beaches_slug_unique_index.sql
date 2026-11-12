-- Restore the unique index on lower(beaches.slug).
--
-- 20250914090000 created beaches_slug_unique. The remote-commit dump
-- 20251031021702 dropped it with a batch of other beaches indexes that prod
-- lacked at the time, with no stated reason. Without it, a second row with the
-- same slug (any case) can make a beach page and its tides or water-temp page
-- resolve different rows. Readers lowercase the slug before .eq("slug"), so the
-- key is lower(slug). Rows with a null slug (POST /api/beaches) stay allowed.
--
-- Plain CREATE INDEX, not CONCURRENTLY: CONCURRENTLY cannot run inside a
-- transaction, and soul.md requires migration files to be wrapped in
-- BEGIN/COMMIT. The table holds ~575 rows, so the build takes milliseconds;
-- lock_timeout makes it give up instead of queueing behind a long writer.
--
-- Rollback: DROP INDEX IF EXISTS public.beaches_slug_unique;

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(format('%s (%s rows)', s, n), ', ' ORDER BY s)
    INTO dupes
    FROM (
      SELECT lower(slug) AS s, count(*) AS n
        FROM public.beaches
       WHERE slug IS NOT NULL
       GROUP BY lower(slug)
      HAVING count(*) > 1
    ) d;

  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'beaches has duplicate lower(slug) values; resolve them before adding beaches_slug_unique: %', dupes;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS beaches_slug_unique
  ON public.beaches (lower(slug))
  WHERE slug IS NOT NULL;

COMMIT;
