-- Beach aspect_deg corrections, tier 2 (audit 2026-10-01).
-- These are the 23 tier-2 suggestions whose value matched the waterline on satellite imagery (Esri World Imagery,
-- see the Validation section of .planning/2026-10-01-beach-aspect-audit.md). Cayucos is excluded (not judgeable).
-- Values are a read of the coastline, rounded to 5°, not a MOP point normal: CDIP MOP is unstable or loosely matched here.
-- Proposed only. Each row is guarded on the old value, so it is idempotent and won't overwrite a concurrent edit.
-- rows: 23

BEGIN;
-- Hotel Del Coronado: 320 -> 220 (MOP D0179 219, contour 184, v2 225, wind-offshore implies 225)
UPDATE public.beaches SET aspect_deg = 220 WHERE id = '84d3468b-c1ec-46ad-8621-d8507e5f167a' AND aspect_deg = 320;
-- New Break (Nubes): 245 -> 265 (MOP D0310 271, contour 258, v2 265, wind-offshore implies 225)
UPDATE public.beaches SET aspect_deg = 265 WHERE id = 'd920e1b9-9e23-4ba8-9f8e-776571435f6f' AND aspect_deg = 245;
-- Tourmaline Beach: 270 -> 240 (MOP D0416 226, contour 252, v2 240, wind-offshore implies 225)
UPDATE public.beaches SET aspect_deg = 240 WHERE id = '17628f35-9ed1-4257-aad6-070c4bd73bb8' AND aspect_deg = 270;
-- Marine Street Beach: 240 -> 270 (MOP D0465 272, contour 290, v2 260, wind-offshore implies 225)
UPDATE public.beaches SET aspect_deg = 270 WHERE id = '9b292a48-7a88-4d79-926f-16601515d7a0' AND aspect_deg = 240;
-- Lower Trestles: 270 -> 215 (MOP D1207 209, contour 225, v2 220, wind-offshore implies 247)
UPDATE public.beaches SET aspect_deg = 215 WHERE id = '193a3f9a-66d0-4362-bf55-d25bb831dae4' AND aspect_deg = 270;
-- 52nd Street: 260 -> 230 (MOP OC437 230, contour 212, v2 215, wind-offshore implies 270)
UPDATE public.beaches SET aspect_deg = 230 WHERE id = '1207215c-f61d-4fe1-bbaa-a3db7d4e7d53' AND aspect_deg = 260;
-- County Line: 260 -> 210 (MOP VE021 216, contour 229, v2 200, wind-offshore implies 180)
UPDATE public.beaches SET aspect_deg = 210 WHERE id = '71bdbe5a-67f6-429c-b1e4-80ec390ec4a3' AND aspect_deg = 260;
-- C Street / Ventura Point: 260 -> 205 (MOP VE461 160, contour 189, v2 220, wind-offshore implies 225)
UPDATE public.beaches SET aspect_deg = 205 WHERE id = '486dc095-4b21-4edb-838c-97f68b40d1df' AND aspect_deg = 260;
-- Mondos Beach: 260 -> 195 (MOP VE555 177, contour 208, v2 190, wind-offshore implies 225)
UPDATE public.beaches SET aspect_deg = 195 WHERE id = '9a64d63a-0c0c-40b7-bc97-d3d931204bba' AND aspect_deg = 260;
-- El Capitan: 280 -> 185 (MOP B0572 189, contour 178, v2 190, wind-offshore implies 225)
UPDATE public.beaches SET aspect_deg = 185 WHERE id = '4194e543-a87e-46ee-b317-56c5820c5567' AND aspect_deg = 280;
-- Refugio State Beach: 280 -> 175 (MOP B0622 173, contour 173, v2 190, wind-offshore implies 225)
UPDATE public.beaches SET aspect_deg = 175 WHERE id = 'a17f4c57-324d-4157-a641-fa935464302e' AND aspect_deg = 280;
-- Jalama Beach: 280 -> 235 (MOP B1089 244, contour 205, v2 230, wind-offshore implies 270)
UPDATE public.beaches SET aspect_deg = 235 WHERE id = '1ec3682e-d993-4c60-a650-f630e1ea3b06' AND aspect_deg = 280;
-- Pismo Pier: 270 -> 240 (MOP SL095 242, contour 222, v2 235, wind-offshore implies 270)
UPDATE public.beaches SET aspect_deg = 240 WHERE id = 'ee2aad76-966d-4aa3-86a2-499fde59b271' AND aspect_deg = 270;
-- Carmel River State Beach: 205 -> 250 (MOP MO630 251, contour 248, v2 285, wind-offshore implies 210)
UPDATE public.beaches SET aspect_deg = 250 WHERE id = 'a1a7c2e8-2b3f-4b0d-9a6a-3b9d3b6b6c06' AND aspect_deg = 205;
-- Del Monte Beach: 315 -> 345 (MOP MO769 347, contour 350, v2 345, wind-offshore implies 330)
UPDATE public.beaches SET aspect_deg = 345 WHERE id = 'a3d480de-3743-4dd7-8092-fb52772a0fb2' AND aspect_deg = 315;
-- Lovers Point: 315 -> 45 (MOP MO742 50, contour 41, v2 305, wind-offshore implies 0)
UPDATE public.beaches SET aspect_deg = 45 WHERE id = 'e5251554-03ce-49c3-b8e8-bc7a40ecd44e' AND aspect_deg = 315;
-- Moss Landing: 290 -> 260 (MOP MO897 262, contour 229, v2 260, wind-offshore implies 290)
UPDATE public.beaches SET aspect_deg = 260 WHERE id = '885ad595-67cb-4408-b4cc-9ecf2ce3a848' AND aspect_deg = 290;
-- Mitchell's Cove: 285 -> 185 (MOP SC156 173, contour 190, v2 200, wind-offshore implies 270)
UPDATE public.beaches SET aspect_deg = 185 WHERE id = 'abb56ca0-7dad-4026-960f-23412fa5cc8b' AND aspect_deg = 285;
-- Pleasure Point: 260 -> 160 (MOP SC116 136, contour 161, v2 210, wind-offshore implies 270)
UPDATE public.beaches SET aspect_deg = 160 WHERE id = 'cdfb7e59-ce4e-4112-acc5-15fe56a8b6a3' AND aspect_deg = 260;
-- 38th Avenue (Santa Cruz): 260 -> 155 (MOP SC113 147, contour 163, v2 205, wind-offshore implies 270)
UPDATE public.beaches SET aspect_deg = 155 WHERE id = '36a2d39e-64f1-4c7e-9618-ac8cc695af62' AND aspect_deg = 260;
-- The Hook: 260 -> 155 (MOP SC112 140, contour 165, v2 200, wind-offshore implies 270)
UPDATE public.beaches SET aspect_deg = 155 WHERE id = 'f3e1216f-2a17-47be-8c2e-67d8588ab065' AND aspect_deg = 260;
-- Ocean Beach SF – North: 280 -> 265 (MOP SF038 251, contour 268, v2 245, wind-offshore implies 270)
UPDATE public.beaches SET aspect_deg = 265 WHERE id = 'eca7e91a-0e5e-40d5-acb4-59c6ff50d861' AND aspect_deg = 280;
-- Stinson Beach: 280 -> 210 (MOP MA124 214, contour 193, v2 210, wind-offshore implies 270)
UPDATE public.beaches SET aspect_deg = 210 WHERE id = '5a5dc7b8-4d30-44af-9715-3dbb4dbc9859' AND aspect_deg = 280;
COMMIT;
