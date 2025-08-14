-- Seed 72 beaches (OC/SD/Baja) via guarded, idempotent upsert
-- No TRUNCATE; safe with existing FKs (e.g., profiles.default_beach_id)

BEGIN;

-- Ensure case-insensitive unique index on name
CREATE UNIQUE INDEX IF NOT EXISTS beaches_name_unique ON public.beaches (lower(name));

-- Temporary staging table for this migration
DROP TABLE IF EXISTS temp_beaches;
CREATE TEMPORARY TABLE temp_beaches (
  name text PRIMARY KEY,
  region text,
  country text,
  latitude double precision,
  longitude double precision
) ON COMMIT DROP;

-- Load inline JSON to temp_beaches
WITH raw AS (
  SELECT $json$
[
  {"name":"Huntington Beach Pier Southside","region":"Huntington Beach, CA","country":"USA","lat":33.6542,"lon":-118.0022},
  {"name":"Huntington Beach Pier Northside","region":"Huntington Beach, CA","country":"USA","lat":33.6552,"lon":-118.0022},
  {"name":"The Wedge","region":"Newport Beach, CA","country":"USA","lat":33.5939,"lon":-117.8776},
  {"name":"North HB Streets","region":"Huntington Beach, CA","country":"USA","lat":33.6805,"lon":-118.0113},
  {"name":"Huntington St.","region":"Huntington Beach, CA","country":"USA","lat":33.6514,"lon":-118.0067},
  {"name":"River Jetties","region":"Newport Beach, CA","country":"USA","lat":33.6284,"lon":-117.9533},
  {"name":"Newport Upper Jetties","region":"Newport Beach, CA","country":"USA","lat":33.6057,"lon":-117.9308},
  {"name":"Newport Lower Jetties","region":"Newport Beach, CA","country":"USA","lat":33.5953,"lon":-117.9009},
  {"name":"Newport Point","region":"Newport Beach, CA","country":"USA","lat":33.5955,"lon":-117.9},
  {"name":"HB Cliffs","region":"Huntington Beach, CA","country":"USA","lat":33.6908,"lon":-118.0451},
  {"name":"Huntington State Beach","region":"Huntington Beach, CA","country":"USA","lat":33.6418,"lon":-117.9739},
  {"name":"Corona del Mar","region":"Newport Beach, CA","country":"USA","lat":33.5917,"lon":-117.8734},
  {"name":"Crystal Cove","region":"Newport Coast, CA","country":"USA","lat":33.5741,"lon":-117.8235},
  {"name":"Thalia Street","region":"Laguna Beach, CA","country":"USA","lat":33.5351,"lon":-117.7735},
  {"name":"Brooks Street","region":"Laguna Beach, CA","country":"USA","lat":33.5332,"lon":-117.7715},
  {"name":"Agate Street","region":"Laguna Beach, CA","country":"USA","lat":33.5291,"lon":-117.7684},
  {"name":"Rockpile","region":"Laguna Beach, CA","country":"USA","lat":33.545,"lon":-117.7906},
  {"name":"Salt Creek","region":"Dana Point, CA","country":"USA","lat":33.4728,"lon":-117.7173},
  {"name":"Strands","region":"Dana Point, CA","country":"USA","lat":33.4663,"lon":-117.7166},
  {"name":"Doheny State Beach","region":"Dana Point, CA","country":"USA","lat":33.4606,"lon":-117.6889},
  {"name":"San Clemente State Beach","region":"San Clemente, CA","country":"USA","lat":33.4025,"lon":-117.6065},
  {"name":"T-Street","region":"San Clemente, CA","country":"USA","lat":33.4209,"lon":-117.6241},
  {"name":"San Clemente Pier, Northside","region":"San Clemente, CA","country":"USA","lat":33.4218,"lon":-117.6223},
  {"name":"204s","region":"San Clemente, CA","country":"USA","lat":33.4493,"lon":-117.6337},
  {"name":"Poche Beach","region":"San Clemente, CA","country":"USA","lat":33.462,"lon":-117.6668},
  {"name":"Upper Trestles","region":"San Onofre, CA","country":"USA","lat":33.3927,"lon":-117.6015},
  {"name":"Lower Trestles","region":"San Onofre, CA","country":"USA","lat":33.3844,"lon":-117.5934},
  {"name":"Middles","region":"San Onofre, CA","country":"USA","lat":33.3897,"lon":-117.5987},
  {"name":"Cottons","region":"San Onofre, CA","country":"USA","lat":33.4021,"lon":-117.6136},
  {"name":"Church","region":"San Onofre, CA","country":"USA","lat":33.3847,"lon":-117.5697},
  {"name":"San Onofre State Beach","region":"San Onofre, CA","country":"USA","lat":33.3682,"lon":-117.569},
  {"name":"Trails","region":"San Onofre, CA","country":"USA","lat":33.3566,"lon":-117.5696},
  {"name":"El Morro Point (K37.5)","region":"Baja California","country":"Mexico","lat":32.229,"lon":-116.944},
  {"name":"Las Gaviotas","region":"Baja California","country":"Mexico","lat":32.2472,"lon":-116.9695},
  {"name":"K-38","region":"Baja California","country":"Mexico","lat":32.2162,"lon":-116.9238},
  {"name":"K-40 (Puerto Nuevo)","region":"Baja California","country":"Mexico","lat":32.2041,"lon":-116.9093},
  {"name":"Rosarito Beach","region":"Baja California","country":"Mexico","lat":32.3573,"lon":-117.0553},
  {"name":"Renes","region":"Baja California","country":"Mexico","lat":32.2323,"lon":-116.9404},
  {"name":"Alfonsos","region":"Baja California","country":"Mexico","lat":32.2238,"lon":-116.9301},
  {"name":"Teresa's","region":"Baja California","country":"Mexico","lat":32.2192,"lon":-116.9258},
  {"name":"Oceanside Harbor","region":"Oceanside, CA","country":"USA","lat":33.2051,"lon":-117.3922},
  {"name":"Oceanside Pier","region":"Oceanside, CA","country":"USA","lat":33.1923,"lon":-117.3823},
  {"name":"The Rock, Oceanside","region":"Oceanside, CA","country":"USA","lat":33.1958,"lon":-117.3869},
  {"name":"Forster St. Oceanside","region":"Oceanside, CA","country":"USA","lat":33.186,"lon":-117.3706},
  {"name":"Tamarack","region":"Carlsbad, CA","country":"USA","lat":33.1553,"lon":-117.3568},
  {"name":"Carlsbad State Beach","region":"Carlsbad, CA","country":"USA","lat":33.1571,"lon":-117.3525},
  {"name":"Terramar Point","region":"Carlsbad, CA","country":"USA","lat":33.1411,"lon":-117.343},
  {"name":"Ponto","region":"Carlsbad, CA","country":"USA","lat":33.0862,"lon":-117.3074},
  {"name":"Grandview","region":"Encinitas, CA","country":"USA","lat":33.0806,"lon":-117.3143},
  {"name":"Beacons","region":"Encinitas, CA","country":"USA","lat":33.0744,"lon":-117.3146},
  {"name":"Moonlight State Beach","region":"Encinitas, CA","country":"USA","lat":33.0469,"lon":-117.2937},
  {"name":"D Street","region":"Encinitas, CA","country":"USA","lat":33.0451,"lon":-117.2929},
  {"name":"Pipes","region":"Cardiff-by-the-Sea, CA","country":"USA","lat":33.0257,"lon":-117.2816},
  {"name":"San Elijo State Beach","region":"Cardiff-by-the-Sea, CA","country":"USA","lat":33.0238,"lon":-117.2798},
  {"name":"Cardiff Reef","region":"Cardiff-by-the-Sea, CA","country":"USA","lat":33.0202,"lon":-117.279},
  {"name":"Seaside Reef","region":"Solana Beach, CA","country":"USA","lat":33.0009,"lon":-117.2726},
  {"name":"George's","region":"Cardiff-by-the-Sea, CA","country":"USA","lat":33.0039,"lon":-117.2778},
  {"name":"Del Mar Rivermouth","region":"Del Mar, CA","country":"USA","lat":32.9628,"lon":-117.2694},
  {"name":"Del Mar","region":"Del Mar, CA","country":"USA","lat":32.9597,"lon":-117.2652},
  {"name":"Solana Beach","region":"Solana Beach, CA","country":"USA","lat":32.9914,"lon":-117.2711},
  {"name":"Torrey Pines State Beach","region":"San Diego, CA","country":"USA","lat":32.9255,"lon":-117.2609},
  {"name":"Scripps","region":"La Jolla, San Diego, CA","country":"USA","lat":32.867,"lon":-117.2573},
  {"name":"La Jolla Shores","region":"La Jolla, San Diego, CA","country":"USA","lat":32.8574,"lon":-117.2568},
  {"name":"Blacks","region":"La Jolla, San Diego, CA","country":"USA","lat":32.8892,"lon":-117.2549},
  {"name":"Horseshoe","region":"La Jolla, San Diego, CA","country":"USA","lat":32.8269,"lon":-117.2826},
  {"name":"Windansea","region":"La Jolla, San Diego, CA","country":"USA","lat":32.8299,"lon":-117.2823},
  {"name":"Birdrock","region":"La Jolla, San Diego, CA","country":"USA","lat":32.8047,"lon":-117.2713},
  {"name":"PB Point","region":"Pacific Beach, San Diego, CA","country":"USA","lat":32.7998,"lon":-117.2623},
  {"name":"Pacific Beach","region":"Pacific Beach, San Diego, CA","country":"USA","lat":32.7979,"lon":-117.255},
  {"name":"Mission Beach","region":"San Diego, CA","country":"USA","lat":32.7702,"lon":-117.2525},
  {"name":"Ocean Beach","region":"San Diego, CA","country":"USA","lat":32.7493,"lon":-117.2511},
  {"name":"Imperial Beach Pier","region":"Imperial Beach, CA","country":"USA","lat":32.5794,"lon":-117.1341}
]
$json$::jsonb AS j
),
parsed AS (
  SELECT *
  FROM jsonb_to_recordset((SELECT j FROM raw))
    AS x(
      name text,
      region text,
      country text,
      lat double precision,
      lon double precision
    )
)
INSERT INTO temp_beaches (name, region, country, latitude, longitude)
SELECT name, region, country, lat, lon
FROM parsed;

