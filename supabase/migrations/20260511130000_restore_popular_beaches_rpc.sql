BEGIN;

CREATE OR REPLACE FUNCTION public.get_popular_beaches(p_limit integer DEFAULT 8)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  city text,
  state text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.name,
    b.slug,
    b.city,
    b.state
  FROM public.beaches b
  LEFT JOIN public.profiles p
    ON p.home_beach_id = b.id
  LEFT JOIN public.favorite_beaches fb
    ON fb.beach_id = b.id
  WHERE b.deleted_at IS NULL
    AND COALESCE(b.is_private, false) = false
  GROUP BY b.id, b.name, b.slug, b.city, b.state
  HAVING COUNT(DISTINCT p.id) + COUNT(DISTINCT fb.id) > 0
  ORDER BY COUNT(DISTINCT p.id) + COUNT(DISTINCT fb.id) DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_beaches(integer) TO anon, authenticated;

COMMENT ON FUNCTION public.get_popular_beaches(integer) IS
  'Returns popular curated beaches by home beach and beach favorite adoption.';

COMMIT;
