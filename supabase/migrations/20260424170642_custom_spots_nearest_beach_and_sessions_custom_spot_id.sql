-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Custom spots now denormalize nearest_beach_id (resolved via haversine at
-- insert time) so sessions continue to write beach_id and participate in
-- beach-scoped triggers (forecast snapshot, beach affinity, ML training).
-- Also adds deleted_at for soft-hide (user-facing delete = set deleted_at).
--
-- Sessions gain custom_spot_id to label the row without removing beach_id.
-- beach_id stays NOT NULL — no trigger rewrites, no CHECK constraint needed.

BEGIN;

ALTER TABLE public.custom_spots
  ADD COLUMN nearest_beach_id uuid REFERENCES public.beaches(id) ON DELETE SET NULL,
  ADD COLUMN nearest_beach_distance_mi numeric(5,2),
  ADD COLUMN deleted_at timestamptz;

CREATE INDEX custom_spots_nearest_beach_id_idx
  ON public.custom_spots (nearest_beach_id)
  WHERE nearest_beach_id IS NOT NULL;

CREATE INDEX custom_spots_active_idx
  ON public.custom_spots (user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.sessions
  ADD COLUMN custom_spot_id uuid REFERENCES public.custom_spots(id) ON DELETE SET NULL;

CREATE INDEX sessions_custom_spot_id_idx
  ON public.sessions (custom_spot_id)
  WHERE custom_spot_id IS NOT NULL;

COMMIT;
