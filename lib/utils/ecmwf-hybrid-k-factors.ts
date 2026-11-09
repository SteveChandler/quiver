/**
 * Per-beach k for the ECMWF hybrid model_swell path ("RSS basis").
 *
 * At these beaches a model_swell hour scales its MFWAM components by
 * r = ECMWF WAM total Hs / sqrt(swell_1² + swell_2² + wind_wave²), clamps r to
 * ECMWF_HYBRID_R_MIN..ECMWF_HYBRID_R_MAX, runs the uncalibrated transform, and
 * multiplies by the k below in place of MODEL_SWELL_CALIBRATION_FACTORS. This
 * is a different ruler from the production factor, so the two tables stay
 * separate.
 *
 * Membership is the eligibility gate, so k = 1 entries stay in the table.
 * Excluded: station 215 (its 1.6 hold), beaches with a clamped refit or hybrid
 * k (0.8, 1.6 or 2.5), beaches with no ECMWF cell, and beaches with no live
 * CDIP truth. A beach that is not in the table yet also needs the entry gate:
 * held out by ISO week, its 0-24 h hybrid MAE is at or below its
 * production-factor MAE and its 0-24 h bias is within +/-0.2 ft.
 *
 * Generated — do not hand-edit entries. Refit this table and
 * MODEL_SWELL_CALIBRATION_FACTORS together, on the same rows and the same
 * truth, with one command:
 *   scripts/refit-model-swell-tables.sh .env.local 30 --write
 * Both tables are stale, and must be refit together, after any change to
 * beaches.shoaling_factors, direction_shadow, the CDIP station table
 * (lib/constants/cdip-stations.ts or a beach's cdip_station) or
 * wave-height-transformer.ts. The Nov 9 2026 defect: 10 Point Loma / Mission
 * Beach k were fit on truth that still had direction_shadow, read 21-39% low,
 * and had to come off the table (#1348).
 * Report: docs/forecast/hybrid-replay-by-lead-nov-2026.md (section 7, update).
 *
 * Fit 2026-11-09 at commit 1acf7a2cb over 30 days: ml_predictions_log
 * model_swell rows (predicted_at Oct 10-Nov 9 2026), 0-24 h leads, all weeks,
 * against CDIP 30-minute realtime truth through today's buckets. r is clamped
 * to ECMWF_HYBRID_R_MIN..MAX before the fit, as in production; rows with no
 * ECMWF value are left out. k rule: median(truth / hybrid face), at least 50
 * rows, clamp 0.8-2.5, k = 1 when |k - 1| < 0.08. Held out by week, refit ->
 * hybrid face MAE (no station 215, no clamped k): 0-24 h 0.68->0.57,
 * 1-3 d 0.70->0.62, 5-7 d 0.92->0.74 ft.
 */
export const ECMWF_HYBRID_FIT_DATE = "2026-11-09";
export const ECMWF_HYBRID_R_MIN = 0.5;
export const ECMWF_HYBRID_R_MAX = 2;

