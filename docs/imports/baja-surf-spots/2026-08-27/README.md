# Baja surf catalog production-enrichment package

Generated on 2026-08-27 from the three operator-supplied v1 JSON files in `/Users/stevenchandler/Downloads`.

## Outcome

- 114 source records reconciled: 112 surf spots and 2 non-rankable parent areas.
- 105 surf spots are new inserts; 7 preserve existing Quiver UUIDs for updates.
- All 112 importable spots have a deterministic UUID, unique slug, locality, normalized break type, integer offshore-wind bearing, explicit local timezone, access guidance, hazards, and a swell window.
- 5 exact-location Commons photographs were manually reviewed and approved at the data-package level.
- 4 generated regional fallbacks cover the other 109 records. The operator approved them on 2026-08-27. They use the accepted `beach_photos.source = 'user'`, retain `generation_source = 'ai_generated'`, and are explicitly illustrative rather than exact-location evidence.
- Open-Meteo marine probes passed for all 112 surf spots. Spot-specific published evidence now validates a conservative skill floor for every spot. Recommendation eligibility is enabled for all 112 using sourced tide stages where available and an explicit neutral tide policy where they are not. SEO remains a staging/rendering gate.
- Browser coordinate validation retained exact Surfline report/tide references for 101 of the 112 surf spots (plus one parent-area record). Twenty-one Surfline guides add observed ability, ideal-tide, swell, wind, and hazard fields; Las Gaviotas has guide evidence but no coordinate-valid exact report match. Surfline's own search also resolved two misspelled aliases and exposed their map coordinates and breadcrumb localities. Transient forecast values were not imported.

The normalized source of truth is `baja-surf-spots-production-v2.json`. `skill-and-tide-research-v1.json` provides the auditable before/after record lists for the 90 skill, 80 tide-observation, and 32 tide-calibration source blockers. The research caches preserve the geocoding and editorial evidence used to build the package. `creative-manifest.json` records the generated fallback provenance.

## Recommendation readiness versus SEO eligibility

All 112 imported beaches are recommendation-ready, but recommendation readiness does not authorize search-engine indexing. Recommendations need enough structured inputs to score a spot safely: a validated skill floor, swell and wind inputs, and either sourced tide guidance or an explicit neutral-tide policy. The main beach editorial page has a separate human-review contract requiring `seo_indexable = true`, `editorial_reviewed_at`, reviewed source provenance, and substantive location-specific content.

This package deliberately keeps `seo_indexable = false` for every imported beach because the SEO review has not occurred. In particular, 77 records remain provisional editorial, all coordinates remain non-navigation-safe, access and hazards were not field-inspected, and 107 imported heroes are disclosed regional AI illustrations rather than exact-location documentary photos. These facts do not prevent catalog display, forecasts, maps, or recommendations; they constrain how confidently a public editorial page may describe the location.

SEO may be enabled later on a spot-by-spot basis after a reviewer confirms source completeness, unique and useful local copy, canonical identity, claim/evidence alignment, attribution and AI-media disclosure, production-like routing, and the required database fields. Forecast pages remain subject to their separate live-data gate. The workspace-wide policy is documented in [`docs/seo/BEACH_INDEXING_ELIGIBILITY.md`](../../../seo/BEACH_INDEXING_ELIGIBILITY.md).

## Field normalization

