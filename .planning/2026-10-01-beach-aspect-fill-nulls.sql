-- Fill null beaches.aspect_deg for California beaches (audit 2026-10-01).
-- A = matched CDIP MOP point's shore normal, rounded, where CDIP is locally stable (neighbours within 20°, contour
--     within 25°, within 100 m of the transect) and the satellite image confirms it points straight out from the waterline.
-- B = a read of the waterline on satellite imagery (Esri World Imagery), rounded to 5°, where CDIP is unstable or absent.
-- twin = a duplicate catalog row next to a beach that already has a value.
-- wind_offshore_deg is not used: every Orange County row holds the same 45° default. swell_window_center_deg_v2 measures exposure, not facing.
-- rows: 46 (A 36, B 9, twin 1). Left null: Doheny Beach, Malibu First Point (Surfrider).
-- Guarded on aspect_deg IS NULL, so it is idempotent and won't overwrite a value set meanwhile. Proposed only.

BEGIN;
-- San Onofre State Beach: 216 (A: CDIP D1177 normal, neighbours ±5°, contour 218, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 216 WHERE id = '8a47b323-0874-45d9-aa17-ced468f70f2d' AND aspect_deg IS NULL;
-- Trails: 232 (A: CDIP D1182 normal, neighbours ±7°, contour 223, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 232 WHERE id = '2f3e2136-b094-49d7-b90f-948160cbb854' AND aspect_deg IS NULL;
-- Old Man's (SanO): 202 (A: CDIP D1189 normal, neighbours ±12°, contour 226, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 202 WHERE id = 'a956de46-b204-448e-a541-db427be7e85f' AND aspect_deg IS NULL;
-- Church: 190 (B: map read — Waterline faces S; CDIP contour disagrees with its normal (192 vs 219).)
UPDATE public.beaches SET aspect_deg = 190 WHERE id = 'a0332432-4877-48c5-855d-b30fd097ba38' AND aspect_deg IS NULL;
-- Middles: 198 (A: CDIP D1196 normal, neighbours ±6°, contour 214, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 198 WHERE id = 'b5bcd27f-3399-4a0a-b5d5-da8147e43b9a' AND aspect_deg IS NULL;
-- Upper Trestles: 209 (A: CDIP D1205 normal, neighbours ±7°, contour 224, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 209 WHERE id = 'f924aa96-395f-41e0-b966-502b37def7ac' AND aspect_deg IS NULL;
-- Cottons: 233 (A: CDIP D1210 normal, neighbours ±13°, contour 227, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 233 WHERE id = '2c1d7948-72c1-4787-93e8-f33ac9567db0' AND aspect_deg IS NULL;
-- San Clemente State Beach: 239 (A: CDIP OC020 normal, neighbours ±3°, contour 232, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 239 WHERE id = '02dfc45e-f7f8-4fdc-8008-6ce14e2839f5' AND aspect_deg IS NULL;
-- Riviera: 234 (A: CDIP OC024 normal, neighbours ±2°, contour 213, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 234 WHERE id = '1a854513-1c65-458e-abb6-384ba4090b0b' AND aspect_deg IS NULL;
-- T-Street: 234 (A: CDIP OC039 normal, neighbours ±5°, contour 229, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 234 WHERE id = 'dfeecc16-6395-4600-89e6-baf8456e3d69' AND aspect_deg IS NULL;
-- San Clemente Pier, Northside: 232 (A: CDIP OC046 normal, neighbours ±8°, contour 227, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 232 WHERE id = 'e99552bf-45bd-46a8-a716-4cdfff2061f2' AND aspect_deg IS NULL;
-- Poche Beach: 214 (A: CDIP OC101 normal, neighbours ±5°, contour 204, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 214 WHERE id = 'b9c4a949-4562-47db-ae7d-b2131e20d7a7' AND aspect_deg IS NULL;
-- Doheny State Beach: 170 (B: map read — Beach faces SSE east of Dana Point Harbor; CDIP contour unusable (90).)
UPDATE public.beaches SET aspect_deg = 170 WHERE id = 'a4575b12-2bc3-44d4-ba53-4415707f3851' AND aspect_deg IS NULL;
-- Strands: 243 (A: CDIP OC159 normal, neighbours ±20°, contour 243, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 243 WHERE id = '80e4aada-7d4a-4df1-b11b-841a97603979' AND aspect_deg IS NULL;
-- Salt Creek: 236 (A: CDIP OC166 normal, neighbours ±9°, contour 226, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 236 WHERE id = '73bb4a48-3d53-42ba-bbd0-d89a7cf95711' AND aspect_deg IS NULL;
-- Agate Street: 224 (A: CDIP OC247 normal, neighbours ±6°, contour 221, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 224 WHERE id = '0f0dcd5a-be9d-4c0d-a7ba-d6f932f9b769' AND aspect_deg IS NULL;
-- Brooks Street: 226 (A: CDIP OC253 normal, neighbours ±8°, contour 228, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 226 WHERE id = '1f8660f2-891d-4f79-8f16-cad8ebd59c79' AND aspect_deg IS NULL;
-- Thalia Street: 238 (A: CDIP OC256 normal, neighbours ±10°, contour 240, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 238 WHERE id = '2a2195ef-27d1-4b35-a006-b7177b34dad2' AND aspect_deg IS NULL;
-- Rockpile: 199 (A: CDIP OC274 normal, neighbours ±7°, contour 206, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 199 WHERE id = '79e8be90-df33-4b80-9d92-e79e26a67a69' AND aspect_deg IS NULL;
-- Crystal Cove: 229 (A: CDIP OC313 normal, neighbours ±10°, contour 216, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 229 WHERE id = '0e557ec4-355a-4176-8352-6ea50e379c13' AND aspect_deg IS NULL;
-- Corona del Mar: 190 (B: map read — Beach east of the Newport Harbor jetty faces S; CDIP neighbours spread 26°.)
UPDATE public.beaches SET aspect_deg = 190 WHERE id = '12e0096c-9826-443f-9131-53aaa646f789' AND aspect_deg IS NULL;
-- The Wedge: 192 (A: CDIP OC377 normal, neighbours ±6°, contour 194, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 192 WHERE id = 'c2c7cc01-4920-4fd9-941c-68df6b46ced0' AND aspect_deg IS NULL;
-- Newport Lower Jetties: 197 (A: CDIP OC397 normal, neighbours ±5°, contour 206, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 197 WHERE id = 'bbe7f4eb-9807-4e65-8e69-e2cee28d6b24' AND aspect_deg IS NULL;
-- Newport Point: 200 (A: CDIP OC399 normal, neighbours ±7°, contour 206, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 200 WHERE id = '11662c67-a1bb-43a0-b0f7-0e4071b1c3f2' AND aspect_deg IS NULL;
-- Newport Upper Jetties: 230 (B: map read — Waterline at the pin faces SW; CDIP neighbours spread 26°.)
UPDATE public.beaches SET aspect_deg = 230 WHERE id = 'e64001e6-e2bd-4596-8f24-d8064e7f5186' AND aspect_deg IS NULL;
-- Blackies: 240 (B: map read — Waterline north of Newport Pier faces WSW; CDIP contour 214 vs normal 242.)
UPDATE public.beaches SET aspect_deg = 240 WHERE id = '66d06e54-10bd-458c-a57b-1966a957b825' AND aspect_deg IS NULL;
-- Newport 56th St: 241 (A: CDIP OC433 normal, neighbours ±5°, contour 228, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 241 WHERE id = '53cc78d5-a759-4153-8a2e-b13cf1bb6b4e' AND aspect_deg IS NULL;
-- River Jetties: 210 (A: CDIP OC459 normal, neighbours ±3°, contour 212, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 210 WHERE id = 'a0e764f1-d0bb-4341-b397-7b21823cb93b' AND aspect_deg IS NULL;
-- Huntington State Beach: 208 (A: CDIP OC481 normal, neighbours ±4°, contour 211, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 208 WHERE id = '502bd50f-21c8-4cdc-ae96-1d53fcbc34de' AND aspect_deg IS NULL;
-- Huntington St.: 218 (A: CDIP OC508 normal, neighbours ±5°, contour 212, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 218 WHERE id = 'b57b32b9-0057-46f6-9fa9-cd35d5bd5319' AND aspect_deg IS NULL;
-- Huntington Beach Pier Southside: 220 (A: CDIP OC514 normal, neighbours ±7°, contour 218, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 220 WHERE id = '025cfc18-8357-49d6-994e-e0abf0a16f6d' AND aspect_deg IS NULL;
-- Huntington Beach Pier: 221 (A: CDIP OC515 normal, neighbours ±8°, contour 221, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 221 WHERE id = '071db1df-b5ee-4af6-a022-ea8a09667cbe' AND aspect_deg IS NULL;
-- Huntington Beach Pier Northside: 220 (A: CDIP OC514 normal, neighbours ±7°, contour 218, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 220 WHERE id = '72726bcb-bed0-4b76-8336-f90d7fb57159' AND aspect_deg IS NULL;
-- Goldenwest: 224 (A: CDIP OC541 normal, neighbours ±4°, contour 234, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 224 WHERE id = '66ef3c08-a8a2-4cf1-9361-273489bac45b' AND aspect_deg IS NULL;
-- HB Cliffs: 231 (A: CDIP OC570 normal, neighbours ±1°, contour 225, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 231 WHERE id = 'd60dd5c8-d147-4042-a531-c2ec55c620af' AND aspect_deg IS NULL;
-- Knob Hill (Redondo Beach): 270 (A: CDIP L0486 normal, neighbours ±2°, contour 282, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 270 WHERE id = '50b0ec6c-9254-5450-9b23-90cb85997cb1' AND aspect_deg IS NULL;
-- Sapphire Street (Redondo Beach): 273 (A: CDIP L0489 normal, neighbours ±2°, contour 295, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 273 WHERE id = 'c9ea72a3-d7bf-5f3d-b77e-1aa6cce81dee' AND aspect_deg IS NULL;
-- Hermosa Pier: 260 (twin — Duplicate of Hermosa Beach Pier (309 m away, 260°); CDIP 257 agrees.)
UPDATE public.beaches SET aspect_deg = 260 WHERE id = '37ffa92a-d811-4791-afbb-b90a86dcdf49' AND aspect_deg IS NULL;
-- El Porto (Manhattan): 248 (A: CDIP L0578 normal, neighbours ±1°, contour 254, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 248 WHERE id = '52879e4f-fc7f-4c02-a5e3-ea40b992ea80' AND aspect_deg IS NULL;
-- Rincon: 226 (A: CDIP VE656 normal, neighbours ±4°, contour 216, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 226 WHERE id = 'bec2d595-ed20-4c2b-93c7-4b880406332f' AND aspect_deg IS NULL;
-- Cowell Beach: 140 (B: map read — West of the Santa Cruz Wharf the beach faces SE; no CDIP match.)
UPDATE public.beaches SET aspect_deg = 140 WHERE id = '90df1267-5d2e-51b6-ba06-21e89405166c' AND aspect_deg IS NULL;
-- Santa Cruz Main Beach: 160 (B: map read — East of the wharf the main beach faces SSE; no CDIP match.)
UPDATE public.beaches SET aspect_deg = 160 WHERE id = '41637008-fad6-53f2-92ac-3377df9aec36' AND aspect_deg IS NULL;
-- Sharp Park Beach: 273 (A: CDIP SM404 normal, neighbours ±6°, contour 276, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 273 WHERE id = '090f4927-d319-53fb-990c-9c6bca55289b' AND aspect_deg IS NULL;
-- Muir Beach: 190 (B: map read — Cove faces S; CDIP neighbours spread 27°.)
UPDATE public.beaches SET aspect_deg = 190 WHERE id = 'f73cea3d-d7c7-57cf-b2d1-9a4370f75123' AND aspect_deg IS NULL;
-- Dillon Beach: 265 (B: map read — Waterline faces W; the CDIP point is 261 m off-transect.)
UPDATE public.beaches SET aspect_deg = 265 WHERE id = '0a76eb21-c49a-562a-ad1a-19240b44b543' AND aspect_deg IS NULL;
-- North Salmon Creek Beach: 265 (A: CDIP SN082 normal, neighbours ±14°, contour 261, confirmed on satellite)
UPDATE public.beaches SET aspect_deg = 265 WHERE id = 'a7a94616-4d60-5965-b1be-568890d162e8' AND aspect_deg IS NULL;
COMMIT;
