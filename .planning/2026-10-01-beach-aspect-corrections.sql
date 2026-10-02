-- Beach aspect_deg corrections from CDIP MOP shore normals (audit 2026-10-01).
-- Proposed only: production is read-only; Steven applies with an APPROVE: <sha> token.
-- Rule: MOP neighbours within 20° and the contour bearing within 25° of the matched normal; match within 100 m
-- of the transect and 1200 m of the pin; and wind_offshore_deg + 180 within 35° of the MOP normal.
-- New value = the matched MOP point's shore normal, rounded (same source as beaches.mop_shore_normal_deg).
-- Each row is guarded on the old value, so it is idempotent and won't overwrite a concurrent edit.
-- rows: 27. Summary and the other 52 disagreements: .planning/2026-10-01-beach-aspect-audit.md

BEGIN;
-- Tijuana Sloughs: 310 -> 257 (MOP D0020, neighbours ±7°, contour 238, wind-offshore implies 225, v2 270)
UPDATE public.beaches SET aspect_deg = 257 WHERE id = '929caa5e-c79f-4b60-8fe0-bec75c2df2d6' AND aspect_deg = 310;
-- Silver Strand State Beach: 190 -> 248 (MOP D0127, neighbours ±6°, contour 242, wind-offshore implies 225, v2 240)
UPDATE public.beaches SET aspect_deg = 248 WHERE id = '94f1010b-c71f-4025-bda1-c26ed9467c85' AND aspect_deg = 190;
-- Coronado North Jetty: 320 -> 222 (MOP D0174, neighbours ±4°, contour 211, wind-offshore implies 225, v2 230)
UPDATE public.beaches SET aspect_deg = 222 WHERE id = 'b29821f9-c91a-486f-981b-7085c6d86b68' AND aspect_deg = 320;
-- La Jolla Shores: 270 -> 298 (MOP D0502, neighbours ±8°, contour 283, wind-offshore implies 315, v2 310)
UPDATE public.beaches SET aspect_deg = 298 WHERE id = 'd291411d-d331-4bf1-ad1a-302da3c69de0' AND aspect_deg = 270;
-- Seaside Reef: 270 -> 243 (MOP D0664, neighbours ±15°, contour 259, wind-offshore implies 225, v2 255)
UPDATE public.beaches SET aspect_deg = 243 WHERE id = '5a34b2ac-01b9-4b83-8c05-c47b1b55d923' AND aspect_deg = 270;
-- San Elijo State Beach: 270 -> 247 (MOP D0693, neighbours ±5°, contour 247, wind-offshore implies 225, v2 250)
UPDATE public.beaches SET aspect_deg = 247 WHERE id = '09affcd2-1eca-4f7d-852e-413972ea4154' AND aspect_deg = 270;
-- Pipes: 270 -> 248 (MOP D0695, neighbours ±2°, contour 247, wind-offshore implies 225, v2 255)
UPDATE public.beaches SET aspect_deg = 248 WHERE id = '2380adaa-a07c-44f4-9444-656ef51fa998' AND aspect_deg = 270;
-- Terramar Point: 270 -> 233 (MOP D0819, neighbours ±6°, contour 234, wind-offshore implies 225, v2 240)
UPDATE public.beaches SET aspect_deg = 233 WHERE id = '1fe4bf73-c425-48a5-899d-a7e8ee2d67e3' AND aspect_deg = 270;
-- Tamarack: 270 -> 236 (MOP D0855, neighbours ±3°, contour 240, wind-offshore implies 270, v2 240)
UPDATE public.beaches SET aspect_deg = 236 WHERE id = 'b1b49703-2376-407d-b1fb-9df06130ac1d' AND aspect_deg = 270;
-- Carlsbad State Beach: 270 -> 236 (MOP D0855, neighbours ±3°, contour 240, wind-offshore implies 225, v2 240)
UPDATE public.beaches SET aspect_deg = 236 WHERE id = 'c0977bcd-5475-4745-b4b8-0ca1e16a7faf' AND aspect_deg = 270;
-- Forster St. Oceanside: 270 -> 234 (MOP D0894, neighbours ±2°, contour 232, wind-offshore implies 225, v2 240)
UPDATE public.beaches SET aspect_deg = 234 WHERE id = 'e5fee219-672c-4113-a0bb-a86a5d97700f' AND aspect_deg = 270;
-- Oceanside Pier: 270 -> 231 (MOP D0903, neighbours ±3°, contour 221, wind-offshore implies 225, v2 240)
UPDATE public.beaches SET aspect_deg = 231 WHERE id = 'cceecad1-7668-4ad8-88ff-ade893c605cd' AND aspect_deg = 270;
-- The Rock, Oceanside: 270 -> 235 (MOP D0909, neighbours ±3°, contour 225, wind-offshore implies 225, v2 240)
UPDATE public.beaches SET aspect_deg = 235 WHERE id = '762fcfa2-8fd8-40ea-8955-b9cc6945a422' AND aspect_deg = 270;
-- 204s: 270 -> 220 (MOP OC074, neighbours ±5°, contour 221, wind-offshore implies 225, v2 220)
UPDATE public.beaches SET aspect_deg = 220 WHERE id = '047e61b4-b4a8-4042-a290-f2189b5a70ca' AND aspect_deg = 270;
-- 54th Street: 260 -> 236 (MOP OC435, neighbours ±7°, contour 222, wind-offshore implies 270, v2 215)
UPDATE public.beaches SET aspect_deg = 236 WHERE id = 'da8ad733-8e6b-4781-8b3f-0fe4ee492c3f' AND aspect_deg = 260;
-- Palos Verdes Cove: 240 -> 327 (MOP L0426, neighbours ±10°, contour 319, wind-offshore implies 315, v2 260)
UPDATE public.beaches SET aspect_deg = 327 WHERE id = '9a3da3b5-e25b-45a4-b9dd-3ba6bc75a9fa' AND aspect_deg = 240;
-- Torrance Beach (RAT Beach): 250 -> 280 (MOP L0467, neighbours ±2°, contour 293, wind-offshore implies 270, v2 280)
UPDATE public.beaches SET aspect_deg = 280 WHERE id = 'a3e9d10c-92e9-4302-b808-a3de0c2eca22' AND aspect_deg = 250;
-- Manhattan Beach Pier: 270 -> 246 (MOP L0555, neighbours ±0°, contour 241, wind-offshore implies 270, v2 245)
UPDATE public.beaches SET aspect_deg = 246 WHERE id = '7a093b7e-2230-4bf1-abeb-9b31faa794d5' AND aspect_deg = 270;
-- Venice Beach: 260 -> 224 (MOP L0692, neighbours ±8°, contour 234, wind-offshore implies 225, v2 220)
UPDATE public.beaches SET aspect_deg = 224 WHERE id = '11467f21-5a69-430d-9eb9-05a46cd39990' AND aspect_deg = 260;
-- Santa Monica Beach: 250 -> 212 (MOP L0716, neighbours ±15°, contour 222, wind-offshore implies 225, v2 220)
UPDATE public.beaches SET aspect_deg = 212 WHERE id = '29fefd13-7472-4ce8-9c3c-be3dabcbb233' AND aspect_deg = 250;
-- Bay Street: 260 -> 233 (MOP L0720, neighbours ±15°, contour 226, wind-offshore implies 225, v2 220)
UPDATE public.beaches SET aspect_deg = 233 WHERE id = '6c4b160d-8aba-4078-aca7-9bde1bf81738' AND aspect_deg = 260;
-- Zuma Beach: 260 -> 221 (MOP L1069, neighbours ±1°, contour 220, wind-offshore implies 225, v2 185)
UPDATE public.beaches SET aspect_deg = 221 WHERE id = '836f218a-9471-46c9-b201-24da1dfe0f3a' AND aspect_deg = 260;
-- Will Rogers State Beach: 250 -> 207 (MOP L0756, neighbours ±2°, contour 214, wind-offshore implies 225, v2 210)
UPDATE public.beaches SET aspect_deg = 207 WHERE id = '3f1eeb72-41c1-4f58-9621-fd13df129c1a' AND aspect_deg = 250;
-- Topanga: 260 -> 176 (MOP L0822, neighbours ±2°, contour 184, wind-offshore implies 180, v2 200)
UPDATE public.beaches SET aspect_deg = 176 WHERE id = '101bd2f7-e1dc-4940-b4e3-3a820d5940dd' AND aspect_deg = 260;
-- Emma Wood: 250 -> 205 (MOP VE491, neighbours ±6°, contour 208, wind-offshore implies 225, v2 225)
UPDATE public.beaches SET aspect_deg = 205 WHERE id = '21eae8b9-387c-438c-b144-55796bab5caa' AND aspect_deg = 250;
-- Solimar Reef: 260 -> 222 (MOP VE536, neighbours ±5°, contour 214, wind-offshore implies 225, v2 220)
UPDATE public.beaches SET aspect_deg = 222 WHERE id = '411b3825-c047-4628-997d-08712117ad56' AND aspect_deg = 260;
-- Mesa Lane: 275 -> 210 (MOP B0267, neighbours ±8°, contour 207, wind-offshore implies 225, v2 190)
UPDATE public.beaches SET aspect_deg = 210 WHERE id = '0f0a1339-f7d0-4b1a-ae95-61939998b4ef' AND aspect_deg = 275;
COMMIT;
