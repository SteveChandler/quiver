-- Seed 72 beaches (OC/SD/Baja) via guarded, idempotent upsert
-- No TRUNCATE; safe with existing FKs (e.g., profiles.default_beach_id)
--
-- Ids are pinned to the production catalog so a from-scratch replay reproduces
-- the same primary keys. Without this, ~24 later migrations that target beaches
-- by hardcoded uuid match zero rows and silently no-op on a rebuilt database.
-- See .planning/migration-replay-broken-beach-uuids-20260813.md
--
-- Inserts remain guarded by NOT EXISTS on lower(name), so this is a no-op
-- against any database where these rows already exist, production included.
-- Two entries carry a null id ("Grandview", "North HB Streets"): production
-- renamed them outside of migrations, so no migration pairs an id with the
-- seed's name. They fall back to gen_random_uuid(), exactly as before.

BEGIN;

-- Ensure case-insensitive unique index on name
CREATE UNIQUE INDEX IF NOT EXISTS beaches_name_unique ON public.beaches (lower(name));

-- Temporary staging table for this migration
DROP TABLE IF EXISTS temp_beaches;
CREATE TEMPORARY TABLE temp_beaches (
  id uuid,
  name text PRIMARY KEY,
  region text,
  country text,
  lat double precision,
  lon double precision
) ON COMMIT DROP;

