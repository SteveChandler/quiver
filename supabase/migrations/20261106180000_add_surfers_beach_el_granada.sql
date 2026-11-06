-- Add Surfers Beach, the beach break at the south jetty of Pillar Point Harbor in El Granada.
-- A new user searched the session-log spot picker on 2026-10-28 with queries of 4 to 15
-- characters ("Princeton Jetty" is 15) and then 5 to 8 characters, and got nothing. He
-- confirmed by email on 2026-11-06 that he wanted "the Princeton Jetty aka Surfers Beach in
-- El Granada". Native spot search matches beach names only, so the name carries all three
-- terms. Searchable catalog row only: SEO, recommendations and terrain stay disabled until
-- scoring inputs and live forecast behavior are reviewed.
-- Evidence: .planning/evidence/2026-11-06-surfers-beach-el-granada/README.md
BEGIN;

CREATE TEMP TABLE _surfers_beach_el_granada (
  id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL,
  city text NOT NULL, state text NOT NULL, region text NOT NULL,
  timezone text NOT NULL, lat double precision NOT NULL, lon double precision NOT NULL,
  break_type text NOT NULL, description text NOT NULL, access_tips text NOT NULL,
  hazards text[] NOT NULL, editorial_sources jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO _surfers_beach_el_granada VALUES
  ('73cfa55c-0708-533b-b8c8-9af6db7bc7b2', 'Surfers Beach / Princeton Jetty (El Granada)', 'surfers-beach-el-granada-ca',
   'El Granada', 'CA', 'San Francisco', 'America/Los_Angeles', 37.4994, -122.4715, 'beach',
   'Surfers Beach, also called Princeton Jetty, starts at the south jetty of Pillar Point Harbor in El Granada, across Highway 1 from town and about 3 miles north of Half Moon Bay. It is a sandy beach break with rights and lefts. The main peak sits closest to the jetty and crowds easily. The beach further from the jetty is quieter and suits newer surfers, and several surf schools work nearby.',
   'Free parking is along the side of Highway 1 near the RV park and at Pillar Point Harbor. Public restrooms are at the harbor boat launch ramp, a short walk from the beach.',
   ARRAY['Rip currents','Sneaker waves','Waves reach the highway riprap at high tide','Crowded main peak by the jetty']::text[],
   '[{"url":"https://www.visithalfmoonbay.org/places/surfers-beach/","publisher":"Visit Half Moon Bay","retrievedAt":"2026-11-06","fields":["identity","skill","crowds","hazards","surf_schools"]},{"url":"https://www.pacificbeachcoalition.org/take-action/monthly-adopt-a-beach-cleanups/surfers-beach-and-bluff/","publisher":"Pacific Beach Coalition","retrievedAt":"2026-11-06","fields":["identity","jetty","tide","access","parking","restrooms"]},{"url":"https://en.wannasurf.com/spot/North_America/USA/California/SF_Marin/el_granada/","publisher":"Wannasurf","retrievedAt":"2026-11-06","fields":["identity","break_type","bottom","direction","crowds"]},{"url":"https://www.mondo.surf/surf-spot/princeton-breakwater/guide/10985","publisher":"Mondo Surf","retrievedAt":"2026-11-06","fields":["identity","alias_princeton","coordinate_reference","peak_by_jetty","beginner_area"],"verification":"Lists Princeton Breakwater at 37.50068,-122.47103, at the shore by the jetty, about 145 m from the selected pin."},{"url":"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-122.4750%2C37.4970%2C-122.4670%2C37.5020&bboxSR=4326&imageSR=4326&size=1000%2C625&format=png&f=image","publisher":"Esri World Imagery","retrievedAt":"2026-11-06","fields":["lat","lon","pin_meaning"],"verification":"Pin is nearshore water about 185 m south of the jetty root, just outside the whitewater of the jetty peak."}]'::jsonb);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM _surfers_beach_el_granada p JOIN public.beaches b
    ON b.id <> p.id AND (lower(b.name) = lower(p.name) OR lower(b.slug) = lower(p.slug))
  ) THEN RAISE EXCEPTION 'Surfers Beach import conflicts with existing name or slug'; END IF;
  IF EXISTS (
    SELECT 1 FROM _surfers_beach_el_granada p JOIN public.beaches b USING (id)
    WHERE b.name IS DISTINCT FROM p.name OR b.slug IS DISTINCT FROM p.slug
       OR b.lat IS DISTINCT FROM p.lat OR b.lon IS DISTINCT FROM p.lon
       OR b.deleted_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'Surfers Beach import UUID identity or coordinate conflict'; END IF;
  -- A catalog row this close would be the same break under another name; stop rather than
  -- duplicate it. Private custom spots are user-owned and do not count.
  IF EXISTS (
    SELECT 1 FROM _surfers_beach_el_granada p JOIN public.beaches b
      ON b.id NOT IN (SELECT id FROM _surfers_beach_el_granada)
    WHERE b.deleted_at IS NULL AND NOT coalesce(b.is_private, false) AND b.lat IS NOT NULL AND b.lon IS NOT NULL
      AND sqrt(power((b.lat - p.lat) * 111320, 2)
             + power((b.lon - p.lon) * 111320 * cos(radians(p.lat)), 2)) < 300
  ) THEN RAISE EXCEPTION 'Surfers Beach import has an existing beach within 300 m'; END IF;
END $$;

INSERT INTO public.beaches (
  id,name,slug,city,state,country,region,timezone,lat,lon,break_type,
  description,access_tips,hazards,warnings,editorial_sources,editorial_reviewed_at,
  seo_indexable,recommendation_eligible,is_private,terrain_enabled
)
SELECT id,name,slug,city,state,'USA',region,timezone,lat,lon,break_type,
  description,access_tips,hazards,hazards,editorial_sources,'2026-11-06T00:00:00Z'::timestamptz,
  false,false,false,false
FROM _surfers_beach_el_granada p
WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = p.id);

INSERT INTO public.beach_sources (beach_id, forecast_source_id)
SELECT id, 'open_meteo' FROM _surfers_beach_el_granada
ON CONFLICT (beach_id) DO NOTHING;

DO $$
DECLARE n integer; source_n integer; promoted_n integer;
BEGIN
  SELECT count(*) INTO n FROM public.beaches WHERE id IN (SELECT id FROM _surfers_beach_el_granada);
  SELECT count(*) INTO source_n FROM public.beach_sources
  WHERE beach_id IN (SELECT id FROM _surfers_beach_el_granada) AND forecast_source_id = 'open_meteo';
  SELECT count(*) INTO promoted_n FROM public.beaches
  WHERE id IN (SELECT id FROM _surfers_beach_el_granada)
    AND (seo_indexable OR recommendation_eligible OR terrain_enabled);
  IF n <> 1 OR source_n <> 1 OR promoted_n <> 0 THEN
    RAISE EXCEPTION 'Surfers Beach validation failed: beaches %, sources %, promoted %', n, source_n, promoted_n;
  END IF;
END $$;

COMMIT;
