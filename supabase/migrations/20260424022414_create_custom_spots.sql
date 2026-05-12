-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Custom spots — user-authored surf breaks that don't exist in the curated
-- beaches table. Closes the "stranded log" defection blocker from Lazy Surfer:
-- users can pin a secret break, name it, tag break type, and save under their
-- private quiver. Forecast is raw NOAA gridpoint at the pin (approximate).
--
-- Visibility: 'private' (default) means only the owner sees it; 'public' lets
-- other users within 5 mi discover it via map (UI surface ships in a later PR).
--
-- RLS: owner can read/insert/update/delete their rows; everyone can read public
-- rows. No service-role write path needed — custom spots are user-authored.

CREATE TABLE IF NOT EXISTS public.custom_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat NUMERIC(9, 6) NOT NULL,
  lon NUMERIC(9, 6) NOT NULL,
  break_type TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT custom_spots_name_length CHECK (char_length(name) BETWEEN 1 AND 60),
  CONSTRAINT custom_spots_lat_range CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT custom_spots_lon_range CHECK (lon BETWEEN -180 AND 180),
  CONSTRAINT custom_spots_break_type CHECK (
    break_type IS NULL
    OR break_type IN ('reef', 'point', 'beach', 'rivermouth', 'jetty')
  ),
  CONSTRAINT custom_spots_visibility CHECK (visibility IN ('private', 'public'))
);

COMMENT ON TABLE public.custom_spots IS
  'User-authored surf breaks not present in the curated beaches table. '
  'Forecast is raw NOAA gridpoint at the pin (approximate). '
  'Visibility: private (owner-only) or public (discoverable within 5 mi, UI pending).';
COMMENT ON COLUMN public.custom_spots.lat IS 'Latitude in decimal degrees, WGS-84.';
COMMENT ON COLUMN public.custom_spots.lon IS 'Longitude in decimal degrees, WGS-84.';
COMMENT ON COLUMN public.custom_spots.visibility IS
  'private = owner-only read. public = anyone-read (discovery UI lands later).';
COMMENT ON COLUMN public.custom_spots.updated_at IS
  'Auto-maintained by custom_spots_lock_user_id trigger on UPDATE.';

CREATE INDEX IF NOT EXISTS custom_spots_user_id_idx ON public.custom_spots(user_id);
CREATE INDEX IF NOT EXISTS custom_spots_created_at_idx ON public.custom_spots(created_at DESC);
CREATE INDEX IF NOT EXISTS custom_spots_public_location_idx
  ON public.custom_spots(lat, lon)
  WHERE visibility = 'public';

ALTER TABLE public.custom_spots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_spots_select_own_or_public ON public.custom_spots;
CREATE POLICY custom_spots_select_own_or_public
  ON public.custom_spots FOR SELECT
  USING (user_id = auth.uid() OR visibility = 'public');

DROP POLICY IF EXISTS custom_spots_insert_own ON public.custom_spots;
CREATE POLICY custom_spots_insert_own
  ON public.custom_spots FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS custom_spots_update_own ON public.custom_spots;
CREATE POLICY custom_spots_update_own
  ON public.custom_spots FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS custom_spots_delete_own ON public.custom_spots;
CREATE POLICY custom_spots_delete_own
  ON public.custom_spots FOR DELETE
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.custom_spots_lock_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'custom_spots.user_id is immutable after insert';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_spots_lock_user_id_trigger ON public.custom_spots;
CREATE TRIGGER custom_spots_lock_user_id_trigger
  BEFORE UPDATE ON public.custom_spots
  FOR EACH ROW
  EXECUTE FUNCTION public.custom_spots_lock_user_id();
