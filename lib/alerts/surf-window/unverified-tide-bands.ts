import { createSpotProfile } from '@/lib/domains/spot-profile/spot-profile';
import type { Beach } from '@/types/database';

// Read-only production trace (2026-10-14): these 66 integer-scale 2–4 ft bands date to catalog creation
// on 2025-08-26, 2025-09-15, or 2025-10-07, with no tracked per-beach write producing them.
// Brooks Street and Upper Trestles have conflicting tracked migrations; tide-shift claims are unverified.
export const UNVERIFIED_TIDE_BAND_BEACH_IDS: ReadonlySet<string> = new Set([
  '047e61b4-b4a8-4042-a290-f2189b5a70ca', // 204s
  '0f0dcd5a-be9d-4c0d-a7ba-d6f932f9b769', // agate-street
  '63af8c07-1aed-44bd-b03b-9b20abdff56c', // avalanche
  '1f8660f2-891d-4f79-8f16-cad8ebd59c79', // brooks-street
  'c0977bcd-5475-4745-b4b8-0ca1e16a7faf', // carlsbad-state-beach
  'a0332432-4877-48c5-855d-b30fd097ba38', // church
  '0e557ec4-355a-4176-8352-6ea50e379c13', // crystal-cove
  'a57ae4c8-7a27-4d3f-91d5-6229350fb888', // doheny
  'a4575b12-2bc3-44d4-ba53-4415707f3851', // doheny-state-beach
  '902a215b-2a3d-40af-9391-16b0afed7dee', // d-street
  '52879e4f-fc7f-4c02-a5e3-ea40b992ea80', // el-porto-manhattan
  'e5fee219-672c-4113-a0bb-a86a5d97700f', // forster-st-oceanside
  '7dca6429-25ee-4161-a2c2-800555ed8a6a', // georges
  '66ef3c08-a8a2-4cf1-9361-273489bac45b', // goldenwest
  'f29ddb0a-6d46-4589-a4a4-da406ddd3d5c', // grandview
  'd60dd5c8-d147-4042-a531-c2ec55c620af', // hb-cliffs
  '84d3468b-c1ec-46ad-8621-d8507e5f167a', // hotel-del-coronado
  'b57b32b9-0057-46f6-9fa9-cd35d5bd5319', // huntington-st
  '502bd50f-21c8-4cdc-ae96-1d53fcbc34de', // huntington-state-beach
  '9e94759c-d531-4e5c-9bc2-d022acea9dcd', // imperial-beach
  '9841bdd0-e70f-4c10-bc54-135575006298', // malibu-first-point-surfrider
  '9b292a48-7a88-4d79-926f-16601515d7a0', // marine-street-beach
  'b5bcd27f-3399-4a0a-b5d5-da8147e43b9a', // middles
  'deea2ae1-849d-47a1-9c27-b7bd505dbc07', // moonlight-state-beach
  'd920e1b9-9e23-4ba8-9f8e-776571435f6f', // new-break-nubes
  '53cc78d5-a759-4153-8a2e-b13cf1bb6b4e', // newport-56th-st
  'bbe7f4eb-9807-4e65-8e69-e2cee28d6b24', // newport-lower-jetties
  '11662c67-a1bb-43a0-b0f7-0e4071b1c3f2', // newport-point
  'e64001e6-e2bd-4596-8f24-d8064e7f5186', // newport-upper-jetties
  'a956de46-b204-448e-a541-db427be7e85f', // old-mans-sano
  'c3b42f85-e650-445f-89b1-1debe661652e', // osprey-point
  '13ef0aa1-c857-4d82-a40d-a83612110943', // pb-point
  'b9c4a949-4562-47db-ae7d-b2131e20d7a7', // poche-beach
  'a0e764f1-d0bb-4341-b397-7b21823cb93b', // river-jetties
  '1a854513-1c65-458e-abb6-384ba4090b0b', // riviera
  '73bb4a48-3d53-42ba-bbd0-d89a7cf95711', // salt-creek
  '09affcd2-1eca-4f7d-852e-413972ea4154', // san-elijo-state-beach
  '8a47b323-0874-45d9-aa17-ced468f70f2d', // san-onofre-state-beach
  '94f1010b-c71f-4025-bda1-c26ed9467c85', // silver-strand-state-beach
  '65d3a4de-1f4b-4a1d-8ce0-b5b67288ee08', // solana-beach
  '80e4aada-7d4a-4df1-b11b-841a97603979', // strands
  'b1b49703-2376-407d-b1fb-9df06130ac1d', // tamarack
  '1fe4bf73-c425-48a5-899d-a7e8ee2d67e3', // terramar-point
  '2a2195ef-27d1-4b35-a006-b7177b34dad2', // thalia-street
  'c2c7cc01-4920-4fd9-941c-68df6b46ced0', // the-wedge
  '929caa5e-c79f-4b60-8fe0-bec75c2df2d6', // tijuana-sloughs
  '4bdbff9e-2c1f-4918-84a6-aed42fb6e42c', // torrey-pines-state-beach
  '2f3e2136-b094-49d7-b90f-948160cbb854', // trails
  'f924aa96-395f-41e0-b966-502b37def7ac', // upper-trestles
  '1ac4f5f1-94a1-4347-b4ca-6c9d62aee5d3', // hapuna-beach-kohala
  '231d8635-6ae1-40e5-9112-88c26b0918ac', // poipu-beach-kauai
  '880748ee-5423-4b2e-a5c3-b2faab5c4a7a', // waikiki-aquarium
  '846ccff8-0e26-41f3-8496-5c5221109c6c', // waikiki-beach
  '22d65140-1c40-4bbe-8790-5068fa6e5f22', // waikoloa-village-lagoon
  'ffc0dcae-83d7-4b90-ade3-03c14e789088', // agate-beach
  '3c8f272b-473a-4303-83b7-3081579a042b', // bandon
  'c62b7ad4-8deb-4275-889d-b0eb8ec7c5f0', // brookings-harris-beach
  'b2286d82-0f40-45db-b4d1-3774950f6632', // cannon-beach-ecolaindian
  '387c8c1c-d6e3-494e-96d9-e5b025aa995b', // humbug-mountain-port-orford
  'cf59e55d-f146-4a72-8daf-5781a0693d13', // pacific-city-cape-kiwanda
  '2c2dea98-280b-488c-9d46-ffed8226447b', // short-sands-oswald-west
  '058c415c-39da-41bb-aee9-c4942d79e95d', // la-push-first-beach
  '839bab65-0ae4-443e-94a5-0d5bb4b4a5a8', // long-beach-boardwalk
  '04ab6e6a-477f-49ab-b435-6b201134bcbf', // ocean-shores
  '60b6bb17-dc08-4f18-8241-33729bcbc742', // ocean-shores-north-beaches
  '260868de-b952-470b-a764-b95b3e7f6655', // westport-beach
]);

export function isTideReasonEligibleBeach(beach: Beach): boolean {
  return createSpotProfile(beach).tidePreferences.explicitRange === true
    && !UNVERIFIED_TIDE_BAND_BEACH_IDS.has(beach.id);
}
