/**
 * Face-height caps (ft) for researched California sand beaches.
 *
 * Sources: workspace-notes/Reports/2026-11-23-ca-sand-beach-size-research.csv and
 * 2026-11-24-ca-sand-beach-closeout-research.csv (quotes and links for each row).
 * Default cap is 8 ft; a beach with a sourced size uses that number. No cap is below 6 ft: the
 * lower numbers came from one informal report each, and a wrong low cap would hide normal days.
 * Above the cap the scoring engine adds a `closeout_size` effect (see `sandBeachSizeCapFt`).
 * Reefs, points and every beach outside this list have no cap.
 *
 * Exempt (they hold size, so not in the map):
 * - Agate Street (published guide: holds large, no maximum given)
 * - Corona del Mar (published guide: holds large, no maximum given)
 * - The Wedge (published guide: holds large, no maximum given)
 * - Seal Beach Pier (published guide: holds large, no maximum given)
 * - Blacks Beach (sourced holds, no maximum given)
 * - Morro Rock / Sandspit (inside bend) (sourced holds, no maximum given)
 * - Ocean Beach (sourced holds, no maximum given)
 * - Ocean Beach Pier (sourced holds, no maximum given)
 * - Ocean Beach SF – Middle (sourced holds, no maximum given)
 * - Ocean Beach SF – North (sourced holds, no maximum given)
 * - Ocean Beach SF – Sloat (sourced holds, no maximum given)
 */
