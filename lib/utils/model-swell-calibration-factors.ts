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
 * Fit 2026-11-05 at commit 967a6b7f8 over 30 days: ml_predictions_log
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

/**
 * Lower cap by cdip_station, hand-set. Edit it in this file: a refit reads it
 * and writes it back unchanged.
 *
 * "215" (Long Beach Channel; Huntington and Newport): the Nov 2026 fit gave
 * 1.8-2.3, but the window was 82-98% south swell and in model-west hours the
 * buoy/model ratio was about 1.0, so a single k over-calls west swell here
 * (Nov 13 replay: HB Pier Northside 9.7-10.4 ft against a plausible 5.5-7).
 * The buckets these beaches are fit to also disagree with CDIP MOP. Held at
 * the old 1.6 cap until a buoy-confirmed 11 s+ west swell validates the fit;
 * delete the entry and refit then.
 */
export const MODEL_SWELL_STATION_FACTOR_HOLDS: Readonly<Record<string, number>> = {
  "215": 1.6,
};

export const MODEL_SWELL_CALIBRATION_FACTORS: Readonly<Record<string, number>> = {
  "1207215c-f61d-4fe1-bbaa-a3db7d4e7d53": 1.28, // 52nd Street (n=235)
  "da8ad733-8e6b-4781-8b3f-0fe4ee492c3f": 1.15, // 54th Street (n=235)
  "63af8c07-1aed-44bd-b03b-9b20abdff56c": 1.25, // Avalanche (n=234)
  "ec73bb77-4be5-4126-8986-348929c1e7e9": 2.50, // Big Jetty (n=234)
  "dbbafa09-3143-4f73-82e8-90a69a4121f5": 0.91, // Big Rock (n=117)
  "ca2b1d6f-2428-4273-ab02-7555eeec4323": 0.91, // Birdrock (n=117)
  "80efa1c0-37a2-4879-819b-647ae3c3d749": 1.42, // Cardiff Reef (n=234)
  "c0977bcd-5475-4745-b4b8-0ca1e16a7faf": 1.56, // Carlsbad State Beach (n=234)
  "a0332432-4877-48c5-855d-b30fd097ba38": 1.82, // Church (n=234)
  "12e0096c-9826-443f-9131-53aaa646f789": 1.19, // Corona del Mar (n=234)
  "2c1d7948-72c1-4787-93e8-f33ac9567db0": 1.81, // Cottons (n=234)
  "cc7c0837-257c-42c3-9d98-634911e73a6a": 2.50, // Crystal Pier (n=117)
  "902a215b-2a3d-40af-9391-16b0afed7dee": 1.13, // D Street (n=234)
  "5e72b79d-a12d-4cd3-8da4-b7b92069efbf": 1.23, // Del Mar (n=234)
  "7fc84dd8-abcc-4d7c-9ade-3d1500c1c24c": 1.13, // Del Mar Rivermouth (n=235)
  "a57ae4c8-7a27-4d3f-91d5-6229350fb888": 1.24, // Doheny Beach (n=106)
  "a4575b12-2bc3-44d4-ba53-4415707f3851": 0.80, // Doheny State Beach (n=106)
  "e5fee219-672c-4113-a0bb-a86a5d97700f": 1.43, // Forster St. Oceanside (n=234)
  "66ef3c08-a8a2-4cf1-9361-273489bac45b": 1.60, // Goldenwest (n=234)
  "d60dd5c8-d147-4042-a531-c2ec55c620af": 1.28, // HB Cliffs (n=234)
  "071db1df-b5ee-4af6-a022-ea8a09667cbe": 1.60, // Huntington Beach Pier (n=235)
  "72726bcb-bed0-4b76-8336-f90d7fb57159": 1.60, // Huntington Beach Pier Northside (n=234)
  "025cfc18-8357-49d6-994e-e0abf0a16f6d": 1.60, // Huntington Beach Pier Southside (n=234)
  "b57b32b9-0057-46f6-9fa9-cd35d5bd5319": 1.60, // Huntington St. (n=234)
  "502bd50f-21c8-4cdc-ae96-1d53fcbc34de": 1.60, // Huntington State Beach (n=234)
  "1ec3682e-d993-4c60-a650-f630e1ea3b06": 0.80, // Jalama Beach (n=163)
  "d291411d-d331-4bf1-ad1a-302da3c69de0": 0.83, // La Jolla Shores (n=117)
  "193a3f9a-66d0-4362-bf55-d25bb831dae4": 2.50, // Lower Trestles (n=234)
  "9b292a48-7a88-4d79-926f-16601515d7a0": 1.08, // Marine Street Beach (n=117)
  "b5bcd27f-3399-4a0a-b5d5-da8147e43b9a": 1.43, // Middles (n=234)
  "cdcf733b-a704-45ef-affc-d8152ffde1e4": 1.08, // Mission Beach (Central) (n=234)
  "53cc78d5-a759-4153-8a2e-b13cf1bb6b4e": 1.17, // Newport 56th St (n=235)
  "bbe7f4eb-9807-4e65-8e69-e2cee28d6b24": 1.60, // Newport Lower Jetties (n=235)
  "11662c67-a1bb-43a0-b0f7-0e4071b1c3f2": 1.17, // Newport Point (n=235)
  "e64001e6-e2bd-4596-8f24-d8064e7f5186": 1.60, // Newport Upper Jetties (n=235)
  "15c7337e-5258-4339-9dc3-c435c666926b": 1.18, // Ocean Beach (n=234)
  "65d177de-e75a-4ad8-aa0d-48a67c0851b0": 1.11, // Ocean Beach Pier (n=234)
  "a30b9870-aace-48ef-a3e6-e275ad9c28c1": 2.21, // Oceanside Harbor (n=234)
  "cceecad1-7668-4ad8-88ff-ade893c605cd": 1.87, // Oceanside Pier (n=234)
  "a956de46-b204-448e-a541-db427be7e85f": 1.88, // Old Man's (SanO) (n=234)
  "65809772-20bc-4009-b9b2-89c8ef3c4127": 1.10, // Pacific Beach (n=117)
  "13ef0aa1-c857-4d82-a40d-a83612110943": 2.25, // PB Point (n=117)
  "b9c4a949-4562-47db-ae7d-b2131e20d7a7": 1.33, // Poche Beach (n=234)
  "badd7986-4609-421a-ab3d-81fcd8409a5b": 1.25, // Ponto (n=235)
  "a0e764f1-d0bb-4341-b397-7b21823cb93b": 1.60, // River Jetties (n=234)
  "73bb4a48-3d53-42ba-bbd0-d89a7cf95711": 1.38, // Salt Creek (n=235)
  "e99552bf-45bd-46a8-a716-4cdfff2061f2": 1.34, // San Clemente Pier, Northside (n=235)
  "02dfc45e-f7f8-4fdc-8008-6ce14e2839f5": 1.09, // San Clemente State Beach (n=234)
  "8a47b323-0874-45d9-aa17-ced468f70f2d": 1.94, // San Onofre State Beach (n=234)
  "4b0cf129-c706-4e24-8210-2219defc5ea7": 0.80, // Scripps (n=117)
  "5a34b2ac-01b9-4b83-8c05-c47b1b55d923": 1.44, // Seaside Reef (n=234)
  "80e4aada-7d4a-4df1-b11b-841a97603979": 1.32, // Strands (n=234)
  "34af0af5-b61c-4b86-9d9d-bf328f538a12": 0.90, // Sunset Cliffs – Luscombs (n=180)
  "b24c6fa9-9f82-4a1e-afcd-0d1fb0ce69d0": 2.47, // Swami's (n=234)
  "dfeecc16-6395-4600-89e6-baf8456e3d69": 1.30, // T-Street (n=235)
  "2a2195ef-27d1-4b35-a006-b7177b34dad2": 0.83, // Thalia Street (n=107)
  "762fcfa2-8fd8-40ea-8955-b9cc6945a422": 1.68, // The Rock, Oceanside (n=234)
  "c2c7cc01-4920-4fd9-941c-68df6b46ced0": 1.60, // The Wedge (n=234)
  "4bdbff9e-2c1f-4918-84a6-aed42fb6e42c": 1.51, // Torrey Pines State Beach (n=234)
  "17628f35-9ed1-4257-aad6-070c4bd73bb8": 2.07, // Tourmaline Beach (n=117)
  "91df193c-f2c8-4e6c-984e-b859bd741061": 2.09, // Tourmaline Surf Park (n=117)
  "2f3e2136-b094-49d7-b90f-948160cbb854": 1.21, // Trails (n=235)
  "f924aa96-395f-41e0-b966-502b37def7ac": 2.47, // Upper Trestles (n=234)
};