-- Load inline JSON to temp_beaches
WITH raw AS (
  SELECT $json$
[
  {"id":"025cfc18-8357-49d6-994e-e0abf0a16f6d","name":"Huntington Beach Pier Southside","region":"Huntington Beach, CA","country":"USA","lat":33.6542,"lon":-118.0022},
  {"id":"72726bcb-bed0-4b76-8336-f90d7fb57159","name":"Huntington Beach Pier Northside","region":"Huntington Beach, CA","country":"USA","lat":33.6552,"lon":-118.0022},
  {"id":"c2c7cc01-4920-4fd9-941c-68df6b46ced0","name":"The Wedge","region":"Newport Beach, CA","country":"USA","lat":33.5939,"lon":-117.8776},
  {"id":null,"name":"North HB Streets","region":"Huntington Beach, CA","country":"USA","lat":33.6805,"lon":-118.0113},
  {"id":"b57b32b9-0057-46f6-9fa9-cd35d5bd5319","name":"Huntington St.","region":"Huntington Beach, CA","country":"USA","lat":33.6514,"lon":-118.0067},
  {"id":"a0e764f1-d0bb-4341-b397-7b21823cb93b","name":"River Jetties","region":"Newport Beach, CA","country":"USA","lat":33.6284,"lon":-117.9533},
  {"id":"e64001e6-e2bd-4596-8f24-d8064e7f5186","name":"Newport Upper Jetties","region":"Newport Beach, CA","country":"USA","lat":33.6057,"lon":-117.9308},
  {"id":"bbe7f4eb-9807-4e65-8e69-e2cee28d6b24","name":"Newport Lower Jetties","region":"Newport Beach, CA","country":"USA","lat":33.5953,"lon":-117.9009},
  {"id":"11662c67-a1bb-43a0-b0f7-0e4071b1c3f2","name":"Newport Point","region":"Newport Beach, CA","country":"USA","lat":33.5955,"lon":-117.9},
  {"id":"d60dd5c8-d147-4042-a531-c2ec55c620af","name":"HB Cliffs","region":"Huntington Beach, CA","country":"USA","lat":33.6908,"lon":-118.0451},
  {"id":"502bd50f-21c8-4cdc-ae96-1d53fcbc34de","name":"Huntington State Beach","region":"Huntington Beach, CA","country":"USA","lat":33.6418,"lon":-117.9739},
  {"id":"12e0096c-9826-443f-9131-53aaa646f789","name":"Corona del Mar","region":"Newport Beach, CA","country":"USA","lat":33.5917,"lon":-117.8734},
  {"id":"0e557ec4-355a-4176-8352-6ea50e379c13","name":"Crystal Cove","region":"Newport Coast, CA","country":"USA","lat":33.5741,"lon":-117.8235},
  {"id":"2a2195ef-27d1-4b35-a006-b7177b34dad2","name":"Thalia Street","region":"Laguna Beach, CA","country":"USA","lat":33.5351,"lon":-117.7735},
  {"id":"1f8660f2-891d-4f79-8f16-cad8ebd59c79","name":"Brooks Street","region":"Laguna Beach, CA","country":"USA","lat":33.5332,"lon":-117.7715},
  {"id":"0f0dcd5a-be9d-4c0d-a7ba-d6f932f9b769","name":"Agate Street","region":"Laguna Beach, CA","country":"USA","lat":33.5291,"lon":-117.7684},
  {"id":"79e8be90-df33-4b80-9d92-e79e26a67a69","name":"Rockpile","region":"Laguna Beach, CA","country":"USA","lat":33.545,"lon":-117.7906},
  {"id":"73bb4a48-3d53-42ba-bbd0-d89a7cf95711","name":"Salt Creek","region":"Dana Point, CA","country":"USA","lat":33.4728,"lon":-117.7173},
  {"id":"80e4aada-7d4a-4df1-b11b-841a97603979","name":"Strands","region":"Dana Point, CA","country":"USA","lat":33.4663,"lon":-117.7166},
  {"id":"a4575b12-2bc3-44d4-ba53-4415707f3851","name":"Doheny State Beach","region":"Dana Point, CA","country":"USA","lat":33.4606,"lon":-117.6889},
  {"id":"02dfc45e-f7f8-4fdc-8008-6ce14e2839f5","name":"San Clemente State Beach","region":"San Clemente, CA","country":"USA","lat":33.4025,"lon":-117.6065},
  {"id":"dfeecc16-6395-4600-89e6-baf8456e3d69","name":"T-Street","region":"San Clemente, CA","country":"USA","lat":33.4209,"lon":-117.6241},
  {"id":"e99552bf-45bd-46a8-a716-4cdfff2061f2","name":"San Clemente Pier, Northside","region":"San Clemente, CA","country":"USA","lat":33.4218,"lon":-117.6223},
  {"id":"047e61b4-b4a8-4042-a290-f2189b5a70ca","name":"204s","region":"San Clemente, CA","country":"USA","lat":33.4493,"lon":-117.6337},
  {"id":"b9c4a949-4562-47db-ae7d-b2131e20d7a7","name":"Poche Beach","region":"San Clemente, CA","country":"USA","lat":33.462,"lon":-117.6668},
  {"id":"f924aa96-395f-41e0-b966-502b37def7ac","name":"Upper Trestles","region":"San Onofre, CA","country":"USA","lat":33.3927,"lon":-117.6015},
  {"id":"193a3f9a-66d0-4362-bf55-d25bb831dae4","name":"Lower Trestles","region":"San Onofre, CA","country":"USA","lat":33.3844,"lon":-117.5934},
  {"id":"b5bcd27f-3399-4a0a-b5d5-da8147e43b9a","name":"Middles","region":"San Onofre, CA","country":"USA","lat":33.3897,"lon":-117.5987},
  {"id":"2c1d7948-72c1-4787-93e8-f33ac9567db0","name":"Cottons","region":"San Onofre, CA","country":"USA","lat":33.4021,"lon":-117.6136},
  {"id":"a0332432-4877-48c5-855d-b30fd097ba38","name":"Church","region":"San Onofre, CA","country":"USA","lat":33.3847,"lon":-117.5697},
  {"id":"8a47b323-0874-45d9-aa17-ced468f70f2d","name":"San Onofre State Beach","region":"San Onofre, CA","country":"USA","lat":33.3682,"lon":-117.569},
  {"id":"2f3e2136-b094-49d7-b90f-948160cbb854","name":"Trails","region":"San Onofre, CA","country":"USA","lat":33.3566,"lon":-117.5696},
  {"id":"6cbb1b4f-d25e-40a3-a78a-b138ebdf9e96","name":"El Morro Point (K37.5)","region":"Baja California","country":"Mexico","lat":32.229,"lon":-116.944},
  {"id":"965196e2-81c3-4c1a-8c2f-e5c9c0f8e3fd","name":"Las Gaviotas","region":"Baja California","country":"Mexico","lat":32.2472,"lon":-116.9695},
  {"id":"77d286c5-87e9-4678-82d3-81d0125285fa","name":"K-38","region":"Baja California","country":"Mexico","lat":32.2162,"lon":-116.9238},
  {"id":"de6575ce-4ee1-4c6b-a2cf-7009ba171c3b","name":"K-40 (Puerto Nuevo)","region":"Baja California","country":"Mexico","lat":32.2041,"lon":-116.9093},
  {"id":"f0ddfc6a-7392-40c5-9211-836c05e449f1","name":"Rosarito Beach","region":"Baja California","country":"Mexico","lat":32.3573,"lon":-117.0553},
  {"id":"294712f3-3c06-44bd-9bc6-17275675fe9a","name":"Renes","region":"Baja California","country":"Mexico","lat":32.2323,"lon":-116.9404},
  {"id":"6e083f22-4c11-46c5-9110-ac7500f6cba5","name":"Alfonsos","region":"Baja California","country":"Mexico","lat":32.2238,"lon":-116.9301},
  {"id":"ec7b1ab4-5f43-4af3-b45f-325d29b8d5e6","name":"Teresa's","region":"Baja California","country":"Mexico","lat":32.2192,"lon":-116.9258},
  {"id":"a30b9870-aace-48ef-a3e6-e275ad9c28c1","name":"Oceanside Harbor","region":"Oceanside, CA","country":"USA","lat":33.2051,"lon":-117.3922},
  {"id":"cceecad1-7668-4ad8-88ff-ade893c605cd","name":"Oceanside Pier","region":"Oceanside, CA","country":"USA","lat":33.1923,"lon":-117.3823},
  {"id":"762fcfa2-8fd8-40ea-8955-b9cc6945a422","name":"The Rock, Oceanside","region":"Oceanside, CA","country":"USA","lat":33.1958,"lon":-117.3869},
  {"id":"e5fee219-672c-4113-a0bb-a86a5d97700f","name":"Forster St. Oceanside","region":"Oceanside, CA","country":"USA","lat":33.186,"lon":-117.3706},
  {"id":"b1b49703-2376-407d-b1fb-9df06130ac1d","name":"Tamarack","region":"Carlsbad, CA","country":"USA","lat":33.1553,"lon":-117.3568},
  {"id":"c0977bcd-5475-4745-b4b8-0ca1e16a7faf","name":"Carlsbad State Beach","region":"Carlsbad, CA","country":"USA","lat":33.1571,"lon":-117.3525},
  {"id":"1fe4bf73-c425-48a5-899d-a7e8ee2d67e3","name":"Terramar Point","region":"Carlsbad, CA","country":"USA","lat":33.1411,"lon":-117.343},
  {"id":"badd7986-4609-421a-ab3d-81fcd8409a5b","name":"Ponto","region":"Carlsbad, CA","country":"USA","lat":33.0862,"lon":-117.3074},
  {"id":null,"name":"Grandview","region":"Encinitas, CA","country":"USA","lat":33.0806,"lon":-117.3143},
  {"id":"22536002-c7d2-48ab-a676-9b489fd79874","name":"Beacons","region":"Encinitas, CA","country":"USA","lat":33.0744,"lon":-117.3146},
  {"id":"deea2ae1-849d-47a1-9c27-b7bd505dbc07","name":"Moonlight State Beach","region":"Encinitas, CA","country":"USA","lat":33.0469,"lon":-117.2937},
  {"id":"902a215b-2a3d-40af-9391-16b0afed7dee","name":"D Street","region":"Encinitas, CA","country":"USA","lat":33.0451,"lon":-117.2929},
  {"id":"2380adaa-a07c-44f4-9444-656ef51fa998","name":"Pipes","region":"Cardiff-by-the-Sea, CA","country":"USA","lat":33.0257,"lon":-117.2816},
  {"id":"09affcd2-1eca-4f7d-852e-413972ea4154","name":"San Elijo State Beach","region":"Cardiff-by-the-Sea, CA","country":"USA","lat":33.0238,"lon":-117.2798},
  {"id":"80efa1c0-37a2-4879-819b-647ae3c3d749","name":"Cardiff Reef","region":"Cardiff-by-the-Sea, CA","country":"USA","lat":33.0202,"lon":-117.279},
  {"id":"5a34b2ac-01b9-4b83-8c05-c47b1b55d923","name":"Seaside Reef","region":"Solana Beach, CA","country":"USA","lat":33.0009,"lon":-117.2726},
  {"id":"7dca6429-25ee-4161-a2c2-800555ed8a6a","name":"George's","region":"Cardiff-by-the-Sea, CA","country":"USA","lat":33.0039,"lon":-117.2778},
  {"id":"7fc84dd8-abcc-4d7c-9ade-3d1500c1c24c","name":"Del Mar Rivermouth","region":"Del Mar, CA","country":"USA","lat":32.9628,"lon":-117.2694},
  {"id":"5e72b79d-a12d-4cd3-8da4-b7b92069efbf","name":"Del Mar","region":"Del Mar, CA","country":"USA","lat":32.9597,"lon":-117.2652},
  {"id":"65d3a4de-1f4b-4a1d-8ce0-b5b67288ee08","name":"Solana Beach","region":"Solana Beach, CA","country":"USA","lat":32.9914,"lon":-117.2711},
  {"id":"4bdbff9e-2c1f-4918-84a6-aed42fb6e42c","name":"Torrey Pines State Beach","region":"San Diego, CA","country":"USA","lat":32.9255,"lon":-117.2609},
  {"id":"4b0cf129-c706-4e24-8210-2219defc5ea7","name":"Scripps","region":"La Jolla, San Diego, CA","country":"USA","lat":32.867,"lon":-117.2573},
  {"id":"d291411d-d331-4bf1-ad1a-302da3c69de0","name":"La Jolla Shores","region":"La Jolla, San Diego, CA","country":"USA","lat":32.8574,"lon":-117.2568},
  {"id":"01330afc-00d3-461b-88f3-b173774766f4","name":"Blacks","region":"La Jolla, San Diego, CA","country":"USA","lat":32.8892,"lon":-117.2549},
  {"id":"30e68b00-c27d-4d22-ba57-2d92156964c6","name":"Horseshoe","region":"La Jolla, San Diego, CA","country":"USA","lat":32.8269,"lon":-117.2826},
  {"id":"6f42d47d-215b-47cb-ac14-b83bf8c2a797","name":"Windansea","region":"La Jolla, San Diego, CA","country":"USA","lat":32.8299,"lon":-117.2823},
  {"id":"ca2b1d6f-2428-4273-ab02-7555eeec4323","name":"Birdrock","region":"La Jolla, San Diego, CA","country":"USA","lat":32.8047,"lon":-117.2713},
  {"id":"13ef0aa1-c857-4d82-a40d-a83612110943","name":"PB Point","region":"Pacific Beach, San Diego, CA","country":"USA","lat":32.7998,"lon":-117.2623},
  {"id":"65809772-20bc-4009-b9b2-89c8ef3c4127","name":"Pacific Beach","region":"Pacific Beach, San Diego, CA","country":"USA","lat":32.7979,"lon":-117.255},
  {"id":"c02b4ede-69d9-440e-b8de-22ea4bde10ef","name":"Mission Beach","region":"San Diego, CA","country":"USA","lat":32.7702,"lon":-117.2525},
  {"id":"15c7337e-5258-4339-9dc3-c435c666926b","name":"Ocean Beach","region":"San Diego, CA","country":"USA","lat":32.7493,"lon":-117.2511},
  {"id":"d9f93c82-7f4b-440a-865a-55cdbb821f74","name":"Imperial Beach Pier","region":"Imperial Beach, CA","country":"USA","lat":32.5794,"lon":-117.1341}
]
$json$::jsonb AS j
),
parsed AS (
  SELECT *
  FROM jsonb_to_recordset((SELECT j FROM raw))
    AS x(
      id uuid,
      name text,
      region text,
      country text,
      lat double precision,
      lon double precision
    )
)
INSERT INTO temp_beaches (id, name, region, country, lat, lon)
SELECT id, name, region, country, lat, lon
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
      CONCAT(b.name, ' — ', COALESCE(b.region,''))
    )
    WHERE b.description IS NULL;
  END IF;
