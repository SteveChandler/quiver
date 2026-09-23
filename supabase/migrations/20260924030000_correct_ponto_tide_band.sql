-- Ponto's curated tide band now caps the verdict (tide_outside_band), so it must
-- match how the break actually works. Guides agree it breaks on low and medium
-- tide, closes out on extreme lows and goes mushy with backwash at high tide.
-- Against La Jolla (9410230) datums over MLLW - MLW 0.9 ft, MTL 2.75 ft,
-- MHW 4.6 ft - that is roughly 1-4 ft. Earlier migrations wrote 2.5-4.5 and
-- production had drifted to 2-4; both excluded workable low tides.
BEGIN;

UPDATE public.beaches
SET preferred_tide_ft_min = 1,
    preferred_tide_ft_max = 4
WHERE id = 'badd7986-4609-421a-ab3d-81fcd8409a5b'
  AND slug = 'ponto';

COMMIT;
