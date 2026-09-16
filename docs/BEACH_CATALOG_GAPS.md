# Beach catalog gaps from webcam discovery

Recorded 2026-09-03 from the read-only 467-active-beach catalog snapshot and the [full 98-listing camera review](../.planning/evidence/2026-09-03-webcam-expansion/full-review.md). This is a dated onboarding backlog, not a claim about future production coverage.

The 28 listings classified **No matching catalog beach** group into **22 location research entries** below. These are not 22 approved new beach rows: some are broad areas, distinct breaks still need separating, and two are wildlife/sheltered-waterfront research leads. Duplicate camera listings must not create duplicate beaches.

## Prepared additions (2026-09-03)

The research now resolves to **28 new catalog records, 12 verified camera links and 5 licensed photos**, released in migration `20260903200000_add_verified_catalog_gap_beaches.sql`. [See the exact beach list, exclusions and validation](../.planning/evidence/2026-09-03-catalog-gap-beaches/README.md). Applied to production under the approved plan; see the batch release receipt. SEO/recommendations remain disabled until scoring inputs and forecast runtime are reviewed.

## Missing locations behind the 28 listings

Listing numbers below are **one-based**, matching the full-review Markdown table. Camera URLs support discovery; playback and exact coverage were generally not tested once a catalog mismatch was established.