export const ECMWF_HYBRID_K_FACTORS: Readonly<Record<string, number>> = {
  "0f0dcd5a-be9d-4c0d-a7ba-d6f932f9b769": 0.86, // Agate Street (CDIP 45)
  "dbbafa09-3143-4f73-82e8-90a69a4121f5": 1.00, // Big Rock (CDIP 201)
  "ca2b1d6f-2428-4273-ab02-7555eeec4323": 1.00, // Birdrock (CDIP 201)
  "01330afc-00d3-461b-88f3-b173774766f4": 1.09, // Blacks Beach (CDIP 201)
  "1f8660f2-891d-4f79-8f16-cad8ebd59c79": 0.87, // Brooks Street (CDIP 45)
  "486dc095-4b21-4edb-838c-97f68b40d1df": 1.21, // C Street / Ventura Point (CDIP 203)
  "80efa1c0-37a2-4879-819b-647ae3c3d749": 1.00, // Cardiff Reef (CDIP 153)
  "c0977bcd-5475-4745-b4b8-0ca1e16a7faf": 1.37, // Carlsbad State Beach (CDIP 45)
  "a0332432-4877-48c5-855d-b30fd097ba38": 1.51, // Church (CDIP 45)
  "2c1d7948-72c1-4787-93e8-f33ac9567db0": 1.53, // Cottons (CDIP 45)
  "902a215b-2a3d-40af-9391-16b0afed7dee": 0.84, // D Street (CDIP 153)
  "5e72b79d-a12d-4cd3-8da4-b7b92069efbf": 1.00, // Del Mar (CDIP 153)
  "7fc84dd8-abcc-4d7c-9ade-3d1500c1c24c": 1.00, // Del Mar Rivermouth (CDIP 153)
  "a57ae4c8-7a27-4d3f-91d5-6229350fb888": 1.20, // Doheny Beach (CDIP 45)
  "21eae8b9-387c-438c-b144-55796bab5caa": 1.10, // Emma Wood (CDIP 203)
  "e5fee219-672c-4113-a0bb-a86a5d97700f": 1.17, // Forster St. Oceanside (CDIP 45)
  "30e68b00-c27d-4d22-ba57-2d92156964c6": 1.00, // Horseshoe (CDIP 201)
  "9e94759c-d531-4e5c-9bc2-d022acea9dcd": 1.00, // Imperial Beach (CDIP 191)
  "d9f93c82-7f4b-440a-865a-55cdbb821f74": 1.40, // Imperial Beach Pier (CDIP 191)
  "ca9f0f1b-f4f5-4601-91c5-5e972c5f1a41": 1.10, // Latigo Point (CDIP 103)
  "a13f108b-ad2a-43fa-8ea7-40577ebce66c": 1.00, // Leo Carrillo State Beach (CDIP 103)
  "9b292a48-7a88-4d79-926f-16601515d7a0": 1.00, // Marine Street Beach (CDIP 201)
  "b5bcd27f-3399-4a0a-b5d5-da8147e43b9a": 1.18, // Middles (CDIP 45)
  "c02b4ede-69d9-440e-b8de-22ea4bde10ef": 1.35, // Mission Beach (CDIP 220)
  "cdcf733b-a704-45ef-affc-d8152ffde1e4": 1.50, // Mission Beach (Central) (CDIP 220)
  "15c7337e-5258-4339-9dc3-c435c666926b": 1.57, // Ocean Beach (CDIP 220)
  "65d177de-e75a-4ad8-aa0d-48a67c0851b0": 1.50, // Ocean Beach Pier (CDIP 220)
  "a30b9870-aace-48ef-a3e6-e275ad9c28c1": 1.77, // Oceanside Harbor (CDIP 45)
  "cceecad1-7668-4ad8-88ff-ade893c605cd": 1.48, // Oceanside Pier (CDIP 45)
  "a956de46-b204-448e-a541-db427be7e85f": 1.55, // Old Man's (SanO) (CDIP 45)
  "13ef0aa1-c857-4d82-a40d-a83612110943": 2.22, // PB Point (CDIP 201)
  "65809772-20bc-4009-b9b2-89c8ef3c4127": 1.15, // Pacific Beach (CDIP 201)
  "b9c4a949-4562-47db-ae7d-b2131e20d7a7": 1.26, // Poche Beach (CDIP 45)
  "bba95994-b2a3-4505-8e6f-1f85ccfbb0dc": 1.53, // Point Dume (CDIP 103)
  "badd7986-4609-421a-ab3d-81fcd8409a5b": 1.00, // Ponto (CDIP 153)
  "f0ddfc6a-7392-40c5-9211-836c05e449f1": 1.00, // Rosarito (CDIP 191)
  "73bb4a48-3d53-42ba-bbd0-d89a7cf95711": 1.26, // Salt Creek (CDIP 45)
  "e99552bf-45bd-46a8-a716-4cdfff2061f2": 1.24, // San Clemente Pier, Northside (CDIP 45)
  "02dfc45e-f7f8-4fdc-8008-6ce14e2839f5": 1.00, // San Clemente State Beach (CDIP 45)
  "8a47b323-0874-45d9-aa17-ced468f70f2d": 1.63, // San Onofre State Beach (CDIP 45)
  "5a34b2ac-01b9-4b83-8c05-c47b1b55d923": 1.00, // Seaside Reef (CDIP 153)
  "80e4aada-7d4a-4df1-b11b-841a97603979": 1.21, // Strands (CDIP 45)
  "d305ba0d-47cd-4494-b790-f924dac7bf1f": 1.19, // Sunset Cliffs North (Garbage) (CDIP 191)
  "34af0af5-b61c-4b86-9d9d-bf328f538a12": 1.38, // Sunset Cliffs – Luscombs (CDIP 191)
  "dfeecc16-6395-4600-89e6-baf8456e3d69": 1.20, // T-Street (CDIP 45)
  "b1b49703-2376-407d-b1fb-9df06130ac1d": 0.90, // Tamarack (CDIP 45)
  "762fcfa2-8fd8-40ea-8955-b9cc6945a422": 1.34, // The Rock, Oceanside (CDIP 45)
  "4bdbff9e-2c1f-4918-84a6-aed42fb6e42c": 1.31, // Torrey Pines State Beach (CDIP 153)
  "17628f35-9ed1-4257-aad6-070c4bd73bb8": 2.00, // Tourmaline Beach (CDIP 201)
  "91df193c-f2c8-4e6c-984e-b859bd741061": 2.06, // Tourmaline Surf Park (CDIP 201)
  "2f3e2136-b094-49d7-b90f-948160cbb854": 1.00, // Trails (CDIP 45)
  "6f42d47d-215b-47cb-ac14-b83bf8c2a797": 1.00, // Windansea (CDIP 201)
};
