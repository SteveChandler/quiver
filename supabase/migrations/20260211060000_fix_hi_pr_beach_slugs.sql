-- Fix Hawaii and Puerto Rico beach slugs
-- Current slugs use compound format: {name}-{city}-{state}
-- Routing expects short slugs matching just the beach name portion
-- e.g. /hi/honolulu/waikiki-canoes expects slug = 'waikiki-canoes'
--      but DB has slug = 'waikiki-canoes-honolulu-hi'

BEGIN;

-- ============================================================
-- HAWAII (17 beaches) — strip -{city}-hi suffix
-- ============================================================

-- Oahu
UPDATE public.beaches SET slug = 'waikiki-canoes'
  WHERE id = '2ac8b200-fdf2-4822-bcb1-3ec336b83d05' AND slug = 'waikiki-canoes-honolulu-hi';

UPDATE public.beaches SET slug = 'waikiki-queens'
  WHERE id = 'ae2e2eee-897c-4198-80fa-04b2d47128d7' AND slug = 'waikiki-queens-honolulu-hi';

UPDATE public.beaches SET slug = 'ala-moana-bowls'
  WHERE id = '80fc2c1b-2d3f-4a94-bcc2-c8ea0e9b8fc5' AND slug = 'ala-moana-bowls-honolulu-hi';

UPDATE public.beaches SET slug = 'diamond-head-cliffs'
  WHERE id = '8ee452f0-4043-4fe0-a049-207afbd95523' AND slug = 'diamond-head-cliffs-honolulu-hi';

UPDATE public.beaches SET slug = 'sunset-beach'
  WHERE id = 'f52f2c49-342a-4694-b04a-d66503446736' AND slug = 'sunset-beach-pupukea-hi';

UPDATE public.beaches SET slug = 'waimea-bay'
  WHERE id = '12431285-b73c-48e4-99b3-731594f6f98c' AND slug = 'waimea-bay-pupukea-hi';

-- haleiwa-haleiwa-hi → haleiwa (deduplicate city=name)
UPDATE public.beaches SET slug = 'haleiwa'
  WHERE id = '43cfaf0d-0376-45cb-a8bd-78087ba4ee15' AND slug = 'haleiwa-haleiwa-hi';

UPDATE public.beaches SET slug = 'sandy-beach'
  WHERE id = 'd663a525-f59d-4873-b67a-50898ca1c72c' AND slug = 'sandy-beach-honolulu-hi';

-- Maui
UPDATE public.beaches SET slug = 'honolua-bay'
  WHERE id = '4dd216b1-edc3-46b6-aabb-66beb467bcaf' AND slug = 'honolua-bay-kapalua-hi';

UPDATE public.beaches SET slug = 'hookipa'
  WHERE id = 'e6cec9c8-ab43-4ff8-9d79-cb297422b529' AND slug = 'hookipa-paia-hi';

UPDATE public.beaches SET slug = 'lahaina-harbor-breakwall'
  WHERE id = '2c622571-c1fa-4c46-afd1-c0769c184570' AND slug = 'lahaina-harbor-breakwall-lahaina-hi';

-- Kauai
UPDATE public.beaches SET slug = 'kalapaki-beach'
  WHERE id = 'b2b469ea-3d00-44df-88e8-621934c6926f' AND slug = 'kalapaki-beach-lihue-hi';

UPDATE public.beaches SET slug = 'pakala-infinities'
  WHERE id = '34e6e6d4-b640-4412-934f-4343b7dd8dfc' AND slug = 'pakala-infinities-waimea-hi';

-- anahola-anahola-hi → anahola (deduplicate city=name)
UPDATE public.beaches SET slug = 'anahola'
  WHERE id = 'c9659503-c562-4379-9177-fff60acdfb7f' AND slug = 'anahola-anahola-hi';

-- Big Island
UPDATE public.beaches SET slug = 'banyans'
  WHERE id = 'eadd2bf6-759a-46e4-a8af-8df1feb635cb' AND slug = 'banyans-kailua-kona-hi';