| Region | Missing location / research entry | Listings | Camera evidence | Onboarding note |
|---|---|---|---|---|
| HI — Hawaii Island | Kailua Bay / Hulihee waterfront | 2 | [Source 2](https://www.konaweb.com/cam/index.html) | Camera is at Fish Hopper on Aliʻi Drive. Establish the public beach/surf-zone boundary; not Pine Trees. |
| HI — Oahu | Turtle Bay West | 4 | [Source 4](https://thesurfersview.com/live-cams/hawaii/turtle-bay-beach-cam-west-and-surf-report/) | Provider explicitly names the west beach. Establish the exact public beach and surf-break identity. |
| HI — Oahu | Ala Moana Courts | 8 | [Source 8](https://www.webcamtaxi.com/en/usa/hawaii/honolulu-island-of-oahu.html/) | Distinct from existing Ala Moana Bowls. Camera returned 403 during discovery; coverage/playback unverified. |
| HI — Kauai | Lawai Beach / PKs / Whalers Cove shoreline | 16, 17 | [Source 16](https://www.youtube.com/@OurLawaiBeachResort/streams); [Source 17](https://www.whalerscoveresort.com/webcam) | Grouped for geographic research only. Lawai Beach, PKs and Whalers Cove must not be assumed to be one break or one camera view. |
| HI — Maui | Kaʻanapali shoreline: Eldorado and Whaler/Point | 19, 20 | [Source 19](https://www.mauieldorado.com/webcams); [Source 20](https://www.youtube.com/@mauilivecam7143/streams) | Two camera locations in one research area. Determine whether separate beach/break rows are warranted; not Lahaina Harbor. |
| HI — Maui | Hale Mahina shoreline / S-Turns | 21 | [Source 21](https://halemahinacondo.com/web-cam/) | Confirm the actual named beach in view; the directory’s S-Turns association is not established. |
| CA — Pacifica | Sharp Park Beach / Pacifica Pier | 35, 36, 39 | [Source 35](https://www.youtube.com/watch?v=QYRIc4LcvqQ); [Source 36](https://www.youtube.com/watch?v=lmec_rcEIL4); [Source 39](https://www.skylinewebcams.com/en/webcam/united-states/california/pacifica/pacifica-sharp-park-beach.html) | Three listings for the same beach/pier area. Consider pier and beach aliases before adding rows; not Linda Mar or Rockaway. |
| CA — Point Reyes | Point Reyes / Drakes Estero research area | 43 | [Source 43](https://www.youtube.com/watch?v=t4IilnlL_9Q) | Wildlife stream, not a confirmed public surf-beach view. Research-only; identify a suitable public beach before proposing a row. |
| CA — Santa Cruz | Santa Cruz Main Beach | 45 | [Source 45](https://www.usgs.gov/media/webcams/santa-cruz-main-beach-video-camera-1-snapshot) | USGS source is a Main Beach still, not Cowells Cove. Treat Cowells as a separate potential catalog gap. |
| OR — Lincoln City | Chinook Winds / Roads End shoreline | 49 | [Source 49](https://www.youtube.com/watch?v=KFPYXo72qDI) | Confirm the resort view’s precise beach boundary; not Nelscott Reef. |
| VA — Virginia Beach | Oceanfront at 25th Street | 52 | [Source 52](https://vbbound.com/webcams/courtyard-virginia-beach-boardwalk-webcam/) | Courtyard camera location. Decide whether this belongs to a broad Virginia Beach row or a distinct beach section. |
| VA — Virginia Beach | Oceanfront at 5th Street | 53 | [Source 53](https://vbbound.com/webcams/watermans-surfside-grill-boardwalk-webcam/) | Watermans camera location. Coordinate with the 25th Street candidate; not the existing 1st Street Jetty. |
| NJ — Point Pleasant Beach | Jenkinson’s / Point Pleasant Beach | 56 | [Source 56](https://video.nest.com/live/JKTTcsayyN) | Exact catalog match absent. Verify public access, beach identity and current Nest playback. |
| NY — Long Island | TOBAY Beach | 58 | [Source 58](https://www.youtube.com/watch?v=Qzcvhq34p6w) | Exact catalog match absent. Verify beach identity/access and camera field of view. |
| NJ — Atlantic City | Resorts Casino oceanfront beach | 59 | [Source 59](https://www.youtube.com/watch?v=vVyBOU9Huvo) | Exact catalog match absent. Choose a public beach name, not merely the hotel name. |
| NY — East Hampton | Main Beach | 60, 61 | [Source 60](https://www.youtube.com/watch?v=E8fp7TDgQUk); [Source 61](https://www.youtube.com/watch?v=xM1-e429Y3A) | Two providers for the same named beach. Create at most one beach candidate unless distinct zones are substantiated. |
| NY — Sag Harbor | Windmill Bay / beach waterfront | 62 | [Source 62](https://www.youtube.com/watch?v=l1A96hXsrCU) | Sheltered waterfront view; surf suitability and exact public beach identity unverified. Research-only. |
| DE — Rehoboth Beach | Rehoboth Main / Boardwalk Plaza beachfront | 79 | [Source 79](https://www.youtube.com/watch?v=lq15dNFXISw) | Additional listing 80 is a duplicate; one geographic candidate. |
| FL — North Vilano | North Vilano / South Ponte Vedra | 83 | [Source 83](https://www.youtube.com/watch?v=o4BJ-eDgYrM) | Provider describes this coastal area; establish exact spot boundaries. Listing 95 repeats the provider. |
| FL — St. Augustine Beach | St. Augustine Beach Pier | 84 | [Source 84](https://www.youtube.com/watch?v=Q6eZVkUKFxo) | Listings 85/86 repeat the video/provider page. One pier candidate. |
| MD — Ocean City | Ocean City oceanfront | 92, 93 | [Source 92](https://www.youtube.com/watch?v=zCEiot7sEWY); [Source 93](https://daysinnboardwalk.com/ocean-city-md-hotel-live-cam/) | Commander Hotel and Days Inn are different camera positions. Listing 77 adds the 21st Street Grand Hotel view, mislabeled as New Jersey. Determine broad beach versus individual sections. |
| GA — St. Simons Island | St. Simons Island beaches | 98 | [Source 98](https://www.goldenisles.com/webcams/) | Regional camera landing page, not yet a precise beach candidate. Identify exact public beach/field of view; not Tybee Island. |

## Additional gaps hidden under other review outcomes

The 28-listing count is not the full set of possible missing beaches. Some sources were classified first as mismatched, duplicate or offline. Retain these separately for research; they are not included in the 22 entries above.

| Region | Candidate | Evidence / caveat |
|---|---|---|
| HI — Hawaii Island | Kaunaʻoa Bay / Mauna Kea Beach | [Hotel camera](https://marriott.ozolio.com/mauna-kea-beach-hotel/) identifies Kaunaʻoa, not existing Hapuna. |
| HI — Maui | Napili Bay | [Napili Sunset](https://www.napilisunset.com/live-webcam/) identifies Napili Bay; directory Little Makaha label was unsupported. |
| HI — Maui | Kamaole II | [Hale Pau Hana](https://halepauhana.com/see-and-do/) location, not Kihei Cove. |
| HI — Maui | Wailea Beach / resort frontage | [Grand Wailea camera](https://www.grandwailea.com/grand-wailea-maui-webcam) is Wailea, not Kihei Cove; provider discloses evening replay. Verify exact beach frontage. |
| HI — Maui | Kihei Cove | Absent from reviewed catalog, but [Rentals Maui](https://www.rentalsmaui.com/maui-web-cam/) was offline and the other “Kihei Cove” listings pointed elsewhere. Research a real exact-spot source. |
| CA — Marin | Muir Beach | [Sigward](https://www.sigward.com/) explicitly names Muir Beach; directory Stinson label was wrong. |
| CA — Santa Cruz | Cowells Cove / Cowell Beach | Absent in prior review, but the [USGS source](https://www.usgs.gov/media/webcams/santa-cruz-main-beach-video-camera-1-snapshot) points to Main Beach. Obtain independent Cowells evidence. |
| CA — Tomales Bay area | Lawson’s Landing / Shark Pit | [Owner camera](https://www.lawsonslanding.com/webcam.html) reported maintenance. Confirm exact public beach and whether Shark Pit is actually in view. |
| CA — Bodega Bay | Horseshoe Cove; Salmon Creek | [BOON](https://boon.ucdavis.edu/tools/coastal-conditions/) shows Horseshoe Cove, not Salmon Creek. These are separate candidates; research reserve access and exact public beach suitability. |
| WA — Olympic coast | Kalaloch Beach / creek frontage | [Camera image](https://pixelcaster.com/dnc-kalaloch/kalaloch.jpg) concerns Kalaloch, not directory “The Cape.” Verify exact position. |
| FL — Cape Canaveral | Cape Canaveral beachfront | [Two Palms](https://www.twopalms.com/) identifies Cape Canaveral, not Lori Wilson Park. Exact public beach naming remains unresolved. |

Do not create a new row just to accommodate broad Rockaway, New Smyrna, Redondo, Sea Isle or Laguna camera labels. Those areas already contain specific catalog beaches; resolve exact field of view and aliases first. Farallon Islands wildlife footage is not a beach-onboarding candidate.

## Before adding any beach

1. Refresh production UUID/name/slug/alias and nearby-coordinate checks, including unpublished/pending beach migrations. This report used the active catalog snapshot, not an exhaustive historical or alias audit.
2. Establish the public beach identity, coordinates, access, surf zone and hazards from reliable sources. Resolve broad areas and distinct breaks before choosing names/slugs.
3. Research forecast inputs, timezone and required editorial/terrain fields under the beach-onboarding workflow. Camera availability alone does not justify publishing a beach.
4. Verify camera playback and precise coverage; use a provider link unless embedding rights are established. Obtain suitable licensed beach imagery separately.
5. Prepare and test an idempotent beach migration with independent review. Production changes require the repository migration approval process.

The original documentation task made no data changes. The subsequent implementation is prepared and tested locally; production remains unchanged.