export const SAND_BEACH_SIZE_CAPS_FT: Readonly<Record<string, number>> = {
  'b1d6dd7c-cfd7-47ba-83ad-6fe09e67cfe4': 12, // Asilomar State Beach
  '52879e4f-fc7f-4c02-a5e3-ea40b992ea80': 12, // El Porto (Manhattan)
  '885ad595-67cb-4408-b4cc-9ecf2ce3a848': 18, // Moss Landing
  'a7a94616-4d60-5965-b1be-568890d162e8': 12, // North Salmon Creek Beach
  '49739de1-95fb-4e26-b890-56fafd8d2622': 12, // Rockaway Beach (Pacifica)
  '6c4b160d-8aba-4078-aca7-9bde1bf81738': 8, // Bay Street
  '92e18cf0-97c3-4c68-9cdf-800eb9ac4313': 8, // Bodega Bay / Doran Beach
  '1f8660f2-891d-4f79-8f16-cad8ebd59c79': 10, // Brooks Street
  'd7ed5c84-df3b-4837-85b8-d73c5a7bff3e': 8, // Carmel Beach
  'a0332432-4877-48c5-855d-b30fd097ba38': 10, // Church
  '326941d7-6c39-4e82-b045-941b156f7897': 8, // Hermosa Beach Pier
  'b5bcd27f-3399-4a0a-b5d5-da8147e43b9a': 10, // Middles
  '124c7751-a232-4c92-be53-3a750a315256': 8, // Oceano / Grover Beach
  'f2cc331f-6569-40d9-a98b-9f50fb3da67f': 8, // Pacifica / Linda Mar
  'badd7986-4609-421a-ab3d-81fcd8409a5b': 8, // Ponto
  '73bb4a48-3d53-42ba-bbd0-d89a7cf95711': 8, // Salt Creek
  '5a5dc7b8-4d30-44af-9715-3dbb4dbc9859': 8, // Stinson Beach
  '73cfa55c-0708-533b-b8c8-9af6db7bc7b2': 8, // Surfers Beach / Princeton Jetty (El Granada)
  '929caa5e-c79f-4b60-8fe0-bec75c2df2d6': 8, // Tijuana Sloughs
  '4bdbff9e-2c1f-4918-84a6-aed42fb6e42c': 8, // Torrey Pines State Beach
  '2f3e2136-b094-49d7-b90f-948160cbb854': 10, // Trails
  '3f1eeb72-41c1-4f58-9621-fd13df129c1a': 8, // Will Rogers State Beach
  '836f218a-9471-46c9-b201-24da1dfe0f3a': 10, // Zuma Beach
  'dd21a212-1f15-5b34-8749-8d54c44f3b25': 6, // Bolsa Chica State Beach
  '0a76eb21-c49a-562a-ad1a-19240b44b543': 6, // Dillon Beach
  '047e61b4-b4a8-4042-a290-f2189b5a70ca': 6, // 204s (published guide)
  '1207215c-f61d-4fe1-bbaa-a3db7d4e7d53': 6, // 52nd Street (estimate from beach structure, low confidence)
  'da8ad733-8e6b-4781-8b3f-0fe4ee492c3f': 7, // 54th Street (estimate from beach structure, low confidence)
  '6932c9a6-bc1f-46b7-9493-51c587bf7eb0': 15, // 72nd Place (published guide)
  '63af8c07-1aed-44bd-b03b-9b20abdff56c': 8, // Avalanche (published guide)
  '0e7a0a9f-3a0b-44a2-b81c-43a6f7b2a203': 6, // Avila Beach (local reports) (one informal source gave 2 ft; held at the 6 ft floor)
  'ec73bb77-4be5-4126-8986-348929c1e7e9': 8, // Big Jetty (published guide)
  '66d06e54-10bd-458c-a57b-1966a957b825': 8, // Blackies
  'dca521c3-ab32-46c6-8045-8aa7477f59a8': 8, // Capitola Beach (published guide)
  'c0977bcd-5475-4745-b4b8-0ca1e16a7faf': 7, // Carlsbad State Beach (published guide)
  '1bd1a1f5-5c8a-4607-8d7b-0b8f0d2c9b02': 6, // Cayucos Pier (south side) (published guide)
  '2c8a869b-6a53-40db-ba23-a6316d6f4965': 8, // Clam Beach
  '1182a4ff-0a3c-49f2-9d67-58ba9351b2ac': 6.2, // College Cove (published guide)
  'b29821f9-c91a-486f-981b-7085c6d86b68': 7, // Coronado North Jetty (estimate from beach structure, low confidence)
  '90df1267-5d2e-51b6-ba06-21e89405166c': 10, // Cowell Beach (published guide)
  '0e557ec4-355a-4176-8352-6ea50e379c13': 6, // Crystal Cove (published guide)
  'cc7c0837-257c-42c3-9d98-634911e73a6a': 6, // Crystal Pier (published guide)
  '902a215b-2a3d-40af-9391-16b0afed7dee': 6, // D Street (published guide)
  '5e72b79d-a12d-4cd3-8da4-b7b92069efbf': 6, // Del Mar (published guide)
  '7fc84dd8-abcc-4d7c-9ade-3d1500c1c24c': 6, // Del Mar Rivermouth (published guide)
  'a3d480de-3743-4dd7-8092-fb52772a0fb2': 6, // Del Monte Beach (local reports) (one informal source gave 4 ft; held at the 6 ft floor)
  'f7fbc2c4-7c4e-4c2c-8f8a-5e3bd1ee8e08': 7, // Devereux / Sands (Coal Oil Point) (published guide)
  '1376c3e3-d7b2-408d-b1d4-e6e004cbe063': 8, // Dockweiler State Beach (published guide)
  'a57ae4c8-7a27-4d3f-91d5-6229350fb888': 6, // Doheny Beach (published guide)
  'a4575b12-2bc3-44d4-ba53-4415707f3851': 6, // Doheny State Beach (published guide)
  'e5fee219-672c-4113-a0bb-a86a5d97700f': 6, // Forster St. Oceanside (published guide)
  'f0d0c0d9-6c1a-4d2b-9f4e-9f7bb7b8c205': 15, // Garrapata State Beach (southern coves) (estimate from beach structure, low confidence)
  '7dca6429-25ee-4161-a2c2-800555ed8a6a': 6, // George's (published guide)
  '66ef3c08-a8a2-4cf1-9361-273489bac45b': 9, // Goldenwest (published guide)
  'f29ddb0a-6d46-4589-a4a4-da406ddd3d5c': 8, // Grandview Beach (published guide)
  'd60dd5c8-d147-4042-a531-c2ec55c620af': 7, // HB Cliffs (published guide)
  '110a87b2-cb2c-4bb7-8e83-b895fb2f4940': 7, // Hermosa Beach South (published guide)
  '37ffa92a-d811-4791-afbb-b90a86dcdf49': 6.5, // Hermosa Pier (published guide)
  '84d3468b-c1ec-46ad-8621-d8507e5f167a': 7, // Hotel Del Coronado (estimate from beach structure, low confidence)
  '071db1df-b5ee-4af6-a022-ea8a09667cbe': 7, // Huntington Beach Pier (published guide)
  '72726bcb-bed0-4b76-8336-f90d7fb57159': 8, // Huntington Beach Pier Northside (published guide)
  '025cfc18-8357-49d6-994e-e0abf0a16f6d': 9, // Huntington Beach Pier Southside (published guide)
  'b57b32b9-0057-46f6-9fa9-cd35d5bd5319': 8, // Huntington St. (estimate from beach structure, low confidence)
  '502bd50f-21c8-4cdc-ae96-1d53fcbc34de': 6, // Huntington State Beach (estimate from beach structure, low confidence) (one informal source gave 4.5 ft; held at the 6 ft floor)
  '9e94759c-d531-4e5c-9bc2-d022acea9dcd': 7, // Imperial Beach (estimate from beach structure, low confidence)
  'd9f93c82-7f4b-440a-865a-55cdbb821f74': 8, // Imperial Beach Pier (estimate from beach structure, low confidence)
  '1ec3682e-d993-4c60-a650-f630e1ea3b06': 6.5, // Jalama Beach (published guide)
  '50b0ec6c-9254-5450-9b23-90cb85997cb1': 8, // Knob Hill (Redondo Beach) (local reports)
  'd291411d-d331-4bf1-ad1a-302da3c69de0': 10, // La Jolla Shores (published guide)
  'a13f108b-ad2a-43fa-8ea7-40577ebce66c': 8, // Leo Carrillo State Beach (published guide)
  '7a093b7e-2230-4bf1-abeb-9b31faa794d5': 8, // Manhattan Beach Pier (published guide)
  'c0f23f4b-fcc4-4849-88f4-cb6da7206d80': 6, // Marina State Beach (estimate from beach structure, low confidence)
  '9b292a48-7a88-4d79-926f-16601515d7a0': 8, // Marine Street Beach (published guide)
  'c02b4ede-69d9-440e-b8de-22ea4bde10ef': 7, // Mission Beach (owner local knowledge 2026-11-24: closes out at 7.4 ft; published guide says it holds to about 8)
  'cdcf733b-a704-45ef-affc-d8152ffde1e4': 7, // Mission Beach (Central) (owner local knowledge 2026-11-24: closes out at 7.4 ft; published guide says it holds to about 8)
  'ca0f960e-e859-4b33-8e88-6b2980e48e6a': 6, // Monastery Beach / San Jose Creek Beach (estimate from beach structure, low confidence) (one informal source gave 4 ft; held at the 6 ft floor)
  'deea2ae1-849d-47a1-9c27-b7bd505dbc07': 8, // Moonlight State Beach (published guide)
  'c0024ced-d774-4e5f-b580-1bc8cb8da136': 8, // Moonstone Beach / Little River
  'f73cea3d-d7c7-57cf-b2d1-9a4370f75123': 10, // Muir Beach (estimate from beach structure, low confidence)
  'd920e1b9-9e23-4ba8-9f8e-776571435f6f': 12, // New Break (Nubes) (published guide)
  '53cc78d5-a759-4153-8a2e-b13cf1bb6b4e': 7, // Newport 56th St (published guide)
  'bbe7f4eb-9807-4e65-8e69-e2cee28d6b24': 6, // Newport Lower Jetties (published guide)
  'e64001e6-e2bd-4596-8f24-d8064e7f5186': 8, // Newport Upper Jetties (published guide)
  'a30b9870-aace-48ef-a3e6-e275ad9c28c1': 8, // Oceanside Harbor (published guide)
  'cceecad1-7668-4ad8-88ff-ade893c605cd': 8, // Oceanside Pier (published guide)
  '65809772-20bc-4009-b9b2-89c8ef3c4127': 6, // Pacific Beach (published guide)
  'ee2aad76-966d-4aa3-86a2-499fde59b271': 8, // Pismo Pier (local reports)
  'b9c4a949-4562-47db-ae7d-b2131e20d7a7': 6, // Poche Beach (published guide)
  'c778cc0a-2094-4649-84cd-4c38ce864f23': 8, // Point Arena / Manchester Beach (published guide)
  'a0e764f1-d0bb-4341-b397-7b21823cb93b': 7, // River Jetties (published guide)
  '1a854513-1c65-458e-abb6-384ba4090b0b': 6, // Riviera (published guide)
  'cb488223-4397-415c-a4f4-cdf3845dc241': 15, // Samoa Dunes Surf Area (published guide)
  'e99552bf-45bd-46a8-a716-4cdfff2061f2': 6, // San Clemente Pier, Northside (published guide)
  '02dfc45e-f7f8-4fdc-8008-6ce14e2839f5': 6, // San Clemente State Beach (estimate from beach structure, low confidence)
  '09affcd2-1eca-4f7d-852e-413972ea4154': 6, // San Elijo State Beach (published guide) (one informal source gave 5 ft; held at the 6 ft floor)
  '41637008-fad6-53f2-92ac-3377df9aec36': 6, // Santa Cruz Main Beach (estimate from beach structure, low confidence)
  '29fefd13-7472-4ce8-9c3c-be3dabcbb233': 6.5, // Santa Monica Beach (published guide)
  'c9ea72a3-d7bf-5f3d-b77e-1aa6cce81dee': 6, // Sapphire Street (Redondo Beach) (published guide) (one informal source gave 5 ft; held at the 6 ft floor)
  '090f4927-d319-53fb-990c-9c6bca55289b': 8, // Sharp Park Beach (local reports)
  '5e8d07ff-786c-4b7e-ab19-53d2b3774e23': 6, // Shipwrecks (estimate from beach structure, low confidence)
  '94f1010b-c71f-4025-bda1-c26ed9467c85': 7, // Silver Strand State Beach (estimate from beach structure, low confidence)
  '65d3a4de-1f4b-4a1d-8ce0-b5b67288ee08': 6, // Solana Beach (published guide)
  'b1adcf43-2b85-4247-b840-6b1230e886b4': 18, // Spanish Bay / South Moss Beach (published guide)
  '80e4aada-7d4a-4df1-b11b-841a97603979': 6, // Strands (published guide)
  'dfeecc16-6395-4600-89e6-baf8456e3d69': 8, // T-Street (published guide)
  'b1b49703-2376-407d-b1fb-9df06130ac1d': 7, // Tamarack (published guide)
  '2a2195ef-27d1-4b35-a006-b7177b34dad2': 8, // Thalia Street
  'a3e9d10c-92e9-4302-b808-a3de0c2eca22': 6, // Torrance Beach (RAT Beach) (local reports)
  '17628f35-9ed1-4257-aad6-070c4bd73bb8': 8, // Tourmaline Beach (published guide)
  '91df193c-f2c8-4e6c-984e-b859bd741061': 8, // Tourmaline Surf Park (published guide)
  '402ec6ad-4e80-47d2-882f-5053eb9aa433': 6, // Trinidad State Beach (published guide)
  '11467f21-5a69-430d-9eb9-05a46cd39990': 8, // Venice Beach (published guide)
  '4b0cf129-c706-4e24-8210-2219defc5ea7': 10, // Scripps (published guide)
};

/** Face-height cap in feet for a beach id, or null when the beach has no cap. */
export function sandBeachSizeCapFt(beachId: string | null | undefined): number | null {
  if (!beachId) return null;
  return Object.prototype.hasOwnProperty.call(SAND_BEACH_SIZE_CAPS_FT, beachId)
    ? SAND_BEACH_SIZE_CAPS_FT[beachId]
    : null;
}
