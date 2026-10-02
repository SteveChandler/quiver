-- Move three misplaced California surf pins onto their breaks (2026-10-01), read off Esri World Imagery at z17
-- with a 0.001° grid and corroborated by the CDIP MOP point each new pin maps to.
-- beaches.geog is GENERATED from lat/lon. cdip_station, nws_forecast_zone, nws_office and timezone are unchanged
-- for moves this size. None of the three is in the active Swell Watch study cohort (epoch 6), so the scope guard allows it.
-- aspect_deg moves with the pin where the facing changes (Rincon), or where it was null only because the pin was inland (Doheny Beach).
-- Each row is guarded on its current values, so it is idempotent and won't overwrite a concurrent edit. Proposed only.

BEGIN;
-- The Wedge: the pin was across the harbour channel on the Corona del Mar beach. Move it to the west side of the
-- west jetty at the tip of the Balboa Peninsula. aspect 192 still fits (CDIP OC381 normal 196).
UPDATE public.beaches SET lat = 33.5938, lon = -117.8820
WHERE id = 'c2c7cc01-4920-4fd9-941c-68df6b46ced0' AND lat = 33.5939 AND lon = -117.8776;
-- Doheny Beach: the pin was in town about 1 km inland. Move it to the break at the west end of Doheny State Beach,
-- beside the Dana Point Harbor east breakwall, and give it the twin's 170 (CDIP OC125 normal 156 is 2 km off, past the breakwater).
UPDATE public.beaches SET lat = 33.4612, lon = -117.6893, aspect_deg = 170
WHERE id = 'a57ae4c8-7a27-4d3f-91d5-6229350fb888' AND lat = 33.466426 AND lon = -117.702231 AND aspect_deg IS NULL;
-- Rincon: the pin was on the straight Hwy 101 beach about 2 km east. Move it to the cove on the SE side of Rincon Point.
-- The cove faces SSE: 160 (CDIP VE678 normal 159). The old 226 described the beach at the old pin.
UPDATE public.beaches SET lat = 34.3729, lon = -119.4765, aspect_deg = 160
WHERE id = 'bec2d595-ed20-4c2b-93c7-4b880406332f' AND lat = 34.371224 AND lon = -119.455292 AND aspect_deg = 226;
COMMIT;
