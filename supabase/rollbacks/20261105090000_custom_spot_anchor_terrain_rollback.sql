-- Rollback for 20261105090000_custom_spot_anchor_terrain.sql.
-- The table holds only derived terrain the worker can recompute, so dropping
-- it loses nothing. Deploy code without the anchor-terrain read first, or
-- discovery logs a query error and skips the adjustment for those spots.

BEGIN;
DROP TABLE IF EXISTS public.custom_spot_anchor_terrain;
COMMIT;
