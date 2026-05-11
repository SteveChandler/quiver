-- Custom spot favorites extend the existing favorite_beaches table so the
-- Saved surface can contain curated beaches and user-owned custom spots.

BEGIN;

ALTER TABLE public.favorite_beaches
  ADD COLUMN IF NOT EXISTS custom_spot_id uuid REFERENCES public.custom_spots(id) ON DELETE CASCADE;

ALTER TABLE public.favorite_beaches
  ALTER COLUMN beach_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'favorite_beaches_exactly_one_target'
      AND conrelid = 'public.favorite_beaches'::regclass
  ) THEN
    ALTER TABLE public.favorite_beaches
      ADD CONSTRAINT favorite_beaches_exactly_one_target
      CHECK ((beach_id IS NOT NULL) <> (custom_spot_id IS NOT NULL));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'favorite_beaches_custom_alerts_disabled'
      AND conrelid = 'public.favorite_beaches'::regclass
  ) THEN
    ALTER TABLE public.favorite_beaches
      ADD CONSTRAINT favorite_beaches_custom_alerts_disabled
      CHECK (custom_spot_id IS NULL OR alerts_enabled = false);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS favorite_beaches_unique_beach
  ON public.favorite_beaches (user_id, beach_id)
  WHERE beach_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS favorite_beaches_unique_custom_spot
  ON public.favorite_beaches (user_id, custom_spot_id)
  WHERE custom_spot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_favorite_beaches_custom_spot_id
  ON public.favorite_beaches (custom_spot_id)
  WHERE custom_spot_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.toggle_favorite_spot_guarded(
  p_beach_id uuid DEFAULT NULL,
  p_custom_spot_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  existing_id uuid;
  favorite_count integer;
  next_rank integer;
  has_unlimited_favorites boolean;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF (p_beach_id IS NULL) = (p_custom_spot_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_favorite_target'
      USING DETAIL = 'exactly_one_target_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(current_user_id::text)::bigint);

  IF p_custom_spot_id IS NOT NULL THEN
    PERFORM 1
    FROM public.custom_spots cs
    WHERE cs.id = p_custom_spot_id
      AND cs.user_id = current_user_id
      AND cs.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'custom_spot_not_found'
        USING DETAIL = 'custom_spot_not_owned_or_deleted';
    END IF;

    SELECT id INTO existing_id
    FROM public.favorite_beaches
    WHERE user_id = current_user_id
      AND custom_spot_id = p_custom_spot_id
    LIMIT 1;
  ELSE
    SELECT id INTO existing_id
    FROM public.favorite_beaches
    WHERE user_id = current_user_id
      AND beach_id = p_beach_id
    LIMIT 1;
  END IF;

  IF existing_id IS NOT NULL THEN
    DELETE FROM public.favorite_beaches
    WHERE id = existing_id
      AND user_id = current_user_id;
    RETURN 'removed';
  END IF;

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
  FROM public.favorite_beaches
  WHERE user_id = current_user_id;

  IF NOT has_unlimited_favorites AND favorite_count >= 3 THEN
    RAISE EXCEPTION 'favorite_quota_exceeded'
      USING DETAIL = 'free_favorites_limit';
  END IF;

  SELECT COALESCE(max(rank), 0) + 1 INTO next_rank
  FROM public.favorite_beaches
  WHERE user_id = current_user_id;

  INSERT INTO public.favorite_beaches (
    user_id,
    beach_id,
    custom_spot_id,
    rank,
    alerts_enabled
  )
  VALUES (
    current_user_id,
    p_beach_id,
    p_custom_spot_id,
    next_rank,
    false
  );

  RETURN 'added';
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_favorite_beach_guarded(p_beach_id uuid)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.toggle_favorite_spot_guarded(p_beach_id, NULL::uuid);
$$;

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
  FROM public.favorite_beaches
  WHERE user_id = current_user_id;

  IF NOT has_unlimited_favorites AND favorite_count >= 3 THEN
    RAISE EXCEPTION 'favorite_quota_exceeded'
      USING DETAIL = 'free_favorites_limit';
  END IF;

  SELECT COALESCE(max(rank), 0) + 1 INTO next_rank
  FROM public.favorite_beaches
  WHERE user_id = current_user_id;

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

CREATE OR REPLACE FUNCTION public.remove_custom_spot_favorite_on_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.favorite_beaches
    WHERE custom_spot_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS remove_custom_spot_favorite_on_soft_delete
  ON public.custom_spots;

CREATE TRIGGER remove_custom_spot_favorite_on_soft_delete
  AFTER UPDATE OF deleted_at ON public.custom_spots
  FOR EACH ROW
  EXECUTE FUNCTION public.remove_custom_spot_favorite_on_soft_delete();

GRANT EXECUTE ON FUNCTION public.toggle_favorite_spot_guarded(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_favorite_beach_guarded(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_custom_spot_guarded(text, double precision, double precision, text, text)
  TO authenticated, service_role;

COMMIT;
