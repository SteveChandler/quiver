BEGIN;

CREATE OR REPLACE FUNCTION public.create_custom_spot_guarded(
  p_name text,
  p_lat double precision,
  p_lon double precision,
  p_break_type text DEFAULT NULL,
  p_visibility text DEFAULT 'private'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  lat numeric,
  lon numeric,
  break_type text,
  visibility text,
  nearest_beach_id uuid,
  nearest_beach_distance_mi numeric,
  deleted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  favorite_id uuid,
  favorite_rank integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  trimmed_name text := btrim(p_name);
  nearest_id uuid;
  nearest_distance_miles numeric(5,2);
  favorite_count integer;
  next_rank integer;
  has_unlimited_favorites boolean;
  inserted_spot public.custom_spots%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF trimmed_name IS NULL OR char_length(trimmed_name) < 1 OR char_length(trimmed_name) > 60 THEN
    RAISE EXCEPTION 'invalid_custom_spot_name'
      USING DETAIL = 'name_length_1_60_required';
  END IF;

  IF p_lat IS NULL OR p_lon IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lon < -180 OR p_lon > 180 THEN
    RAISE EXCEPTION 'invalid_custom_spot_coordinates'
      USING DETAIL = 'lat_lon_out_of_range';
  END IF;

  IF p_break_type IS NOT NULL
     AND p_break_type <> ALL (ARRAY['reef','point','beach','rivermouth','jetty']) THEN
    RAISE EXCEPTION 'invalid_custom_spot_break_type'
      USING DETAIL = 'unsupported_break_type';
  END IF;

  nearest_id := public.find_nearest_beach_id(
    p_lat::decimal,
    p_lon::decimal,
    241401.6
  );

  IF nearest_id IS NULL THEN
    RAISE EXCEPTION 'custom_spot_out_of_coverage'
      USING DETAIL = 'nearest_beach_required';
  END IF;

  SELECT round((ST_Distance(
    b.geog,
    ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
  ) / 1609.344)::numeric, 2)::numeric(5,2)
  INTO nearest_distance_miles
  FROM public.beaches b
  WHERE b.id = nearest_id;

  IF nearest_distance_miles IS NULL THEN
    RAISE EXCEPTION 'custom_spot_out_of_coverage'
      USING DETAIL = 'nearest_beach_distance_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(current_user_id::text)::bigint);

  SELECT EXISTS (
    SELECT 1
    FROM public.user_entitlements ue
    WHERE ue.user_id = current_user_id
      AND (ue.is_pro = true OR ue.is_trialing = true)
      AND (
        ue.expires_at IS NULL
        OR ue.expires_at > now()
        OR ue.billing_issue = true
      )
  ) INTO has_unlimited_favorites;

  SELECT count(*) INTO favorite_count
  FROM public.favorite_beaches fb
  WHERE fb.user_id = current_user_id;

  IF NOT has_unlimited_favorites AND favorite_count >= 3 THEN
    RAISE EXCEPTION 'favorite_quota_exceeded'
      USING DETAIL = 'free_favorites_limit';
  END IF;

  SELECT COALESCE(max(fb.rank), 0) + 1 INTO next_rank
  FROM public.favorite_beaches fb
  WHERE fb.user_id = current_user_id;

  INSERT INTO public.custom_spots (
    user_id,
    name,
    lat,
    lon,
    break_type,
    visibility,
    nearest_beach_id,
    nearest_beach_distance_mi
  )
  VALUES (
    current_user_id,
    trimmed_name,
    p_lat,
    p_lon,
    p_break_type,
    'private',
    nearest_id,
    nearest_distance_miles
  )
  RETURNING * INTO inserted_spot;

  INSERT INTO public.favorite_beaches (
    user_id,
    beach_id,
    custom_spot_id,
    rank,
    alerts_enabled
  )
  VALUES (
    current_user_id,
    NULL,
    inserted_spot.id,
    next_rank,
    false
  )
  RETURNING favorite_beaches.id, favorite_beaches.rank
  INTO favorite_id, favorite_rank;

  id := inserted_spot.id;
  user_id := inserted_spot.user_id;
  name := inserted_spot.name;
  lat := inserted_spot.lat;
  lon := inserted_spot.lon;
  break_type := inserted_spot.break_type;
  visibility := inserted_spot.visibility;
  nearest_beach_id := inserted_spot.nearest_beach_id;
  nearest_beach_distance_mi := inserted_spot.nearest_beach_distance_mi;
  deleted_at := inserted_spot.deleted_at;
  created_at := inserted_spot.created_at;
  updated_at := inserted_spot.updated_at;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_custom_spot_guarded(text, double precision, double precision, text, text)
  TO authenticated;

COMMIT;
