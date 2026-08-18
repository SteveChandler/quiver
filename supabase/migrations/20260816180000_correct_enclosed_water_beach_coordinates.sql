-- UNAPPLIED FORWARD MIGRATION (2026-08-16)
--
-- Second coordinate pass: beaches recorded in the WRONG water.
--
-- The 2026-08-16 audit (migration 20260816120000) only asked "is this point
-- near water". Ponto passed it at 0m — because its stored point sits in
-- Batiquitos Lagoon, 560m inland of the surf. Being in water is not being in
-- the ocean, and a tidal lagoon defeats every proximity test: nearest-water,
-- endpoint sampling at +1km/+3km, and continuous-path sampling all pass,
-- because the lagoon connects to the sea.
--
-- What does separate them is walking outward and taking the OUTERMOST
-- continuous water run of at least 1km. Inland points read land -> ocean;
-- lagoon points read water -> sandbar -> ocean. Both resolve to the start of
-- the final long run, which is the ocean shoreline.
--
-- 35 candidates were produced that way. Every one was rendered as a
-- before/after map and reviewed by eye. 26 are applied here.
--
-- 9 are deliberately excluded because the correction lands in enclosed water
-- or could not be resolved. These need someone who knows the spots:
--   doran-beach-bodega-bay-ca      into Bodega Bay
--   newport-56th-st                toward Newport Harbour
--   3rd-avenue-jetty-belmar-nj     into Shark River
--   florence-south-jetty           into the Siuslaw River
--   bolinas-bolinas-ca             into Bolinas Lagoon
--   higgins-beach-scarborough-me   toward a river mouth
--   scarborough-beach-scarborough-me, surf-city-surf-city-nc, kalapaki-beach
--     no continuous ocean run >= 1km within 3.5km
--
-- Reuses beach_coordinate_corrections from 20260816120000 for rollback.

BEGIN;

CREATE TEMP TABLE _coord_fix2 (beach_id uuid PRIMARY KEY, new_lat double precision, new_lon double precision) ON COMMIT DROP;

INSERT INTO _coord_fix2 (beach_id, new_lat, new_lon) VALUES
  ('badd7986-4609-421a-ab3d-81fcd8409a5b'::uuid, 33.0862, -117.313404),
  ('0e7a0a9f-3a0b-44a2-b81c-43a6f7b2a203'::uuid, 35.177632, -120.733644),
  ('f2cc331f-6569-40d9-a98b-9f50fb3da67f'::uuid, 37.596743, -122.505874),
  ('f5eec6e8-844a-41be-b3bf-4c47e0615545'::uuid, 29.064681, -80.907126),
  ('23554d2f-cf2b-487c-8e38-45d19ec785b5'::uuid, 34.034786, -77.889933),
  ('1376c3e3-d7b2-408d-b1d4-e6e004cbe063'::uuid, 33.951935, -118.449339),
  ('c03fc6d7-913e-4c99-b1f4-610d036b3cbf'::uuid, 47.877346, -124.596393),
  ('66ef3c08-a8a2-4cf1-9361-273489bac45b'::uuid, 33.670524, -118.023208),
  ('124c7751-a232-4c92-be53-3a750a315256'::uuid, 35.105, -120.632737),
  ('99c6a506-e4b7-42e4-be2d-c3afb303c22e'::uuid, 21.266535, -157.822671),
  ('cf59e55d-f146-4a72-8daf-5781a0693d13'::uuid, 45.202097, -123.971333),
  ('9a3da3b5-e25b-45a4-b9dd-3ba6bc75a9fa'::uuid, 33.787923, -118.417172),
  ('c778cc0a-2094-4649-84cd-4c38ce864f23'::uuid, 38.969028, -123.718613),
  ('047e61b4-b4a8-4042-a290-f2189b5a70ca'::uuid, 33.439185, -117.643804),
  ('9c6bdc37-68c3-4101-9c2f-d188384528b6'::uuid, 29.064008, -80.907025),
  ('7e7b38b1-767f-4213-9314-538f51ab5084'::uuid, 40.583336, -73.811233),
  ('4d6c17f9-5fd9-40d6-b9c3-cd0e25ce5bcb'::uuid, 40.195704, -74.005955),
  ('b29821f9-c91a-486f-981b-7085c6d86b68'::uuid, 32.6785, -117.177977),
  ('5a34b2ac-01b9-4b83-8c05-c47b1b55d923'::uuid, 32.99876, -117.278036),
  ('84d3468b-c1ec-46ad-8621-d8507e5f167a'::uuid, 32.6809, -117.182242),
  ('a17f4c57-324d-4157-a641-fa935464302e'::uuid, 34.460127, -120.075505),
  ('836f218a-9471-46c9-b201-24da1dfe0f3a'::uuid, 34.019076, -118.82926),
  ('872fdb8c-6e6b-459e-813c-e8fc6a9561bd'::uuid, 35.926163, -75.603916),
  ('4194e543-a87e-46ee-b317-56c5820c5567'::uuid, 34.457326, -120.023839),
  ('1a7ac53d-f3ac-4f78-a89a-8befb2fa69b7'::uuid, 40.581532, -73.818325),
  ('eb18d122-5d15-4239-9eb5-eca0392b4c4b'::uuid, 40.1465, -74.021769);

INSERT INTO public.beach_coordinate_corrections
  (beach_id, slug, old_lat, old_lon, new_lat, new_lon, reason)
SELECT b.id, b.slug, b.lat, b.lon, f.new_lat, f.new_lon,
       'enclosed-water-audit-2026-08-16: moved from lagoon/inland to the outermost ocean shoreline, visually reviewed'
FROM public.beaches b
JOIN _coord_fix2 f ON f.beach_id = b.id
WHERE b.lat IS DISTINCT FROM f.new_lat OR b.lon IS DISTINCT FROM f.new_lon;

UPDATE public.beaches b
SET lat = f.new_lat,
    lon = f.new_lon
FROM _coord_fix2 f
WHERE f.beach_id = b.id
  AND (b.lat IS DISTINCT FROM f.new_lat OR b.lon IS DISTINCT FROM f.new_lon);

COMMIT;

-- ROLLBACK (run manually if these corrections need to be undone):
--
-- BEGIN;
-- UPDATE public.beaches b
-- SET lat = c.old_lat, lon = c.old_lon
-- FROM public.beach_coordinate_corrections c
-- WHERE c.beach_id = b.id
--   AND c.reason LIKE 'enclosed-water-audit-2026-08-16%';
-- DELETE FROM public.beach_coordinate_corrections
-- WHERE reason LIKE 'enclosed-water-audit-2026-08-16%';
-- COMMIT;
