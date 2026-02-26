BEGIN;

-- Returns the most popular beaches ranked by user adoption.
-- Popularity = count of profiles with home_beach_id + count of favorite_beaches entries.
CREATE OR REPLACE FUNCTION get_popular_beaches(p_limit int DEFAULT 8)
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
  FROM beaches b
  LEFT JOIN profiles p ON p.home_beach_id = b.id
  LEFT JOIN favorite_beaches fb ON fb.beach_id = b.id
  GROUP BY b.id, b.name, b.slug, b.city, b.state
  HAVING COUNT(DISTINCT p.id) + COUNT(DISTINCT fb.id) > 0
  ORDER BY COUNT(DISTINCT p.id) + COUNT(DISTINCT fb.id) DESC
  LIMIT p_limit;
$$;

-- Grant access to both anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_popular_beaches(int) TO anon, authenticated;

COMMENT ON FUNCTION get_popular_beaches IS 'Returns most popular beaches by user adoption (home_beach + favorites count)';

COMMIT;
