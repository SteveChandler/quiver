/**
 * Per-beach multiplier on model_swell face heights at CDIP-calibrated beaches.
 *
 * Model hours and buoy hours use different rulers: buoy hours go through the
 * beach's measured shoaling buckets, model hours through the generic
 * period/terrain factor. In Orange County the model ruler reads about half
 * the buoy ruler, so the forecast dropped at the CDIP→model handoff. #1238
 * removed the seam taper that had been hiding this. Each factor here is the
 * median of (CDIP-path face / uncalibrated model face) over matched hours, so
 * a beach's model hours land on its buoy ruler.
 *
 * Generated — do not hand-edit entries. Refit monthly; the fit only covers the
 * season in the window.
 *   node --import tsx scripts/replay-model-swell-calibration.ts .env.local 30 --write --seam-fixtures
 *
 * Fit 2026-11-05 at commit 672873723 over 30 days: ml_predictions_log
 * model_swell rows, horizon 12-48 h, CDIP 30-minute realtime buoy reading
 * within 45 min. A beach gets an entry only with at least
 * MODEL_SWELL_FACTOR_MIN_ROWS rows and |k - 1| >= MODEL_SWELL_FACTOR_MIN_EFFECT.
 * The fit is only valid for the transform at that commit; refit after any
 * change to wave-height-transformer.ts.
 *
 * The cap was 1.6 until Nov 2026, when it bound at 30 of 91 beaches; a
 * held-out half scored 0.69 ft MAE at 2.5 against 0.85 at 1.6. Factors above
 * MODEL_SWELL_FACTOR_REVIEW still ship but are listed for a settings review.
 */
export const MODEL_SWELL_FACTOR_MIN = 0.8;
export const MODEL_SWELL_FACTOR_MAX = 2.5;
export const MODEL_SWELL_FACTOR_REVIEW = 1.6;
export const MODEL_SWELL_FACTOR_MIN_EFFECT = 0.08;
export const MODEL_SWELL_FACTOR_MIN_ROWS = 100;