END $$;

-- Update existing rows where values differ (match by case-insensitive name)
UPDATE public.beaches b
SET
  region = COALESCE(tb.region, b.region),
  country = COALESCE(tb.country, b.country),
  lat = COALESCE(tb.lat, b.lat),
  lon = COALESCE(tb.lon, b.lon)
FROM temp_beaches tb
WHERE lower(b.name) = lower(tb.name)
  AND (
    COALESCE(b.region,'') IS DISTINCT FROM COALESCE(tb.region,'') OR
    COALESCE(b.country,'') IS DISTINCT FROM COALESCE(tb.country,'') OR
    b.lat IS DISTINCT FROM tb.lat OR
    b.lon IS DISTINCT FROM tb.lon
  );

-- Insert new rows that don't exist yet (handle description column if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='beaches' AND column_name='description'
  ) THEN
    INSERT INTO public.beaches (
      id, name, region, country, lat, lon, description
    )
    SELECT
      COALESCE(tb.id, gen_random_uuid()),
      tb.name,
      tb.region,
      tb.country,
      tb.lat,
      tb.lon,
      COALESCE(tb.region, tb.name)
    FROM temp_beaches tb
    WHERE NOT EXISTS (
      SELECT 1 FROM public.beaches b WHERE lower(b.name) = lower(tb.name)
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.beaches (
      id, name, region, country, lat, lon
    )
    SELECT
      COALESCE(tb.id, gen_random_uuid()),
      tb.name,
      tb.region,
      tb.country,
      tb.lat,
      tb.lon
    FROM temp_beaches tb
    WHERE NOT EXISTS (
      SELECT 1 FROM public.beaches b WHERE lower(b.name) = lower(tb.name)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

COMMIT;


