-- DRAFT awaiting approval. No production database action has been taken.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

UPDATE public.beaches SET wind_offshore_deg = 60 WHERE slug = '52nd-street-newport-beach-ca' AND wind_offshore_deg = 90;
UPDATE public.beaches SET wind_offshore_deg = 50 WHERE slug = '54th-street-newport-beach-ca' AND wind_offshore_deg = 90;
UPDATE public.beaches SET wind_offshore_deg = 75 WHERE slug = 'beacons' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 65 WHERE slug = 'cardiff-reef' AND wind_offshore_deg = 90;
UPDATE public.beaches SET wind_offshore_deg = 10 WHERE slug = 'church' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 15 WHERE slug = 'corona-del-mar' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 40 WHERE slug = 'county-line-malibu-ca' AND wind_offshore_deg = 0;
UPDATE public.beaches SET wind_offshore_deg = 65 WHERE slug = 'crystal-pier' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 340 WHERE slug = 'doheny-state-beach' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'd-street' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'el-porto-manhattan' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'el-segundo-beach-jetty-el-segundo-ca' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'georges' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 85 WHERE slug = 'grandview' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 75 WHERE slug = 'hermosa-pier' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 75 WHERE slug = 'horseshoe' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'imperial-beach' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'jalama-beach-jalama-ca' AND wind_offshore_deg = 90;
UPDATE public.beaches SET wind_offshore_deg = 30 WHERE slug = 'k-40' AND wind_offshore_deg = 90;
UPDATE public.beaches SET wind_offshore_deg = 115 WHERE slug = 'la-jolla-shores' AND wind_offshore_deg = 135;
UPDATE public.beaches SET wind_offshore_deg = 20 WHERE slug = 'lower-trestles' AND wind_offshore_deg = 67;
UPDATE public.beaches SET wind_offshore_deg = 65 WHERE slug = 'manhattan-beach-pier-manhattan-beach-ca' AND wind_offshore_deg = 90;
UPDATE public.beaches SET wind_offshore_deg = 0 WHERE slug = 'middles' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'moonlight-state-beach' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 20 WHERE slug = 'old-mans-sano' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'pacific-beach' AND wind_offshore_deg = 90;
UPDATE public.beaches SET wind_offshore_deg = 65 WHERE slug = 'pipes' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 25 WHERE slug = 'river-jetties' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'san-elijo-state-beach' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 105 WHERE slug = 'scripps' AND wind_offshore_deg = 135;
UPDATE public.beaches SET wind_offshore_deg = 45 WHERE slug = 'shipwrecks-coronado-ca' AND wind_offshore_deg = 0;
UPDATE public.beaches SET wind_offshore_deg = 75 WHERE slug = 'solana-beach' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'sunset-cliffs-garbage' AND wind_offshore_deg = 90;
UPDATE public.beaches SET wind_offshore_deg = 55 WHERE slug = 'tamarack' AND wind_offshore_deg = 90;
UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'torrey-pines-state-beach' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 75 WHERE slug = 'tourmaline' AND wind_offshore_deg = 45;
UPDATE public.beaches SET wind_offshore_deg = 60 WHERE slug = 'tourmaline-surf-park' AND wind_offshore_deg = 90;
UPDATE public.beaches SET wind_offshore_deg = 25 WHERE slug = 'upper-trestles' AND wind_offshore_deg = 45;

COMMIT;

/* MEDIUM only; intentionally not executable pending review.
-- UPDATE public.beaches SET wind_offshore_deg = 325 WHERE slug = 'c-street-ventura-ca' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 330 WHERE slug = 'doheny' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 25 WHERE slug = 'emma-wood-ventura-ca' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 300 WHERE slug = 'malibu-first-point-surfrider' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 320 WHERE slug = 'mondos-beach-ventura-ca' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 10 WHERE slug = 'rockpile' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'rosarito' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'silver-strand-state-beach' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'strands' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 35 WHERE slug = 'swamis' AND wind_offshore_deg = 90;
*/