export const MODEL_SWELL_CALIBRATION_FACTORS: Readonly<Record<string, number>> = {
  "047e61b4-b4a8-4042-a290-f2189b5a70ca": 1.59, // 204s (n=239)
  "1207215c-f61d-4fe1-bbaa-a3db7d4e7d53": 1.28, // 52nd Street (n=239)
  "da8ad733-8e6b-4781-8b3f-0fe4ee492c3f": 1.16, // 54th Street (n=239)
  "63af8c07-1aed-44bd-b03b-9b20abdff56c": 1.85, // Avalanche (n=239)
  "ec73bb77-4be5-4126-8986-348929c1e7e9": 2.50, // Big Jetty (n=239)
  "dbbafa09-3143-4f73-82e8-90a69a4121f5": 0.91, // Big Rock (n=114)
  "ca2b1d6f-2428-4273-ab02-7555eeec4323": 0.91, // Birdrock (n=114)
  "486dc095-4b21-4edb-838c-97f68b40d1df": 1.38, // C Street / Ventura Point (n=199)
  "80efa1c0-37a2-4879-819b-647ae3c3d749": 1.41, // Cardiff Reef (n=239)
  "c0977bcd-5475-4745-b4b8-0ca1e16a7faf": 1.56, // Carlsbad State Beach (n=239)
  "a0332432-4877-48c5-855d-b30fd097ba38": 1.81, // Church (n=239)
  "12e0096c-9826-443f-9131-53aaa646f789": 1.19, // Corona del Mar (n=239)
  "2c1d7948-72c1-4787-93e8-f33ac9567db0": 1.82, // Cottons (n=239)
  "71bdbe5a-67f6-429c-b1e4-80ec390ec4a3": 2.50, // County Line (n=231)
  "cc7c0837-257c-42c3-9d98-634911e73a6a": 2.50, // Crystal Pier (n=114)
  "902a215b-2a3d-40af-9391-16b0afed7dee": 1.13, // D Street (n=239)
  "5e72b79d-a12d-4cd3-8da4-b7b92069efbf": 1.22, // Del Mar (n=239)
  "7fc84dd8-abcc-4d7c-9ade-3d1500c1c24c": 1.12, // Del Mar Rivermouth (n=239)
  "a57ae4c8-7a27-4d3f-91d5-6229350fb888": 1.21, // Doheny Beach (n=112)
  "a4575b12-2bc3-44d4-ba53-4415707f3851": 0.80, // Doheny State Beach (n=112)
  "21eae8b9-387c-438c-b144-55796bab5caa": 1.33, // Emma Wood (n=199)
  "e5fee219-672c-4113-a0bb-a86a5d97700f": 1.42, // Forster St. Oceanside (n=239)
  "66ef3c08-a8a2-4cf1-9361-273489bac45b": 1.90, // Goldenwest (n=239)
  "d60dd5c8-d147-4042-a531-c2ec55c620af": 1.28, // HB Cliffs (n=239)
  "071db1df-b5ee-4af6-a022-ea8a09667cbe": 1.96, // Huntington Beach Pier (n=239)
  "72726bcb-bed0-4b76-8336-f90d7fb57159": 2.42, // Huntington Beach Pier Northside (n=239)
  "025cfc18-8357-49d6-994e-e0abf0a16f6d": 2.05, // Huntington Beach Pier Southside (n=239)
  "b57b32b9-0057-46f6-9fa9-cd35d5bd5319": 2.27, // Huntington St. (n=239)
  "502bd50f-21c8-4cdc-ae96-1d53fcbc34de": 1.79, // Huntington State Beach (n=239)
  "1ec3682e-d993-4c60-a650-f630e1ea3b06": 0.83, // Jalama Beach (n=168)
  "d291411d-d331-4bf1-ad1a-302da3c69de0": 0.82, // La Jolla Shores (n=114)
  "193a3f9a-66d0-4362-bf55-d25bb831dae4": 2.50, // Lower Trestles (n=239)
  "9b292a48-7a88-4d79-926f-16601515d7a0": 1.08, // Marine Street Beach (n=114)
  "b5bcd27f-3399-4a0a-b5d5-da8147e43b9a": 1.41, // Middles (n=239)
  "c02b4ede-69d9-440e-b8de-22ea4bde10ef": 1.44, // Mission Beach (n=239)
  "cdcf733b-a704-45ef-affc-d8152ffde1e4": 1.57, // Mission Beach (Central) (n=239)
  "d920e1b9-9e23-4ba8-9f8e-776571435f6f": 1.42, // New Break (Nubes) (n=185)
  "53cc78d5-a759-4153-8a2e-b13cf1bb6b4e": 1.17, // Newport 56th St (n=239)
  "bbe7f4eb-9807-4e65-8e69-e2cee28d6b24": 1.85, // Newport Lower Jetties (n=239)
  "11662c67-a1bb-43a0-b0f7-0e4071b1c3f2": 1.17, // Newport Point (n=239)
  "e64001e6-e2bd-4596-8f24-d8064e7f5186": 2.23, // Newport Upper Jetties (n=239)
  "15c7337e-5258-4339-9dc3-c435c666926b": 1.67, // Ocean Beach (n=239)
  "65d177de-e75a-4ad8-aa0d-48a67c0851b0": 1.61, // Ocean Beach Pier (n=239)
  "d9524c9d-8315-4686-9d35-24ceb6db2a82": 1.44, // Ocean Beach SF – Sloat (n=236)
  "a30b9870-aace-48ef-a3e6-e275ad9c28c1": 2.19, // Oceanside Harbor (n=239)
  "cceecad1-7668-4ad8-88ff-ade893c605cd": 1.86, // Oceanside Pier (n=239)
  "a956de46-b204-448e-a541-db427be7e85f": 1.86, // Old Man's (SanO) (n=239)
  "c3b42f85-e650-445f-89b1-1debe661652e": 1.46, // Osprey Point (n=185)
  "65809772-20bc-4009-b9b2-89c8ef3c4127": 1.10, // Pacific Beach (n=114)
  "13ef0aa1-c857-4d82-a40d-a83612110943": 2.23, // PB Point (n=114)
  "b9c4a949-4562-47db-ae7d-b2131e20d7a7": 1.32, // Poche Beach (n=239)
  "badd7986-4609-421a-ab3d-81fcd8409a5b": 1.24, // Ponto (n=239)
  "bec2d595-ed20-4c2b-93c7-4b880406332f": 1.27, // Rincon (n=199)
  "a0e764f1-d0bb-4341-b397-7b21823cb93b": 2.35, // River Jetties (n=239)
  "73bb4a48-3d53-42ba-bbd0-d89a7cf95711": 1.38, // Salt Creek (n=239)
  "e99552bf-45bd-46a8-a716-4cdfff2061f2": 1.33, // San Clemente Pier, Northside (n=239)
  "8a47b323-0874-45d9-aa17-ced468f70f2d": 1.93, // San Onofre State Beach (n=239)
  "4b0cf129-c706-4e24-8210-2219defc5ea7": 0.80, // Scripps (n=114)
  "5a34b2ac-01b9-4b83-8c05-c47b1b55d923": 1.44, // Seaside Reef (n=239)
  "411b3825-c047-4628-997d-08712117ad56": 0.80, // Solimar Reef (n=199)
  "80e4aada-7d4a-4df1-b11b-841a97603979": 1.32, // Strands (n=239)
  "b939f928-2653-494a-831d-6394cb548190": 1.33, // Sunset Cliffs – Garbage (n=185)
  "34af0af5-b61c-4b86-9d9d-bf328f538a12": 1.42, // Sunset Cliffs – Luscombs (n=185)
  "d305ba0d-47cd-4494-b790-f924dac7bf1f": 1.22, // Sunset Cliffs North (Garbage) (n=185)
  "b24c6fa9-9f82-4a1e-afcd-0d1fb0ce69d0": 2.47, // Swami's (n=239)
  "dfeecc16-6395-4600-89e6-baf8456e3d69": 1.29, // T-Street (n=239)
  "2a2195ef-27d1-4b35-a006-b7177b34dad2": 0.83, // Thalia Street (n=112)
  "762fcfa2-8fd8-40ea-8955-b9cc6945a422": 1.67, // The Rock, Oceanside (n=239)
  "c2c7cc01-4920-4fd9-941c-68df6b46ced0": 1.62, // The Wedge (n=239)
  "4bdbff9e-2c1f-4918-84a6-aed42fb6e42c": 1.50, // Torrey Pines State Beach (n=239)
  "17628f35-9ed1-4257-aad6-070c4bd73bb8": 2.00, // Tourmaline Beach (n=114)
  "91df193c-f2c8-4e6c-984e-b859bd741061": 2.08, // Tourmaline Surf Park (n=114)
  "2f3e2136-b094-49d7-b90f-948160cbb854": 1.20, // Trails (n=239)
  "f924aa96-395f-41e0-b966-502b37def7ac": 2.46, // Upper Trestles (n=239)
};