| Concern | Production representation | Source preservation |
| --- | --- | --- |
| IDs | Existing UUIDs preserved; new IDs are deterministic UUIDv5 values | `source_spot_id` retained |
| Slugs | NFKD-normalized, lowercase kebab-case; package-wide uniqueness validated | Canonical name and aliases retained |
| Locality | 71 nearest reverse-geocodes plus 43 editorial regional overrides | Nominatim result, OSM identity, timestamp, and confidence retained |
| Break type | Exact Quiver values: 27 `beach`, 43 `reef`, 42 `point`; parent areas remain null | Original break value and category list retained |
| Wind bearing | Rounded to integer for the `beaches.smallint` contract | All 39 changed half-degree values retained in `wind_offshore_deg_source` |
| Coordinates | 57 secondary map/satellite pins, 45 OSM-reviewed vicinity pins, and 10 remote-water planning pins | Original pin, secondary pin, distance, provenance, and review status retained; all remain non-navigation-safe |
| Access/hazards | 59 spot-specific and 53 regional/map access reviews; every surf spot has a non-empty conservative hazard list | Evidence URL, status, and the distinction between spot-specific and regional guidance retained |
| Swell | All 112 surf spots have min/max degree windows: 28 direct spot-specific ranges, 16 existing multi-source ranges, 1 collapsed-lobe range, and 67 disclosed ±22.5° editorial priors | Method, confidence, evidence URL, and source text retained per spot |
| Skill suitability | All 112 spots have spot-specific published skill evidence. The stored minimum is the stricter of the prior conservative candidate and published guide levels; 68 records preserve a disagreement or stricter conservative floor | Every source level, exact URL, conflict status, conditions-dependent warning, and confidence retained |
| Tide | 59 spots have sourced tide-stage guidance; 53 use a neutral recommendation policy. Numeric height bounds remain null because stage labels are not measured local-datum observations | Sourced stage, direction, source text, conflicts, confidence, and explicit no-bonus/no-penalty policy retained |
| Timezone | Baja California uses `America/Tijuana`; Baja California Sur uses `America/Mazatlan` | Stored timezone is now preferred by the runtime factory; coordinate inference remains only for legacy rows |
| Media | Approved licensed photos or a disclosed generated regional fallback | Source page, creator, license, match evidence, and approval state retained |
| Forecast probe | All 112 spots returned non-null wave and swell height/direction/period data from Open-Meteo's marine endpoint | Requested coordinate, returned model-grid coordinate, distance, variable coverage, GMT response basis, timestamp, and attribution retained |
| Surfline | 101 surf spots have browser-coordinate-validated Surfline spot IDs plus report/tide-page references; 21 have guide fields, including one guide-only record. Of 110 candidate matches, 102 records were retained after 96 immediate validations, 6 corrected matches, and 8 geographic rejections | Candidate and Surfline coordinates, distance, rejection status, match method, displayed alias, breadcrumb locality, guide URL, evidence method, access limitation, and excluded-use policy retained |

## Approved exact-location photographs

