BEGIN;

ALTER FUNCTION public.get_user_match_candidates(
  uuid,
  uuid,
  double precision,
  double precision,
  double precision,
  integer
)
SET search_path = public, extensions, pg_temp;

COMMIT;
