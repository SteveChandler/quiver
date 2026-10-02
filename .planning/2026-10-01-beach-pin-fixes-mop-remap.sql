-- Run AFTER .planning/2026-10-02-mop-beach-mapping.sql. That approved file mapped The Wedge and Rincon from their OLD pins
-- (OC377 and VE656). Re-map them from the pins in .planning/2026-10-01-beach-pin-fixes.sql
-- (same transect rule via scripts/map-beaches-to-mop.ts).
-- Doheny Beach stays unmapped: its nearest transect point is 1982 m out, past the harbour breakwater (held, as before).
BEGIN;
UPDATE public.beaches SET mop_point_id = 'OC381', mop_shore_normal_deg = 196, mop_point_distance_m = 404
WHERE id = 'c2c7cc01-4920-4fd9-941c-68df6b46ced0' AND lat = 33.5938 AND lon = -117.8820;
UPDATE public.beaches SET mop_point_id = 'VE678', mop_shore_normal_deg = 159, mop_point_distance_m = 393
WHERE id = 'bec2d595-ed20-4c2b-93c7-4b880406332f' AND lat = 34.3729 AND lon = -119.4765;
COMMIT;