-- If a NOT NULL description exists in some environments, prefill nulls
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='beaches' AND column_name='description'
  ) THEN
    UPDATE public.beaches b
    SET description = COALESCE(
      b.description,
      CONCAT(b.name, ' — ', COALESCE(b.location, COALESCE(b.region,'')))
    )
    WHERE b.description IS NULL;
  END IF;
END $$;

-- Update existing rows where values differ (match by case-insensitive name)
UPDATE public.beaches b
SET
  location = COALESCE(tb.region, b.location),
  region = COALESCE(tb.region, b.region),
  country = COALESCE(tb.country, b.country),
  latitude = COALESCE(tb.latitude, b.latitude),
  longitude = COALESCE(tb.longitude, b.longitude)
FROM temp_beaches tb
WHERE lower(b.name) = lower(tb.name)
  AND (
    COALESCE(b.location,'') IS DISTINCT FROM COALESCE(tb.region,'') OR
    COALESCE(b.region,'') IS DISTINCT FROM COALESCE(tb.region,'') OR
    COALESCE(b.country,'') IS DISTINCT FROM COALESCE(tb.country,'') OR
    b.latitude IS DISTINCT FROM tb.latitude OR
    b.longitude IS DISTINCT FROM tb.longitude
  );

-- Insert new rows that don't exist yet (handle description column if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='beaches' AND column_name='description'
  ) THEN
    INSERT INTO public.beaches (
      name, location, region, country, latitude, longitude, description
    )
    SELECT
      tb.name,
      tb.region,
      tb.region,
      tb.country,
      tb.latitude,
      tb.longitude,
      COALESCE(tb.region, tb.name)
    FROM temp_beaches tb
    WHERE NOT EXISTS (
      SELECT 1 FROM public.beaches b WHERE lower(b.name) = lower(tb.name)
    );
  ELSE
    INSERT INTO public.beaches (
      name, location, region, country, latitude, longitude
    )
    SELECT
      tb.name,
      tb.region,
      tb.region,
      tb.country,
      tb.latitude,
      tb.longitude
    FROM temp_beaches tb
    WHERE NOT EXISTS (
      SELECT 1 FROM public.beaches b WHERE lower(b.name) = lower(tb.name)
    );
  END IF;
END $$;

COMMIT;


