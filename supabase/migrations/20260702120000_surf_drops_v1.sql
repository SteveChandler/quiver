BEGIN;

-- Surf Drops V1: planned surf pins with private custom-pin teasers, durable
-- link grants, public amenity provenance, and dormant QR-activated venues.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'surf_drop_audience'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.surf_drop_audience AS ENUM ('mutuals', 'friends', 'link', 'private');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.generate_surf_drop_slug()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea := gen_random_bytes(10);
  result text := '';
  i integer;
BEGIN
  FOR i IN 0..9 LOOP
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  END LOOP;

  RETURN result;
END;
$$;

CREATE TABLE IF NOT EXISTS public.surf_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_slug text NOT NULL UNIQUE DEFAULT public.generate_surf_drop_slug(),
  location_type text NOT NULL,
  beach_id uuid NULL REFERENCES public.beaches(id) ON DELETE SET NULL,
  custom_lat double precision NULL,
  custom_lon double precision NULL,
  general_area text NULL,
  exact_label text NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  audience public.surf_drop_audience NOT NULL DEFAULT 'mutuals',
  note text NULL,
  forecast_snapshot jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz NULL,
  deleted_at timestamptz NULL,
  CONSTRAINT surf_drops_slug_format CHECK (share_slug ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$'),
  CONSTRAINT surf_drops_location_type CHECK (location_type IN ('known_spot', 'custom_pin')),
  CONSTRAINT surf_drops_time_window CHECK (ends_at > starts_at),
  CONSTRAINT surf_drops_min_duration CHECK (ends_at >= starts_at + interval '15 minutes'),
  CONSTRAINT surf_drops_max_ahead CHECK (starts_at <= now() + interval '4 days'),
  CONSTRAINT surf_drops_note_length CHECK (note IS NULL OR char_length(note) <= 240),
  CONSTRAINT surf_drops_custom_lat_range CHECK (custom_lat IS NULL OR custom_lat BETWEEN -90 AND 90),
  CONSTRAINT surf_drops_custom_lon_range CHECK (custom_lon IS NULL OR custom_lon BETWEEN -180 AND 180),
  CONSTRAINT surf_drops_location CHECK (
    (location_type = 'known_spot' AND beach_id IS NOT NULL AND custom_lat IS NULL AND custom_lon IS NULL) OR
    (location_type = 'custom_pin' AND beach_id IS NULL AND custom_lat IS NOT NULL AND custom_lon IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS surf_drops_slug_idx
  ON public.surf_drops (share_slug);

CREATE INDEX IF NOT EXISTS surf_drops_active_ends_idx
  ON public.surf_drops (ends_at)
  WHERE deleted_at IS NULL AND cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS surf_drops_user_idx
  ON public.surf_drops (user_id);

CREATE INDEX IF NOT EXISTS surf_drops_beach_idx
  ON public.surf_drops (beach_id)
  WHERE beach_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.surf_drop_participants (
  drop_id uuid NOT NULL REFERENCES public.surf_drops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz NULL,
  PRIMARY KEY (drop_id, user_id)
);

CREATE INDEX IF NOT EXISTS surf_drop_participants_user_idx
  ON public.surf_drop_participants (user_id);

CREATE INDEX IF NOT EXISTS surf_drop_participants_active_idx
  ON public.surf_drop_participants (drop_id, joined_at)
  WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS public.surf_drop_link_grants (
  drop_id uuid NOT NULL REFERENCES public.surf_drops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (drop_id, user_id)
);

CREATE INDEX IF NOT EXISTS surf_drop_link_grants_user_idx
  ON public.surf_drop_link_grants (user_id);

CREATE TABLE IF NOT EXISTS public.amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amenity_type text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  geog geography(point, 4326)
    GENERATED ALWAYS AS (
      ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
    ) STORED,
  label text NULL,
  source text NOT NULL,
  source_ref text NULL,
  confidence smallint NOT NULL DEFAULT 50,
  verified_at timestamptz NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb NULL,
  CONSTRAINT amenities_type_check CHECK (
    amenity_type IN (
      'parking_free',
      'parking_paid',
      'restrooms',
      'showers',
      'lifeguard',
      'beach_access',
      'ada_access',
      'stairs',
      'path',
      'water_fountain',
      'bike_parking',
      'transit_stop',
      'trash',
      'first_aid',
      'phone',
      'pier',
      'boat_ramp'
    )
  ),
  CONSTRAINT amenities_lat_range CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT amenities_lon_range CHECK (lon BETWEEN -180 AND 180),
  CONSTRAINT amenities_confidence_range CHECK (confidence BETWEEN 0 AND 100),
  CONSTRAINT amenities_source_check CHECK (source IN ('osm', 'seed', 'user'))
);

CREATE INDEX IF NOT EXISTS amenities_geog_idx
  ON public.amenities USING gist (geog);

CREATE INDEX IF NOT EXISTS amenities_bbox_idx
  ON public.amenities (lon, lat);

CREATE INDEX IF NOT EXISTS amenities_type_idx
  ON public.amenities (amenity_type);

CREATE UNIQUE INDEX IF NOT EXISTS amenities_source_ref_uidx
  ON public.amenities (source, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.qr_business_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  qr_scan_count integer NOT NULL DEFAULT 0,
  activation_threshold integer NOT NULL DEFAULT 3,
  claimed_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at timestamptz NULL,
  admin_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qr_business_venues_lat_range CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT qr_business_venues_lon_range CHECK (lon BETWEEN -180 AND 180),
  CONSTRAINT qr_business_venues_scan_count_check CHECK (qr_scan_count >= 0),
  CONSTRAINT qr_business_venues_activation_threshold_check CHECK (activation_threshold > 0)
);

CREATE INDEX IF NOT EXISTS qr_business_venues_bbox_idx
  ON public.qr_business_venues (lon, lat);

CREATE INDEX IF NOT EXISTS qr_business_venues_public_visible_idx
  ON public.qr_business_venues (activated_at, admin_visible);

CREATE OR REPLACE FUNCTION public.set_surf_drops_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_mutual_follow(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    a IS NOT NULL
    AND b IS NOT NULL
    AND a <> b
    AND EXISTS (
      SELECT 1
      FROM public.user_follows uf
      WHERE uf.follower_id = a
        AND uf.following_id = b
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_follows uf
      WHERE uf.follower_id = b
        AND uf.following_id = a
    );
$$;

CREATE OR REPLACE FUNCTION public.has_user_block_between(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a IS NOT NULL
    AND b IS NOT NULL
    AND a <> b
    AND EXISTS (
      SELECT 1
      FROM public.user_blocks ub
      WHERE (ub.blocker_id = a AND ub.blocked_id = b)
         OR (ub.blocker_id = b AND ub.blocked_id = a)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_surf_drop(p_drop_id uuid, p_viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.surf_drops d
    WHERE d.id = p_drop_id
      AND p_viewer IS NOT NULL
      AND d.deleted_at IS NULL
      AND NOT public.has_user_block_between(p_viewer, d.user_id)
      AND (
        d.user_id = p_viewer
        OR EXISTS (
          SELECT 1
          FROM public.surf_drop_link_grants lg
          WHERE lg.drop_id = d.id
            AND lg.user_id = p_viewer
        )
        OR EXISTS (
          SELECT 1
          FROM public.surf_drop_participants p
          WHERE p.drop_id = d.id
            AND p.user_id = p_viewer
            AND p.left_at IS NULL
        )
        OR (
          d.audience IN ('mutuals', 'friends')
          AND public.is_mutual_follow(p_viewer, d.user_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.activate_qr_business_venue_on_scan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.qr_scan_count >= NEW.activation_threshold AND NEW.activated_at IS NULL THEN
    NEW.activated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS surf_drops_set_updated_at ON public.surf_drops;
CREATE TRIGGER surf_drops_set_updated_at
  BEFORE UPDATE ON public.surf_drops
  FOR EACH ROW
  EXECUTE FUNCTION public.set_surf_drops_updated_at();

DROP TRIGGER IF EXISTS qr_business_venues_activate_on_scan ON public.qr_business_venues;
CREATE TRIGGER qr_business_venues_activate_on_scan
  BEFORE UPDATE OF qr_scan_count ON public.qr_business_venues
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_qr_business_venue_on_scan();

ALTER TABLE public.surf_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surf_drop_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surf_drop_link_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_business_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS surf_drops_select_visible ON public.surf_drops;
CREATE POLICY surf_drops_select_visible
  ON public.surf_drops
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.can_view_surf_drop(id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS surf_drops_insert_own ON public.surf_drops;
CREATE POLICY surf_drops_insert_own
  ON public.surf_drops
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS surf_drops_update_own ON public.surf_drops;
CREATE POLICY surf_drops_update_own
  ON public.surf_drops
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS surf_drops_delete_own ON public.surf_drops;
CREATE POLICY surf_drops_delete_own
  ON public.surf_drops
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS surf_drop_participants_select_visible ON public.surf_drop_participants;
CREATE POLICY surf_drop_participants_select_visible
  ON public.surf_drop_participants
  FOR SELECT
  TO authenticated
  USING (public.can_view_surf_drop(drop_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS surf_drop_participants_insert_visible_active ON public.surf_drop_participants;
CREATE POLICY surf_drop_participants_insert_visible_active
  ON public.surf_drop_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.surf_drops d
      WHERE d.id = drop_id
        AND d.deleted_at IS NULL
        AND d.cancelled_at IS NULL
        AND d.ends_at > now()
        AND public.can_view_surf_drop(d.id, (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS surf_drop_participants_update_own ON public.surf_drop_participants;
CREATE POLICY surf_drop_participants_update_own
  ON public.surf_drop_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS surf_drop_participants_delete_own ON public.surf_drop_participants;
CREATE POLICY surf_drop_participants_delete_own
  ON public.surf_drop_participants
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS surf_drop_link_grants_select_own ON public.surf_drop_link_grants;
CREATE POLICY surf_drop_link_grants_select_own
  ON public.surf_drop_link_grants
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS surf_drop_link_grants_insert_service_role ON public.surf_drop_link_grants;
CREATE POLICY surf_drop_link_grants_insert_service_role
  ON public.surf_drop_link_grants
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS surf_drop_link_grants_delete_service_role ON public.surf_drop_link_grants;
CREATE POLICY surf_drop_link_grants_delete_service_role
  ON public.surf_drop_link_grants
  FOR DELETE
  TO service_role
  USING (true);

DROP POLICY IF EXISTS amenities_select_public ON public.amenities;
CREATE POLICY amenities_select_public
  ON public.amenities
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS amenities_insert_service_role ON public.amenities;
CREATE POLICY amenities_insert_service_role
  ON public.amenities
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS amenities_update_service_role ON public.amenities;
CREATE POLICY amenities_update_service_role
  ON public.amenities
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS amenities_delete_service_role ON public.amenities;
CREATE POLICY amenities_delete_service_role
  ON public.amenities
  FOR DELETE
  TO service_role
  USING (true);

DROP POLICY IF EXISTS qr_business_venues_select_public_active ON public.qr_business_venues;
CREATE POLICY qr_business_venues_select_public_active
  ON public.qr_business_venues
  FOR SELECT
  TO anon, authenticated
  USING (activated_at IS NOT NULL OR admin_visible = true);

DROP POLICY IF EXISTS qr_business_venues_insert_service_role ON public.qr_business_venues;
CREATE POLICY qr_business_venues_insert_service_role
  ON public.qr_business_venues
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS qr_business_venues_update_service_role ON public.qr_business_venues;
CREATE POLICY qr_business_venues_update_service_role
  ON public.qr_business_venues
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS qr_business_venues_delete_service_role ON public.qr_business_venues;
CREATE POLICY qr_business_venues_delete_service_role
  ON public.qr_business_venues
  FOR DELETE
  TO service_role
  USING (true);

REVOKE ALL ON TABLE public.surf_drops FROM anon;
REVOKE ALL ON TABLE public.surf_drop_participants FROM anon;
REVOKE ALL ON TABLE public.surf_drop_link_grants FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.surf_drops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.surf_drop_participants TO authenticated;
GRANT SELECT ON TABLE public.surf_drop_link_grants TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.surf_drop_link_grants TO service_role;
GRANT USAGE ON TYPE public.surf_drop_audience TO authenticated, service_role;
GRANT SELECT ON TABLE public.amenities TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.amenities TO service_role;
GRANT SELECT ON TABLE public.qr_business_venues TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.qr_business_venues TO service_role;

REVOKE ALL ON FUNCTION public.has_user_block_between(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_surf_drop(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_surf_drop_slug() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_mutual_follow(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_user_block_between(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_surf_drop(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_surf_drop_slug() TO authenticated, service_role;

COMMENT ON TABLE public.surf_drops IS
  'Surf Drops V1 planned surf pins. user_id is the auth user who created the drop; API payloads expose that actor as creator.';

COMMENT ON TABLE public.surf_drop_link_grants IS
  'Persistent per-user access grants created when a signed-in user claims a unique Surf Drop link.';

COMMENT ON TABLE public.amenities IS
  'Public, provenance-labeled beach amenities from open or seeded sources.';

COMMENT ON TABLE public.qr_business_venues IS
  'QR-activated venue pins. Public map visibility is gated by activated_at or admin_visible; no broad business seeding.';

COMMIT;