-- kahaluu-kahaluu-keauhou-hi → kahaluu (deduplicate city prefix)
UPDATE public.beaches SET slug = 'kahaluu'
  WHERE id = '67996143-6e0e-4391-a810-9dec48e19963' AND slug = 'kahaluu-kahaluu-keauhou-hi';

UPDATE public.beaches SET slug = 'pine-trees-kohanaiki'
  WHERE id = 'fbe805b3-b9f5-40e0-afbb-3c5a8d45f67b' AND slug = 'pine-trees-kohanaiki-kailua-kona-hi';

-- Pipeline was added in 20251207100000_beaches_data_quality_fixes.sql with compound slug
UPDATE public.beaches SET slug = 'pipeline'
  WHERE id = '6a0674ac-3e6d-49f3-9fd4-a4f1857c408a' AND slug = 'pipeline-haleiwa-hi';

-- ============================================================
-- PUERTO RICO (14 beaches) — strip -{city}-pr suffix
-- ============================================================

-- Rincón
UPDATE public.beaches SET slug = 'domes'
  WHERE id = '8a2b0951-38b4-4d7e-b5d5-6e076b58a5f0' AND slug = 'domes-rincon-pr';

UPDATE public.beaches SET slug = 'marias'
  WHERE id = '5c879b55-26e6-4755-92f3-0291f4634f24' AND slug = 'marias-rincon-pr';

UPDATE public.beaches SET slug = 'tres-palmas'
  WHERE id = '88424465-0b1d-4f93-aa17-93dd1c4d03f3' AND slug = 'tres-palmas-rincon-pr';

UPDATE public.beaches SET slug = 'indicators'
  WHERE id = 'f298d080-177b-4407-9e3a-be51bae58605' AND slug = 'indicators-rincon-pr';

-- sandy-beach-rincon-rincon-pr → sandy-beach-rincon (keep one 'rincon' to distinguish from HI Sandy Beach)
UPDATE public.beaches SET slug = 'sandy-beach-rincon'
  WHERE id = 'f11ccd59-b778-4ea1-a8ff-88bffb447cd8' AND slug = 'sandy-beach-rincon-rincon-pr';

UPDATE public.beaches SET slug = 'the-point-at-sandy'
  WHERE id = 'bfd3e168-f268-4692-901c-4b80b9b58dcb' AND slug = 'the-point-at-sandy-rincon-pr';

-- Isabela
UPDATE public.beaches SET slug = 'jobos'
  WHERE id = '388bb737-5889-46d0-a182-d26567bf23f6' AND slug = 'jobos-isabela-pr';

-- middles-isabela-isabela-pr → middles-isabela (beach name already includes "Isabela")
UPDATE public.beaches SET slug = 'middles-isabela'
  WHERE id = '77903282-042b-4294-b6b2-2e3815489513' AND slug = 'middles-isabela-isabela-pr';

UPDATE public.beaches SET slug = 'shacks'
  WHERE id = 'a240ccfc-d047-4471-a406-6ae5e92b0816' AND slug = 'shacks-isabela-pr';

-- Aguadilla
UPDATE public.beaches SET slug = 'wilderness'
  WHERE id = '2795319c-e680-45d0-a8af-f4c55631986e' AND slug = 'wilderness-aguadilla-pr';

UPDATE public.beaches SET slug = 'crash-boat'
  WHERE id = 'acfad2b2-7d0c-4c42-9fba-e78fa73e4ae3' AND slug = 'crash-boat-aguadilla-pr';

UPDATE public.beaches SET slug = 'surfers-beach'
  WHERE id = '4a0aac5b-86e5-433d-8a54-64c8e15197f9' AND slug = 'surfers-beach-aguadilla-pr';

-- Luquillo
UPDATE public.beaches SET slug = 'la-pared'
  WHERE id = '6c111c72-1773-490b-ae9e-fe6d81827989' AND slug = 'la-pared-luquillo-pr';

UPDATE public.beaches SET slug = 'la-selva'
  WHERE id = '7db87d82-4e66-4a48-9c8b-d5f95a282a4c' AND slug = 'la-selva-luquillo-pr';

COMMIT;
