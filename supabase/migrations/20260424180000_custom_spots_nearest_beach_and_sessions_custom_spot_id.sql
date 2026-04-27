-- Applied via MCP 2026-04-24 on prod (project vawdnbbgawichorsjiwe).
--
-- Custom spots now denormalize nearest_beach_id (resolved via haversine at
-- insert time) so sessions continue to write beach_id and participate in
-- beach-scoped triggers (forecast snapshot, beach affinity, ML training).
-- Also adds deleted_at for soft-hide (user-facing delete = set deleted_at).
--
-- Sessions gain custom_spot_id to label the row without removing beach_id.
-- beach_id stays NOT NULL — no trigger rewrites, no CHECK constraint needed.

BEGIN;

-- Create custom_spots if missing (the table was originally provisioned on
-- prod via MCP without a migration; this CREATE backfills local dev so
-- `supabase db reset` reproduces prod schema).
CREATE TABLE IF NOT EXISTS public.custom_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  lat numeric NOT NULL CHECK (lat >= -90 AND lat <= 90),
  lon numeric NOT NULL CHECK (lon >= -180 AND lon <= 180),
  break_type text CHECK (break_type IS NULL OR break_type = ANY (ARRAY['reef','point','beach','rivermouth','jetty'])),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility = ANY (ARRAY['private','public'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_spots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY custom_spots_select_own_or_public ON public.custom_spots
    FOR SELECT USING (user_id = auth.uid() OR visibility = 'public');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY custom_spots_insert_own ON public.custom_spots
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY custom_spots_update_own ON public.custom_spots
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY custom_spots_delete_own ON public.custom_spots
    FOR DELETE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.custom_spots
  ADD COLUMN IF NOT EXISTS nearest_beach_id uuid REFERENCES public.beaches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nearest_beach_distance_mi numeric(5,2),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS custom_spots_nearest_beach_id_idx
  ON public.custom_spots (nearest_beach_id)
  WHERE nearest_beach_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS custom_spots_active_idx
  ON public.custom_spots (user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS custom_spot_id uuid REFERENCES public.custom_spots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_custom_spot_id_idx
  ON public.sessions (custom_spot_id)
  WHERE custom_spot_id IS NOT NULL;

COMMIT;
