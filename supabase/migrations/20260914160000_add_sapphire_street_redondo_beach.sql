-- Add the two Redondo Beach breaks on either side of the Topaz Street jetty: Sapphire
-- Street (north) and Knob Hill (south). A new user searched the session-log spot picker
-- for "sapphir" and "redondo beach" on 2026-09-11 and got nothing: native spot search
-- matches beach names only, and no name contained either term. Both names carry the
-- city so those searches resolve. Searchable catalog rows only: SEO, recommendations and
-- terrain stay disabled until scoring inputs and live forecast behavior are reviewed.
-- Evidence: .planning/evidence/2026-09-14-sapphire-street/README.md
BEGIN;

CREATE TEMP TABLE _redondo_jetty_beaches (
  id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL,
  city text NOT NULL, state text NOT NULL, region text NOT NULL,
  timezone text NOT NULL, lat double precision NOT NULL, lon double precision NOT NULL,
  break_type text NOT NULL, description text NOT NULL, access_tips text NOT NULL,
  hazards text[] NOT NULL, editorial_sources jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO _redondo_jetty_beaches VALUES
  ('c9ea72a3-d7bf-5f3d-b77e-1aa6cce81dee', 'Sapphire Street (Redondo Beach)', 'sapphire-street-redondo-beach-ca',
   'Redondo Beach', 'CA', 'Los Angeles', 'America/Los_Angeles', 33.8325, -118.3918, 'beach',
   'Sapphire Street is the beach break on the north side of the Topaz Street jetty, at the south end of King Harbor in Redondo Beach. It needs a west or northwest swell and is shadowed from south swells. It usually stays smaller and softer than the peaks south of the jetty, so it draws surf lessons and newer surfers.',
   'Park along the Esplanade or nearby streets and reach the sand through Topaz Street. Lifeguards are on duty during daylight hours; restrooms and showers are available along Redondo Beach.',
   ARRAY['Rip currents','Jetty rocks','Crowds and surf lessons','Poor water quality after rain']::text[],
   '[{"url":"https://www.surfline.com/surf-report/sapphire-st-/584204214e65fad6a7709d0b/spot-guide","publisher":"Surfline","retrievedAt":"2026-09-14","fields":["identity","swell","wind","tide","skill","access","bottom","water_quality"]},{"url":"https://services.surfline.com/kbyg/mapview?south=33.80&west=-118.43&north=33.86&east=-118.37","publisher":"Surfline","retrievedAt":"2026-09-14","fields":["identity","coordinate_reference"],"verification":"Listed as Sapphire St. at 33.832674,-118.39133, at the shorebreak about 45 m from the selected pin."},{"url":"https://www.surf-forecast.com/breaks/Sapphire-Street","publisher":"Surf-Forecast","retrievedAt":"2026-09-14","fields":["identity","break_type","swell","hazards"]},{"url":"https://makethetripmatter.com/redondo-beach-surf/","publisher":"Make the Trip Matter","retrievedAt":"2026-09-14","fields":["identity","skill","crowds"]},{"url":"https://beaches.lacounty.gov/redondo-beach/","publisher":"Los Angeles County Beaches & Harbors","retrievedAt":"2026-09-14","fields":["access","lifeguards","facilities"]},{"url":"https://www.openstreetmap.org/way/1452981257","publisher":"OpenStreetMap","retrievedAt":"2026-09-14","fields":["jetty_geometry"]},{"url":"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-118.3950%2C33.8300%2C-118.3890%2C33.8350&bboxSR=4326&imageSR=4326&size=1000%2C833&format=png&f=image","publisher":"Esri World Imagery","retrievedAt":"2026-09-14","fields":["lat","lon","pin_meaning"],"verification":"Jetty at 33.8319 matches OSM way 1452981257. Pin is nearshore water about 70 m north of the jetty and 65 m off the sand, outside the whitewater line."}]'::jsonb),
  ('50b0ec6c-9254-5450-9b23-90cb85997cb1', 'Knob Hill (Redondo Beach)', 'knob-hill-redondo-beach-ca',
   'Redondo Beach', 'CA', 'Los Angeles', 'America/Los_Angeles', 33.8290, -118.3922, 'beach',
   'Knob Hill is the beach break south of the Topaz Street jetty in Redondo Beach, in front of the Knob Hill Avenue beach stairs. It is faster and steeper than Sapphire Street across the jetty, with several peaks, and suits intermediate and advanced surfers, or newer surfers on small days.',
   'Use the Knob Hill beach stairs off the Esplanade. Parking is along Knob Hill Avenue and metered along the Esplanade. Lifeguards are on duty during daylight hours.',
   ARRAY['Rip currents','Shorebreak','Shallow sandbars near the jetty','Poor water quality after rain']::text[],
   '[{"url":"https://services.surfline.com/kbyg/mapview?south=33.80&west=-118.43&north=33.86&east=-118.37","publisher":"Surfline","retrievedAt":"2026-09-14","fields":["identity","coordinate_reference"],"verification":"Listed as Knob Hill at 33.82895,-118.39123, which falls on dry sand in current imagery."},{"url":"https://www.surfline.com/surf-report/sapphire-st-/584204214e65fad6a7709d0b/spot-guide","publisher":"Surfline","retrievedAt":"2026-09-14","fields":["hazards"]},{"url":"https://makethetripmatter.com/redondo-beach-surf/","publisher":"Make the Trip Matter","retrievedAt":"2026-09-14","fields":["identity","break_character","skill","parking","hazards"]},{"url":"https://beaches.lacounty.gov/redondo-beach/","publisher":"Los Angeles County Beaches & Harbors","retrievedAt":"2026-09-14","fields":["access","lifeguards"]},{"url":"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-118.3960%2C33.8265%2C-118.3900%2C33.8315&bboxSR=4326&imageSR=4326&size=1000%2C833&format=png&f=image","publisher":"Esri World Imagery","retrievedAt":"2026-09-14","fields":["lat","lon","pin_meaning"],"verification":"Surfline listing point is on dry sand. Pin moved west to nearshore water about 45 m off the wet sand, outside the whitewater, about 330 m south of the jetty."}]'::jsonb);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM _redondo_jetty_beaches p JOIN public.beaches b
    ON b.id <> p.id AND (lower(b.name) = lower(p.name) OR lower(b.slug) = lower(p.slug))
  ) THEN RAISE EXCEPTION 'Redondo jetty import conflicts with existing name or slug'; END IF;
  IF EXISTS (
    SELECT 1 FROM _redondo_jetty_beaches p JOIN public.beaches b USING (id)
    WHERE b.name IS DISTINCT FROM p.name OR b.slug IS DISTINCT FROM p.slug
       OR b.lat IS DISTINCT FROM p.lat OR b.lon IS DISTINCT FROM p.lon
       OR b.deleted_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'Redondo jetty import UUID identity or coordinate conflict'; END IF;
  -- A row this close would be the same break under another name; stop rather than duplicate it.
  IF EXISTS (
    SELECT 1 FROM _redondo_jetty_beaches p JOIN public.beaches b
      ON b.id NOT IN (SELECT id FROM _redondo_jetty_beaches)
    WHERE b.deleted_at IS NULL AND b.lat IS NOT NULL AND b.lon IS NOT NULL
      AND sqrt(power((b.lat - p.lat) * 111320, 2)
             + power((b.lon - p.lon) * 111320 * cos(radians(p.lat)), 2)) < 300
  ) THEN RAISE EXCEPTION 'Redondo jetty import has an existing beach within 300 m'; END IF;
END $$;

INSERT INTO public.beaches (
  id,name,slug,city,state,country,region,timezone,lat,lon,break_type,
  description,access_tips,hazards,warnings,editorial_sources,editorial_reviewed_at,
  seo_indexable,recommendation_eligible,is_private,terrain_enabled
)
SELECT id,name,slug,city,state,'USA',region,timezone,lat,lon,break_type,
  description,access_tips,hazards,hazards,editorial_sources,'2026-09-14T00:00:00Z'::timestamptz,
  false,false,false,false
FROM _redondo_jetty_beaches p
WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = p.id);

INSERT INTO public.beach_sources (beach_id, forecast_source_id)
SELECT id, 'open_meteo' FROM _redondo_jetty_beaches
ON CONFLICT (beach_id) DO NOTHING;

DO $$
DECLARE n integer; source_n integer; promoted_n integer;
BEGIN
  SELECT count(*) INTO n FROM public.beaches WHERE id IN (SELECT id FROM _redondo_jetty_beaches);
  SELECT count(*) INTO source_n FROM public.beach_sources
  WHERE beach_id IN (SELECT id FROM _redondo_jetty_beaches) AND forecast_source_id = 'open_meteo';
  SELECT count(*) INTO promoted_n FROM public.beaches
  WHERE id IN (SELECT id FROM _redondo_jetty_beaches)
    AND (seo_indexable OR recommendation_eligible OR terrain_enabled);
  IF n <> 2 OR source_n <> 2 OR promoted_n <> 0 THEN
    RAISE EXCEPTION 'Redondo jetty validation failed: beaches %, sources %, promoted %', n, source_n, promoted_n;
  END IF;
END $$;

COMMIT;