| Spot | Commons file | License |
| --- | --- | --- |
| Rosarito | [Rosarito Beach](https://commons.wikimedia.org/?curid=14519338) | CC BY 2.0 |
| Islas de Todos Santos | [Isla de Todos Santos — from boat](https://commons.wikimedia.org/?curid=90739644) | CC BY-SA 4.0 |
| San Miguel | [Playa San Miguel, Ensenada](https://commons.wikimedia.org/?curid=90168857) | CC BY-SA 4.0 |
| Cabo Pulmo | [Cabo Pulmo beach at sunset](https://commons.wikimedia.org/?curid=129160897) | CC BY-SA 4.0 |
| Cerritos Point | [Cerritos Beach panorama](https://commons.wikimedia.org/?curid=64128533) | CC BY-SA 2.0 |

License attribution must remain visible wherever these photos are rendered. The discovery cache is not itself an approval list; only records whose hero status is `approved_exact_location_photo` passed the manual image and location review.

## Generated fallbacks

The four WebP assets in `public/images/beaches/baja/` represent broad regional archetypes: Baja Norte beach, Baja Norte reef/point, Baja Sur beach, and Baja Sur reef/point. They intentionally contain no identifiable landmark. Every mapped record carries this disclosure:

> AI-generated representative Baja coastline. Illustrative only; not this exact break or current conditions.

They must not be presented as documentary photos of a named spot. The current status is `approved`, and each mapped hero is `approved_illustrative_fallback`.

## Remaining gates and risks

1. Keep navigation disabled for these pins. The editorial review establishes surf-break vicinity, not current legal access, parking, launch, or takeoff coordinates. The 10 remote-water planning pins need the most caution; access, gates, roads, reefs, currents, and security can change and were not field-inspected.
2. Recommendation eligibility no longer requires invented tide heights. The 53 neutral-tide spots receive neither a tide bonus nor a penalty. Continue collecting sessions because those observations can replace neutrality with locally calibrated preferences. Six sourced tide profiles contain published stage disagreements and remain soft inputs only.
3. Skill suitability is conditions-dependent. The package intentionally keeps the more restrictive level when a conservative source candidate and a published guide disagree; it must not be presented as a guarantee that a spot is safe at every size.
4. Treat the 67 ±22.5° swell windows as initial editorial priors. Calibrate them with observed sessions before using their edges as strict recommendation cutoffs. One two-lobe source profile is stored as an inclusive range because the current database supports only one min/max window.
5. Review the 9 East Cape model grids more than 10 km from their requested pins; the largest distance was 16.27 km. All six requested marine variables were populated, but grid resolution can smooth local shadowing and refraction.
6. Reassess Open-Meteo plan and licensing before Quiver serves paying subscribers. The current operator-approved basis is the free endpoint while there are no paying users.
7. Confirm staging UI presentation of generated-media disclosure and Commons attribution. Keep SEO indexing disabled until the separate review in [`docs/seo/BEACH_INDEXING_ELIGIBILITY.md`](../../../seo/BEACH_INDEXING_ELIGIBILITY.md) is complete.
8. No coordinate-valid exact Surfline report/tide match remains for Las Gaviotas, Dunes, Punta Piedra, El Paso, Cabo San Quintín, Punta Hughes, Playa San Pedro, Playa Las Palmas, San José Rivermouth, La Punta, or Rancho San Carlos. Las Gaviotas retains independently indexed Baja guide evidence only. Do not force globally duplicated same-name pages onto these records. Surfline's tide pages identify prediction references, not a spot's preferred tide stage or locally calibrated numeric height.

## Research and licensing constraints

- Nominatim was used only for a one-time, rate-limited, cached enrichment pass with attribution. Do not use the public service as a production geocoder. See the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and [OpenStreetMap copyright page](https://www.openstreetmap.org/copyright).
- Wikimedia candidates were restricted to licenses permitting commercial reuse, then manually reviewed for the five approved photos. See [Commons reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia).
- Open-Meteo's free marine endpoint was probed in five batches with `cell_selection=sea`, a six-hour horizon, and GMT API output. Beach timezone fields were not converted: Baja California Sur remains `America/Mazatlan`. The cache contains summaries rather than the transient forecast arrays. See the [Marine Weather API documentation](https://open-meteo.com/en/docs/marine-weather-api).
- Spot research combined the operator-supplied profiles with 60 cached SurfTrips pages, 106 cached WaveWise Baja guides, OpenStreetMap, DeepSwell, regional surf guides and blogs, official Mexican nautical/access material, and two book references. WaveWise discloses that some spot inputs derive from meta-surf-forecast; the package retains that limitation rather than treating it as independent field corroboration. Books were used for regional methodology only when page-level text was unavailable; they are not falsely cited as spot-level confirmation.
- Surfline research used its permitted public spot sitemap, public search-indexed guide results, and the operator-opened browser session for read-only searches and rendered spot-guide inspection. The browser resolved Surfline's `Boca Del Solado` and `Punta Pamilla` spellings, exact spot IDs, coordinates, and localities; it also exposed globally duplicated slugs that the sitemap alone could not disambiguate. Direct script requests still do not scrape spot pages or call Surfline's robots-disallowed `/api`. Exact report/tide URLs are retained only after coordinate validation; guide-derived fields exist only on the 21 records with observed indexed or rendered guide evidence.

A database migration was generated and validated in an isolated local PostgreSQL cluster. It has not been applied to production, and no production state was changed.
