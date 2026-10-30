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
 * season in the window (this one: fall south swell).
 *   node --import tsx scripts/replay-model-swell-calibration.ts .env.local 30 --write --seam-fixtures
 *
 * Fit 2026-10-30 over 30 days: ml_predictions_log model_swell rows, horizon
 * 12-48 h, buoy observation within 45 min. A beach gets an entry only with
 * at least MODEL_SWELL_FACTOR_MIN_ROWS rows and |k - 1| >= MODEL_SWELL_FACTOR_MIN_EFFECT.
 */
export const MODEL_SWELL_FACTOR_MIN = 0.8;
export const MODEL_SWELL_FACTOR_MAX = 1.6;
export const MODEL_SWELL_FACTOR_MIN_EFFECT = 0.08;
export const MODEL_SWELL_FACTOR_MIN_ROWS = 100;

export const MODEL_SWELL_CALIBRATION_FACTORS: Readonly<Record<string, number>> =
  {
    "047e61b4-b4a8-4042-a290-f2189b5a70ca": 1.6, // 204s (n=217)
    "1207215c-f61d-4fe1-bbaa-a3db7d4e7d53": 1.34, // 52nd Street (n=224)
    "da8ad733-8e6b-4781-8b3f-0fe4ee492c3f": 1.19, // 54th Street (n=224)
    "63af8c07-1aed-44bd-b03b-9b20abdff56c": 1.6, // Avalanche (n=221)
    "ec73bb77-4be5-4126-8986-348929c1e7e9": 1.6, // Big Jetty (n=222)
    "01330afc-00d3-461b-88f3-b173774766f4": 1.32, // Blacks Beach (n=220)
    "486dc095-4b21-4edb-838c-97f68b40d1df": 1.6, // C Street / Ventura Point (n=200)
    "80efa1c0-37a2-4879-819b-647ae3c3d749": 1.5, // Cardiff Reef (n=219)
    "c0977bcd-5475-4745-b4b8-0ca1e16a7faf": 1.58, // Carlsbad State Beach (n=218)
    "a0332432-4877-48c5-855d-b30fd097ba38": 1.6, // Church (n=218)
    "12e0096c-9826-443f-9131-53aaa646f789": 1.24, // Corona del Mar (n=223)
    "2c1d7948-72c1-4787-93e8-f33ac9567db0": 1.6, // Cottons (n=218)
    "cc7c0837-257c-42c3-9d98-634911e73a6a": 1.6, // Crystal Pier (n=220)
    "902a215b-2a3d-40af-9391-16b0afed7dee": 1.21, // D Street (n=219)
    "5e72b79d-a12d-4cd3-8da4-b7b92069efbf": 1.3, // Del Mar (n=219)
    "7fc84dd8-abcc-4d7c-9ade-3d1500c1c24c": 1.18, // Del Mar Rivermouth (n=219)
    "21eae8b9-387c-438c-b144-55796bab5caa": 1.6, // Emma Wood (n=199)
    "e5fee219-672c-4113-a0bb-a86a5d97700f": 1.5, // Forster St. Oceanside (n=217)
    "7dca6429-25ee-4161-a2c2-800555ed8a6a": 1.1, // George's (n=219)
    "66ef3c08-a8a2-4cf1-9361-273489bac45b": 1.6, // Goldenwest (n=223)
    "f29ddb0a-6d46-4589-a4a4-da406ddd3d5c": 1.08, // Grandview Beach (n=219)
    "d60dd5c8-d147-4042-a531-c2ec55c620af": 1.32, // HB Cliffs (n=223)
    "30e68b00-c27d-4d22-ba57-2d92156964c6": 1.08, // Horseshoe (n=220)
    "071db1df-b5ee-4af6-a022-ea8a09667cbe": 1.6, // Huntington Beach Pier (n=223)
    "72726bcb-bed0-4b76-8336-f90d7fb57159": 1.6, // Huntington Beach Pier Northside (n=223)
    "025cfc18-8357-49d6-994e-e0abf0a16f6d": 1.6, // Huntington Beach Pier Southside (n=223)
    "b57b32b9-0057-46f6-9fa9-cd35d5bd5319": 1.6, // Huntington St. (n=223)
    "502bd50f-21c8-4cdc-ae96-1d53fcbc34de": 1.6, // Huntington State Beach (n=223)
    "193a3f9a-66d0-4362-bf55-d25bb831dae4": 1.6, // Lower Trestles (n=218)
    "9b292a48-7a88-4d79-926f-16601515d7a0": 1.24, // Marine Street Beach (n=220)
    "b5bcd27f-3399-4a0a-b5d5-da8147e43b9a": 1.46, // Middles (n=217)
    "c02b4ede-69d9-440e-b8de-22ea4bde10ef": 1.5, // Mission Beach (n=221)
    "cdcf733b-a704-45ef-affc-d8152ffde1e4": 1.6, // Mission Beach (Central) (n=221)
    "9a64d63a-0c0c-40b7-bc97-d3d931204bba": 1.3, // Mondos Beach (n=199)
    "deea2ae1-849d-47a1-9c27-b7bd505dbc07": 1.13, // Moonlight State Beach (n=219)
    "d920e1b9-9e23-4ba8-9f8e-776571435f6f": 1.46, // New Break (Nubes) (n=170)
    "53cc78d5-a759-4153-8a2e-b13cf1bb6b4e": 1.23, // Newport 56th St (n=224)
    "bbe7f4eb-9807-4e65-8e69-e2cee28d6b24": 1.6, // Newport Lower Jetties (n=224)
    "11662c67-a1bb-43a0-b0f7-0e4071b1c3f2": 1.2, // Newport Point (n=224)
    "e64001e6-e2bd-4596-8f24-d8064e7f5186": 1.6, // Newport Upper Jetties (n=224)
    "15c7337e-5258-4339-9dc3-c435c666926b": 1.6, // Ocean Beach (n=221)
    "65d177de-e75a-4ad8-aa0d-48a67c0851b0": 1.6, // Ocean Beach Pier (n=221)
    "d9524c9d-8315-4686-9d35-24ceb6db2a82": 1.6, // Ocean Beach SF – Sloat (n=214)
    "a30b9870-aace-48ef-a3e6-e275ad9c28c1": 1.6, // Oceanside Harbor (n=217)
    "cceecad1-7668-4ad8-88ff-ade893c605cd": 1.6, // Oceanside Pier (n=217)
    "a956de46-b204-448e-a541-db427be7e85f": 1.6, // Old Man's (SanO) (n=218)
    "c3b42f85-e650-445f-89b1-1debe661652e": 1.5, // Osprey Point (n=170)
    "65809772-20bc-4009-b9b2-89c8ef3c4127": 1.28, // Pacific Beach (n=221)
    "13ef0aa1-c857-4d82-a40d-a83612110943": 1.6, // PB Point (n=220)
    "b9c4a949-4562-47db-ae7d-b2131e20d7a7": 1.34, // Poche Beach (n=217)
    "badd7986-4609-421a-ab3d-81fcd8409a5b": 1.34, // Ponto (n=219)
    "bec2d595-ed20-4c2b-93c7-4b880406332f": 1.6, // Rincon (n=200)
    "a0e764f1-d0bb-4341-b397-7b21823cb93b": 1.6, // River Jetties (n=223)
    "73bb4a48-3d53-42ba-bbd0-d89a7cf95711": 1.41, // Salt Creek (n=217)
    "e99552bf-45bd-46a8-a716-4cdfff2061f2": 1.36, // San Clemente Pier, Northside (n=218)
    "02dfc45e-f7f8-4fdc-8008-6ce14e2839f5": 1.11, // San Clemente State Beach (n=217)
    "8a47b323-0874-45d9-aa17-ced468f70f2d": 1.6, // San Onofre State Beach (n=218)
    "5a34b2ac-01b9-4b83-8c05-c47b1b55d923": 1.55, // Seaside Reef (n=219)
    "80e4aada-7d4a-4df1-b11b-841a97603979": 1.35, // Strands (n=217)
    "b939f928-2653-494a-831d-6394cb548190": 1.4, // Sunset Cliffs – Garbage (n=170)
    "34af0af5-b61c-4b86-9d9d-bf328f538a12": 1.5, // Sunset Cliffs – Luscombs (n=170)
    "d305ba0d-47cd-4494-b790-f924dac7bf1f": 1.33, // Sunset Cliffs North (Garbage) (n=170)
    "b24c6fa9-9f82-4a1e-afcd-0d1fb0ce69d0": 1.6, // Swami's (n=219)
    "dfeecc16-6395-4600-89e6-baf8456e3d69": 1.33, // T-Street (n=218)
    "b1b49703-2376-407d-b1fb-9df06130ac1d": 1.14, // Tamarack (n=217)
    "762fcfa2-8fd8-40ea-8955-b9cc6945a422": 1.6, // The Rock, Oceanside (n=217)
    "c2c7cc01-4920-4fd9-941c-68df6b46ced0": 1.6, // The Wedge (n=223)
    "4bdbff9e-2c1f-4918-84a6-aed42fb6e42c": 1.57, // Torrey Pines State Beach (n=220)
    "17628f35-9ed1-4257-aad6-070c4bd73bb8": 1.6, // Tourmaline Beach (n=221)
    "91df193c-f2c8-4e6c-984e-b859bd741061": 1.6, // Tourmaline Surf Park (n=221)
    "2f3e2136-b094-49d7-b90f-948160cbb854": 1.25, // Trails (n=218)
    "f924aa96-395f-41e0-b966-502b37def7ac": 1.6, // Upper Trestles (n=217)
    "6f42d47d-215b-47cb-ac14-b83bf8c2a797": 1.12, // Windansea (n=220)
  };
