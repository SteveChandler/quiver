-- Add Bolsa Chica State Beach (Huntington Beach). Users search for it and get nothing:
-- three users made their own custom spots for it ("Bolsa Chica Tower 21" twice, "Bolsa
-- chica state beach surf point"), and one tapped "missing spot" after searching "bolsa
-- chica state beach". Native spot search matches beach names only, and no catalog name
-- contains "bolsa"; the catalog has nothing between HB Cliffs and Seal Beach Pier. The
-- pin is nearshore water off Tower 21, mid-beach. Searchable catalog row only: SEO,
-- recommendations and terrain stay disabled until scoring inputs and live forecast
-- behavior are reviewed.
-- Evidence: .planning/evidence/2026-10-31-bolsa-chica/README.md
BEGIN;

CREATE TEMP TABLE _bolsa_chica_beaches (
  id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL,
  city text NOT NULL, state text NOT NULL, region text NOT NULL,
  timezone text NOT NULL, lat double precision NOT NULL, lon double precision NOT NULL,
  break_type text NOT NULL, description text NOT NULL, access_tips text NOT NULL,
  hazards text[] NOT NULL, editorial_sources jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO _bolsa_chica_beaches VALUES
  ('dd21a212-1f15-5b34-8749-8d54c44f3b25', 'Bolsa Chica State Beach', 'bolsa-chica-state-beach-huntington-beach-ca',
   'Huntington Beach', 'CA', 'Orange County', 'America/Los_Angeles', 33.6970, -118.0521, 'beach',
   'Bolsa Chica State Beach is a three-mile run of sand beach break along Pacific Coast Highway in Huntington Beach, from Seapoint Avenue north to Warner Avenue. Peaks break left and right and shift with the sandbars. It works best on a southwest groundswell with northeast offshore wind, mid tide is the usual pick, and it tends to close out once the swell gets bigger. The outside waves break slowly, so smaller days suit beginners and longboarders. This pin sits off Tower 21, near the middle of the beach.',
   'The main entrance is off Pacific Coast Highway, with paid day-use parking along the beach (cashless). The park is open 6 AM to 10 PM and entry gates close at 9 PM. Restrooms, outdoor showers and fire rings are along the beach. Lifeguards patrol year-round, and towers are staffed roughly from Memorial Day weekend through Labor Day weekend. There is no black ball here, so surfing is allowed all day. Dogs are not allowed on the sand.',
   ARRAY['Rip currents','Closeouts on bigger swells','Summer crowds','Poor water quality after rain']::text[],
   '[{"url":"https://www.parks.ca.gov/?page_id=642","publisher":"California State Parks","retrievedAt":"2026-10-31","fields":["identity","extent","access","fees","hours","lifeguards","facilities","rules"]},{"url":"https://www.surf-forecast.com/breaks/Bolsa-Chica","publisher":"Surf-Forecast","retrievedAt":"2026-10-31","fields":["identity","break_type","swell","wind","closeouts","crowds","hazards"]},{"url":"https://en.wannasurf.com/spot/North_America/USA/California/Orange_County/bolsa_chica/","publisher":"Wannasurf","retrievedAt":"2026-10-31","fields":["identity","break_type","bottom","tide","skill","crowds"]},{"url":"https://www.mondo.surf/surf-spot/bolsa-chica/guide/10863","publisher":"Mondo Surf","retrievedAt":"2026-10-31","fields":["identity","peaks","swell","wind","tide","closeouts","coordinate_reference"],"verification":"Listed at 33.696633,-118.049467, which falls on the sand by the main lot in current imagery, about 250 m from the selected pin."},{"url":"https://www.surfschool.net/blog/huntington-beaches-surf-spots","publisher":"Surf School","retrievedAt":"2026-10-31","fields":["wave_character","skill","lifeguards","black_ball"]},{"url":"https://ocbeachinfo.com/","publisher":"Orange County Health Care Agency","retrievedAt":"2026-10-31","fields":["water_quality"]},{"url":"https://www.openstreetmap.org/node/11836050631","publisher":"OpenStreetMap","retrievedAt":"2026-10-31","fields":["tower_21_location"],"verification":"Lifeguard tower ref 21 at 33.6978386,-118.0508078, mid-beach between towers 20 and 22."},{"url":"https://www.openstreetmap.org/way/157341965","publisher":"OpenStreetMap","retrievedAt":"2026-10-31","fields":["coastline_geometry"]},{"url":"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-118.0545%2C33.6955%2C-118.0485%2C33.7005&bboxSR=4326&imageSR=4326&size=1000%2C833&format=png&f=image","publisher":"Esri World Imagery","retrievedAt":"2026-10-31","fields":["lat","lon","pin_meaning"],"verification":"Pin is nearshore water about 150 m seaward of Tower 21 along the shore normal (bearing about 232 degrees), about 100 m off the OSM coastline and outside the whitewater line."}]'::jsonb);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM _bolsa_chica_beaches p JOIN public.beaches b
    ON b.id <> p.id AND (lower(b.name) = lower(p.name) OR lower(b.slug) = lower(p.slug))
  ) THEN RAISE EXCEPTION 'Bolsa Chica import conflicts with existing name or slug'; END IF;
  IF EXISTS (
    SELECT 1 FROM _bolsa_chica_beaches p JOIN public.beaches b USING (id)
    WHERE b.name IS DISTINCT FROM p.name OR b.slug IS DISTINCT FROM p.slug
       OR b.lat IS DISTINCT FROM p.lat OR b.lon IS DISTINCT FROM p.lon
       OR b.deleted_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'Bolsa Chica import UUID identity or coordinate conflict'; END IF;
  -- A row this close would be the same break under another name; stop rather than duplicate it.
  IF EXISTS (
    SELECT 1 FROM _bolsa_chica_beaches p JOIN public.beaches b
      ON b.id NOT IN (SELECT id FROM _bolsa_chica_beaches)
    WHERE b.deleted_at IS NULL AND b.lat IS NOT NULL AND b.lon IS NOT NULL
      AND sqrt(power((b.lat - p.lat) * 111320, 2)
             + power((b.lon - p.lon) * 111320 * cos(radians(p.lat)), 2)) < 300
  ) THEN RAISE EXCEPTION 'Bolsa Chica import has an existing beach within 300 m'; END IF;
END $$;

INSERT INTO public.beaches (
  id,name,slug,city,state,country,region,timezone,lat,lon,break_type,
  description,access_tips,hazards,warnings,editorial_sources,editorial_reviewed_at,
  seo_indexable,recommendation_eligible,is_private,terrain_enabled
)
SELECT id,name,slug,city,state,'USA',region,timezone,lat,lon,break_type,
  description,access_tips,hazards,hazards,editorial_sources,'2026-10-31T00:00:00Z'::timestamptz,
  false,false,false,false
FROM _bolsa_chica_beaches p
WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = p.id);

INSERT INTO public.beach_sources (beach_id, forecast_source_id)
SELECT id, 'open_meteo' FROM _bolsa_chica_beaches
ON CONFLICT (beach_id) DO NOTHING;

DO $$
DECLARE n integer; source_n integer; promoted_n integer;
BEGIN
  SELECT count(*) INTO n FROM public.beaches WHERE id IN (SELECT id FROM _bolsa_chica_beaches);
  SELECT count(*) INTO source_n FROM public.beach_sources
  WHERE beach_id IN (SELECT id FROM _bolsa_chica_beaches) AND forecast_source_id = 'open_meteo';
  SELECT count(*) INTO promoted_n FROM public.beaches
  WHERE id IN (SELECT id FROM _bolsa_chica_beaches)
    AND (seo_indexable OR recommendation_eligible OR terrain_enabled);
  IF n <> 1 OR source_n <> 1 OR promoted_n <> 0 THEN
    RAISE EXCEPTION 'Bolsa Chica validation failed: beaches %, sources %, promoted %', n, source_n, promoted_n;
  END IF;
END $$;

COMMIT;
