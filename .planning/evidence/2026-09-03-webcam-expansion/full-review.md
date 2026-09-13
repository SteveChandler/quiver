# Full camera inventory review — 2026-09-03

All 98 discovered destination listings have a disposition. These are not 98 distinct physical cameras. Initial HTTP success is not live-playback verification. Existing-camera and no-catalog outcomes do not imply playback was tested.

| Outcome | Listings |
|---|---:|
| Location mismatch or unproven coverage | 20 |
| No matching catalog beach | 28 |
| Existing camera retained | 17 |
| Duplicate or alternate listing | 18 |
| Add verified camera | 7 |
| Playback unverified | 4 |
| Offline | 4 |

## Seven prepared additions

| Beach | State | Verified provider link |
|---|---|---|
| Waikiki Beach | HI | [Camera](https://www.hilton.com/en/hotels/hnlwahf-hilton-waikiki-beach-resort-and-spa/resort/webcam/) |
| Kalapaki Beach | HI | [Camera](https://www.ozolio.com/explore/IDWX000000A6) |
| Poipu Beach (Kauai) | HI | [Camera](https://brenneckes.com/beach-webcam/) |
| Corolla | NC | [Camera](https://www.corollalightresort.com/surf-cam/) |
| 7th Street Beach | NJ | [Camera](https://7thstreetsurfshop.com/wave-cam/7th-street) |
| Flagler Beach | FL | [Camera](https://flaglersurf.com/webcam/) |
| Jacksonville Beach Pier | FL | [Camera](https://www.youtube.com/watch?v=c400PBf6adI) |

All seven selected sources showed actual moving imagery in browser review. Provider links only; no permission to embed their players is claimed. Poipu temporarily showed video corruption, then recovered. Other sources may fail later and should be rechecked at rollout.

## Every listing

| # | Listing | Outcome | Reason |
|---:|---|---|---|
| 1 | [Kohanaiki Web Camera](https://www.youtube.com/@kohanaikihawaii3092/streams) | Location mismatch or unproven coverage | Kohanaiki channel confirmed but camera views resort lawn and partly obscured coastline. Cannot establish Pine Trees public surf area field of view at catalog coordinates; do not infer from resort name. |
| 2 | [KONAWEB (Hulihee Palace)](https://www.konaweb.com/cam/index.html) | No matching catalog beach | KONAWEB says camera is at Fish Hopper restaurant, Alii Drive Kailua-Kona. No exact Hulihee/Kailua Bay catalog beach; not Pine Trees. |
| 3 | [Mauna Kea Beach Hotel (Hapuna)](https://marriott.ozolio.com/mauna-kea-beach-hotel/) | Location mismatch or unproven coverage | Official camera page explicitly identifies Kaunaoa Bay; directory Hapuna label wrong. No Kaunaoa catalog beach. |
| 4 | [The Surfers View (Turtle Bay)](https://thesurfersview.com/live-cams/hawaii/turtle-bay-beach-cam-west-and-surf-report/) | No matching catalog beach | Turtle Bay West named by provider; no Turtle Bay catalog beach. Not Kualoa or Kahana. |
| 5 | [Explore Annenberg LLC (Waimea Bay/Pinballs)](https://explore.org/livecams/hawaii/hawaii-waimea-bay-cam/) | Existing camera retained | Waimea Bay already has camera_url; retain existing. Provider indexed status Off Season; not verified currently live. |
| 6 | [LIVE Banzai Pipeline Surf Cam: North Shore, Oahu - Hawaii / explore.org](https://www.youtube.com/@ExploreBigSurfandBeaches) | Existing camera retained | Pipeline already has camera_url. This and index6 represent Explore Pipeline/Ehukai; no replacement authorized by additive import. |
| 7 | [Explore Annenberg LLC (Ehukai/Gums)](https://explore.org/livecams/hawaii/hawaii-pipeline-cam/) | Duplicate or alternate listing | Same Explore Pipeline/Ehukai camera as index5; preserve existing Pipeline camera. |
| 8 | [Webcamtaxi (Ala Moana Courts)](https://www.webcamtaxi.com/en/usa/hawaii/honolulu-island-of-oahu.html/) | No matching catalog beach | Ala Moana Courts is not an existing catalog beach; do not relabel as Ala Moana Bowls. Prior HTTP403 did not verify playback. |
| 9 | [CamGuide (Reef Runway (Hickam Harbor))](https://camguide.net/usa/hawaii/honolulu/beach/) | Location mismatch or unproven coverage | Directory Hickam Harbor label contradicts destination Waikiki/Mamala Bay title. Exact view unverified. |
| 10 | [Ward Village (Ala Moana Bowls)](https://www.wardvillage.com/surf-cam/) | Existing camera retained | Ala Moana Bowls already has camera_url; provider exact field of view remains unverified; preserve existing. |
| 11 | [Hilton Hotel Waikiki (Waikiki)](https://www.hiltonwaikikibeach.com/surf-cam/) | Add verified camera | Official Hilton page redirects to current hilton.com City & Beach Webcam; playing view includes Waikiki surf zone and beach. Broad Waikiki Beach mapping supported. |
| 12 | [Sheraton Waikiki (Waikiki)](https://marriott.ozolio.com/sheraton-waikiki/) | Playback unverified | Provider location Waikiki confirmed but player never produced image in two separated Chrome screenshots. Prefer verified Hilton index10 for one-source-per-beach. |
| 13 | [Waikiki Aquarium (Waikiki)](https://www.youtube.com/@WaikikiAquariumHonolulu/streams) | Existing camera retained | Official Aquarium URL already assigned to Waikiki (Aquarium), preserve. |
| 14 | [South Shore Surf Cam](https://www.youtube.com/@WaikikiAquariumHonolulu/streams) | Duplicate or alternate listing | Same stream WIUg8wzhq1g as official Aquarium camera already on catalog row. Publics exact break field unconfirmed; do not duplicate to Publics. |
| 15 | [The Royal Sonesta Resort (Kalapaki Beach)](https://www.ozolio.com/explore/IDWX000000A6) | Add verified camera | Official Sonesta resort page explicitly describes camera view of pool, beach and Kalapaki Bay; browser image matches. Ozolio prose incorrectly says Poipu and must not be reused. |
| 16 | [Lawai Beach Resort - Live Cam](https://www.youtube.com/@OurLawaiBeachResort/streams) | No matching catalog beach | Lawai Beach and PKs absent from catalog. Official resort describes Lawai Beach; not Poipu Beach Park 2 miles away. |
| 17 | [Whalers Cove Resort (PKs)](https://www.whalerscoveresort.com/webcam) | No matching catalog beach | Whalers Cove oceanfront at2640 Puuholo Road is not catalog Poipu Beach Park; PKs/Lawai absent. |
| 18 | [Brenneckes.com (Brenneckes)](https://brenneckes.com/beach-webcam/) | Add verified camera | Official Brenneckes camera across from Poipu Beach Park shows swimming basin and surf, matching broad Poipu Beach catalog row. |
| 19 | [Maui Eldorado (Osterizers/Rainbows)](https://www.mauieldorado.com/webcams) | No matching catalog beach | Kaanapali/Eldorado/Osterizers not in catalog; not Lahaina Harbor. |
| 20 | [Whaler Condo (Ka'anapali Point)](https://www.youtube.com/@mauilivecam7143/streams) | No matching catalog beach | Kaanapali Point/Whaler not in catalog; not Lahaina Harbor. |
| 21 | [Maui Seashell – Hale Mahina Resort (S-Turns)](https://halemahinacondo.com/web-cam/) | No matching catalog beach | Hale Mahina condo coastline/S-Turns not in catalog; not Honolua Bay. |
| 22 | [Napili Sunset Resort (Little Makaha)](https://www.napilisunset.com/live-webcam/) | Location mismatch or unproven coverage | Provider is Napili Sunset at Napili Bay; directory Little Makaha association unsupported. Neither exact location exists in catalog. |
| 23 | [The Hale Pau Hana Surf Cam](https://www.youtube.com/@HalePauHanaBeachResortKihei/streams) | Location mismatch or unproven coverage | Hale Pau Hana camera is Kamaole II, not Kihei Cove. Neither in catalog. |
| 24 | [Grand Wailea Hotel (Kihei Cove)](https://www.grandwailea.com/grand-wailea-webcam) | Location mismatch or unproven coverage | Grand Wailea overlooks Wailea resort coast, not Kihei Cove; no Wailea catalog beach. Provider says live05:00–19:30 HST and evening replay. |
| 25 | [Rentals Maui (Kihei Cove)](https://www.rentalsmaui.com/maui-web-cam/) | Offline | Provider explicitly says webcam currently offline. Kihei Cove absent from catalog as well. |
| 26 | [Pacific Terrace Hotel (Crystal Pier and Pacific Beach)](https://www.pacificterrace.com/web-cam) | Existing camera retained | Pacific Beach and Crystal Pier already have cameras; do not overwrite either. |
| 27 | [🔴La Jolla Beach - San Diego, California - Live Cam](https://www.youtube.com/@EarthWatchLive1) | Existing camera retained | Exact catalog beach already has HDOnTap camera. |
| 28 | [HDONTAP (Del Mar Beach)](https://hdontap.com/index.php/video/stream/del_mar_beach) | Existing camera retained | Resolved HDOnTap URL already stored for Del Mar; also used by Del Mar Rivermouth and Torrey Pines. |
| 29 | [Moonlight Beach Rental (Sandbox)](https://www.skylinewebcams.com/en/webcam/united-states/california/encinitas/encinitas-california.html) | Playback unverified | Plausible Moonlight rental association, but runtime playback failed and exact view remains unverified. |
| 30 | [The Rooftop Bar / Oceanside, CA / San Diego Web Cam](https://www.youtube.com/@SanDiegoWebCam/streams) | Existing camera retained | Exact same YouTube cvP_F-c2Upw already stored. |
| 31 | [HDONTAP (Terra Mar)](https://hdontap.com/index.php/video/stream/carlsbad-beach-live-webcam) | Existing camera retained | Exact resolved Terramar HDOnTap URL already stored; also stored on Ponto. |
| 32 | [The Rooftop Bar (Fixed Wide West) / Oceanside, CA / San Diego Web Cam](https://www.youtube.com/@SanDiegoWebCam/streams) | Duplicate or alternate listing | Alternate Rooftop Bar fixed view of same pier covered by index29 existing camera; no broad Oceanside Beach catalog row. |
| 33 | [Waldorf Astoria Monarch Beach Resort (Dana Point)](https://www.waldorfastoriamonarchbeach.com/experience/private-beach-club) | Existing camera retained | Owner Monarch Bay Beach Club view corresponds to existing Monarch Bay HDOnTap camera on Salt Creek. Do not relabel as Doheny/Strands. |
| 34 | [Pacifica View](https://pacificaview.net/livecam/index.php/) | Duplicate or alternate listing | PacificaView aggregate repeats Sharp Park/Pacifica Pier videos indices34-37; no Sharp Park catalog row. |
| 35 | [Pacifica Pier and Beach, Pacifica CA 4k Live](https://www.youtube.com/@ChamberlinNature/streams) | No matching catalog beach | Sharp Park/Pacifica Pier absent from catalog. Linda Mar and Rockaway are different beaches and already camera-populated. |
| 36 | [Sharp Park Beach, Pacifica CA 4K Live](https://www.youtube.com/@ChamberlinNature/streams) | No matching catalog beach | Sharp Park absent from catalog; do not substitute Linda Mar/Rockaway. |
| 37 | [Chamberlin Nature (Sharp Park)](https://www.youtube.com/@ChamberlinNature/streams) | Duplicate or alternate listing | Channel-wide provider link repeats indices34/35; not a unique camera or catalog match. |
| 38 | [Pacifica Live Cameras (Sharp Park)](https://www.pacificaview.net/livecam/) | Duplicate or alternate listing | Same PacificaView aggregate as33 (www/path variation). |
| 39 | [Skyline Webcams (Sharp Park)](https://www.skylinewebcams.com/en/webcam/united-states/california/pacifica/pacifica-sharp-park-beach.html/) | No matching catalog beach | Explicit Sharp Park provider page; Sharp Park absent from catalog. |
| 40 | [Marin-County (Ocean Beach)](https://www.surfoutlook.com/surfcam/sanfrancisco/ocean-beach) | Playback unverified | Generic Ocean Beach SF page does not establish which of North/Middle/Sloat receives view; no verified live playback. |
| 41 | [Sigward (Stinson Beach)](https://www.sigward.com/) | Location mismatch or unproven coverage | Owner page explicitly labels camera MUIR BEACH, not Stinson Beach. No Muir Beach catalog row. |
| 42 | [Farallon Islands Live Webcam / California Academy of Sciences](https://www.youtube.com/@calacademy/streams) | Location mismatch or unproven coverage | Camera title is Farallon Islands wildlife view, not directory Double Point; neither exact camera location nor Double Point exists in catalog. |
| 43 | [The Marine Mammal Center Live Stream Point Reyes National Seashore](https://www.youtube.com/@themarinemammalcenterlives3249/streams) | No matching catalog beach | Point Reyes National Seashore wildlife stream; Drakes Estero/Point Reyes absent from catalog. Do not relabel as Bolinas/Stinson. |
| 44 | [Lawsons Landing (Shark Pit)](https://www.lawsonslanding.com/webcam.html) | Offline | Owner explicitly says camera down for maintenance; Shark Pit/Lawsons Landing absent from catalog. |
| 45 | [Pacific Coastal and Marine Science Center (Cowells Cove)](https://www.usgs.gov/media/webcams/santa-cruz-main-beach-video-camera-1-snapshot) | No matching catalog beach | USGS source is Santa Cruz Main Beach snapshot, not Cowells Cove; neither Main Beach nor Cowells exists in catalog. Not a verified video stream. |
| 46 | [Horseshoe Cove Webcam](https://www.youtube.com/@BodegaMarineLab/streams) | Location mismatch or unproven coverage | Horseshoe Cove at UC Davis Bodega Marine Reserve is a different cove from Doran Beach. |
| 47 | [Bodega Ocean Observing Node (Salmon Creek)](https://boon.ucdavis.edu/tools/coastal-conditions/) | Duplicate or alternate listing | Official BOON page embeds same Horseshoe Cove webcam as45, not directory Salmon Creek. No Horseshoe Cove/Salmon Creek catalog row. |
| 48 | [City of Seaside](https://www.youtube.com/@KOINLOCAL6) | Existing camera retained | Broad Seaside catalog row already has seasidelanai.com camera; City of Seaside label does not justify assigning to separate precise Seaside Cove (Oregon) row. |
| 49 | [Chinook Winds Casino Resort in Lincoln City, OR](https://www.youtube.com/@KOINLOCAL6/streams) | No matching catalog beach | Chinook Winds/Roads End absent from catalog; Nelscott Reef is a distinct reef south of resort and must not inherit camera. |
| 50 | [Forks Chamber of Commerce (La Push)](https://forkswa.com/plan-your-visit/webcams/) | Offline | Owner explicitly says First Beach and James Island cameras temporarily offline during relocation. |
| 51 | [ForksWA (The Cape)](https://pixelcaster.com/dnc-kalaloch/kalaloch.jpg) | Location mismatch or unproven coverage | Kalaloch Creek JPG is not directory The Cape; Kalaloch has no catalog row. Do not substitute La Push. |
| 52 | [Courtyard Virginia Beach Oceanfront](https://vbbound.com/webcams/courtyard-virginia-beach-boardwalk-webcam/) | No matching catalog beach | Provider specifies Courtyard at25th Street; no broad Virginia Beach or25thStreet catalog row. Existing pier/jetty rows are not equivalent. |
| 53 | [Watermans Surfside Grill](https://vbbound.com/webcams/watermans-surfside-grill-boardwalk-webcam/) | No matching catalog beach | Provider specifies Watermans at5thStreet; no5thStreet or broad Virginia Beach row. Do not substitute for1stStreet Jetty. |
| 54 | [Corolla Light Resort (Corolla Lighthouse)](https://www.corollalightresort.com/surf-cam/) | Add verified camera | Official resort beach page identifies Corolla oceanfront camera. |
| 55 | [Sea Ranch Resort (Avalon Pier)](https://www.searanchresort.com/webcam/) | Offline | Broad Kill Devil Hills row could accept resort beach but current player explicitly offline; do not map to Avalon Pier. |
| 56 | [Nest (Jenkinsons (Point Pleasant Beach))](https://video.nest.com/live/JKTTcsayyN) | No matching catalog beach | No Jenkinsons/Point Pleasant beach row in467-row snapshot. |
| 57 | [The Surfers View (Rockaway)](https://thesurfersview.com/live-cams/new-york/rockaway-beach-cam-and-surf-report/) | Location mismatch or unproven coverage | Generic Rockaway listing does not establish90th or98thStreet field of view; no broad Rockaway row. |
| 58 | [TOBAY Beach Live Stream](https://www.youtube.com/@townofoysterbay9160/streams) | No matching catalog beach | TOBAY has no exact catalog row; do not assign to Montauk Ditch Plains/Turtle Cove or Hampton NH. |
| 59 | [Resorts Casino Hotel Beach Camera](https://www.youtube.com/@ResortsCasino/streams) | No matching catalog beach | Atlantic City Resorts has no exact catalog row; do not assign to Montauk Ditch Plains/Turtle Cove or Hampton NH. |
| 60 | [EEOR - East Hampton, NY Main Beach Surf and Weather Webcam](https://www.youtube.com/@ErdmanVideoSystems/streams) | No matching catalog beach | East Hampton Main Beach has no exact catalog row; do not assign to Montauk Ditch Plains/Turtle Cove or Hampton NH. |
| 61 | [Hamptons.com - LIVE! 4K Main Beach, East Hampton Village, New York - Hamptons Surf Report](https://www.youtube.com/@Hamptons/streams) | No matching catalog beach | East Hampton Main Beach has no exact catalog row; do not assign to Montauk Ditch Plains/Turtle Cove or Hampton NH. |
| 62 | [Hamptons.com - LIVE! Windmill Bay & Beach, Sag Harbor, New York / K Pasa Restaurant](https://www.youtube.com/@Hamptons/streams) | No matching catalog beach | Sag Harbor Windmill Bay has no exact catalog row; do not assign to Montauk Ditch Plains/Turtle Cove or Hampton NH. |
| 63 | [Two Palms (Lori Wilson Park)](https://www.twopalms.com/) | Location mismatch or unproven coverage | Provider HTML explicitly Cape Canaveral, not directory Lori Wilson Park. No Cape Canaveral row. |
| 64 | [New Smyrna Beach Cam 180](https://www.youtube.com/@VolusiaBeaches/streams) | Location mismatch or unproven coverage | New Smyrna Beach/Flagler Avenue listing does not establish inlet coverage; existing inlet row already has another camera. |
| 65 | [Volusia Beaches (New Smyrna Inlet)](https://www.youtube.com/@VolusiaBeaches/streams) | Duplicate or alternate listing | Same Volusia channel as63; channel is not a specific inlet player; existing inlet camera retained. |
| 66 | [Volusia County (New Smyrna Inlet)](https://www.skylinewebcams.com/en/webcam/united-states/florida/new-smyrna/new-smyrna.html) | Existing camera retained | Existing inlet camera retained; no replacement authorized. Skyline broad New Smyrna page also does not prove inlet field of view. |
| 67 | [Skyline Webcams (Laguna Beach - South Crescent Bay)](https://www.skylinewebcams.com/en/webcam/united-states/california/laguna-beach/laguna-beach.html) | Location mismatch or unproven coverage | Provider description identifies The Cliff Restaurant, not South Crescent Bay. No matching exact beach established; do not map by directory proximity. |
| 68 | [Surf & Sand Resort (Laguna Beach - Rockpile)](https://www.surfandsandresort.com/live-webcam) | Location mismatch or unproven coverage | Surf & Sand resort frontage is not Rockpile; exact Rockpile coverage unsupported. |
| 69 | [Lifeguard HQ](https://www.youtube.com/@cityofhb/streams) | Existing camera retained | Huntington pier rows already carry city pier camera; retain those. Lifeguard HQ is another view, not proven Huntington St row. |
| 70 | [View from Huntington Beach Pier](https://www.youtube.com/@cityofhb/streams) | Existing camera retained | Exact video mhQjsLBfOoY already assigned to Huntington pier rows. |
| 71 | [Huntington Pier Webcam](https://www.youtube.com/watch?v=mhQjsLBfOoY) | Duplicate or alternate listing | Same video mhQjsLBfOoY as69. |
| 72 | [Lifeguard HQ Huntington Beach (Huntington Pier)](https://www.youtube.com/watch?v=RGYlFjV-dtc) | Duplicate or alternate listing | Same video RGYlFjV-dtc as68. |
| 73 | [North Coast Aviation (Manchester Beach)](https://northcoastaviation.com/pt_arena/point_arena_west.htm) | Location mismatch or unproven coverage | Provider describes west lighthouse/sky view and Arena Rock offshore, not catalog beach break. No beach field of view established. |
| 74 | [7th Street Surf Shop (Ocean City - 7th Street)](https://7thstreetsurfshop.com/wave-cam) | Duplicate or alternate listing | General wave-cam entry duplicates specific7thStreet provider entry74; use74. |
| 75 | [7th Street Surf Shop (Ocean City - 7th Street)](https://7thstreetsurfshop.com/wave-cam/7th-street) | Add verified camera | Official7thStreet Surf Shop labels specific7thStreet Wave Cam. |
| 76 | [Berger Realty (Ocean City - 7th Street)](https://www.bergerrealty.com/ocean-city/live-cams.html) | Location mismatch or unproven coverage | Provider lists9th,14th and3rdStreet cameras plus Hollywood Arcade, not exact7thStreet camera. Use74 for7thStreet. |
| 77 | [Ocean City Webcams (Ocean City - 14th 15th St)](https://oceancitylive.com/ocean-city-webcams/ocean-city-beach-cam/) | Location mismatch or unproven coverage | Provider explicitly Ocean City MARYLAND21stStreet Grand Hotel, not directory14th/15thStreet NJ. No Maryland catalog rows. |
| 78 | [Sea Isle City Beach Patrol Webcam](https://www.youtube.com/@seaislecitybeachpatrol2994/streams) | Location mismatch or unproven coverage | Beach Patrol HQ44thStreet view does not prove36th–42nd or12thStreet coverage. |
| 79 | [Rehoboth Boardwalk Plaza Hotel Cam](https://www.youtube.com/@rehobothboardwalkcam2205/streams) | No matching catalog beach | No Rehoboth or Delaware beach in supplied catalog snapshot. |
| 80 | [Beach-net.com Boardwalk Plaza Hotel (Rehoboth Main)](https://www.rehobothbeachcam.com/) | Duplicate or alternate listing | Same Boardwalk Plaza/Rehoboth provider camera as78; also no Rehoboth catalog row. |
| 81 | [Flagler Beach Pier Cam (Flagler)](https://www.youtube.com/@flaglerbeachpiercam3210) | Duplicate or alternate listing | Alternate Flagler pier channel; use already playback-verified direct Flagler Surf provider81, one camera per beach. |
| 82 | [Flagler Surf (Flagler)](https://flaglersurf.com/webcam/) | Add verified camera | Provider explicitly Flagler Beach. |
| 83 | [North Vilano - South Ponte Vedra Surf Station Cam](https://www.youtube.com/@SurfStationCam/streams) | No matching catalog beach | No North Vilano/South Ponte Vedra catalog row. |
| 84 | [Surf Station North Pier Cam](https://www.youtube.com/@SurfStationCam/streams) | No matching catalog beach | No St Augustine Pier catalog row. |
| 85 | [@SurfStationCam (St Augustine Pier)](https://www.youtube.com/embed/Q6eZVkUKFxo) | Duplicate or alternate listing | Same video Q6eZVkUKFxo as83; no St Augustine row. |
| 86 | [Surf Station (St Augustine Beach Pier)](https://www.surf-station.com/st-augustine-pier-wave-cam/) | Duplicate or alternate listing | Provider page same StAugustine Pier camera as83; no catalog row. |
| 87 | [City of Redondo Beach Pier](https://www.youtube.com/@CityofRedondoBeachIT/streams) | Location mismatch or unproven coverage | Verified live view explicitly looks SOUTH of Redondo Beach Pier; catalog Redondo Breakwall is north at33.8495,-118.4041. No broad Redondo Beach row. |
| 88 | [LuvinLife (Redondo Beach)](https://www.luvinlife.me/Beach_Cam.html) | Playback unverified | Private owner page has no clear exact Redondo Breakwall coverage and no playable webcam observed. |
| 89 | [Manhattan Beach Cam and Surf Report](https://www.youtube.com/@TheSurfersView/streams) | Existing camera retained | Exact catalog beach already has HDOnTap camera; alternate does not create a new row. |
| 90 | [Venice Sidewalk Cafe (Venice Pier)](https://www.westland.net/beachcam/) | Existing camera retained | Boardwalk/Sidewalk Cafe provider location maps broad Venice Beach, already camera-populated. No Venice Pier row; must not pretend precise pier view. |
| 91 | [🔴 Los Angeles Live Cam · Venice Beach · Venice V Hotel · Live Camera Stream](https://www.youtube.com/@Teleport.camera/streams) | Existing camera retained | Catalog Venice Breakwater and broad Venice Beach both already have HDOnTap view; do not overwrite. |
| 92 | [Gateway Subaru Camera at The Commander Hotel](https://www.youtube.com/@CommanderCamera-qv3xl/streams) | No matching catalog beach | Commander Hotel Ocean City Maryland; no Maryland beach row. |
| 93 | [Days Inn Oceanfront (The Inlet and Pier)](https://daysinnboardwalk.com/ocean-city-md-hotel-live-cam/) | No matching catalog beach | Days Inn Ocean City Maryland; no Maryland beach row; not New Jersey Ocean City. |
| 94 | [Jacksonville Beach Pier Live Cam / South View / By 911surfreport.com](https://www.youtube.com/@eddiewouldknow/streams) | Add verified camera | Provider title/description explicitly southside Jacksonville Beach Pier, provided by pier/BeachLife Rentals/911SurfReport. |
| 95 | [Surf Station (Ponte Vedra)](https://www.surf-station.com/north-vilano-surf-cam/) | Duplicate or alternate listing | Same North Vilano/South Ponte Vedra camera as82; no catalog row. |
| 96 | [Live Cam From The Best Western In Jacksonville Beach, Fl.](https://www.youtube.com/@eddiewouldknow/streams) | Duplicate or alternate listing | Alternate BestWestern Jacksonville shoreline view; selected verified pier south view93 instead. No separate broad Jacksonville beach row. |
| 97 | [Jacksonville Beach Pier Live Cam / North View / By 911surfreport.com](https://www.youtube.com/@eddiewouldknow/streams) | Duplicate or alternate listing | Alternate north view of same named pier; selected verified south view93 under one-camera-per-beach schema. |
| 98 | [Golden Isles Georgia (St Simons Island)](https://www.goldenisles.com/webcams/) | No matching catalog beach | StSimons/GoldenIsles cameras have no catalog row. Tybee Island is a different island and must not receive these. |

## Scope and remaining gaps

- Catalog matching used a fresh read-only snapshot of 467 active beaches. No new beach rows are created by this camera migration.
- One camera URL per beach is supported by the current schema; alternate views remain in the inventory. Existing cameras are preserved.
- The 28 no-catalog listings can inform a separate beach-onboarding batch; attaching them to nearby but different beaches would be misleading.
- Playback-unverified: Moonlight rental/Skyline, Ocean Beach SF/Surfoutlook, Redondo/LuvinLife, and Sheraton Waikiki.
- Kohanaiki plays but exact Pine Trees coverage remains unresolved.
- Native currently lacks a provider-link control; this implementation adds web link-outs and shared source records, not a native camera UI.
- Production unchanged. Prior two-camera approval plan is superseded.
