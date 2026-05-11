-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER FUNCTION public.update_session_likes_count() SECURITY DEFINER;

UPDATE public.sessions s
SET likes_count = sub.c
FROM (
  SELECT session_id, count(*)::int AS c
  FROM public.session_likes
  GROUP BY session_id
) sub
WHERE sub.session_id = s.id
  AND s.likes_count IS DISTINCT FROM sub.c;

UPDATE public.sessions
SET likes_count = 0
WHERE likes_count > 0
  AND id NOT IN (SELECT DISTINCT session_id FROM public.session_likes);
