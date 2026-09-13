# Catalog source-plus-bathymetry update plan

## Outcome

The catalog audit covers 128 records derived from the committed 346-row production catalog snapshot:

- 25 records without a V2 swell window;
- 103 records with a material V1/V2 disagreement;
- 128 records requiring exact, targeted, or explicitly regional-plus-exact-terrain source resolution;
- 128/128 records with a documented production action;
- 126 swell-window updates;
- three of those updates use documented refraction/headland-wrap overrides because straight offshore rays cannot represent Fort Point, Mitchell's Cove, or Westport Half Moon Bay;
- one displaced Short Sands duplicate to soft-delete after dependency checks;
- one Waikoloa resort-lagoon record to exclude from surf recommendations and SEO rather than assign a fabricated surf window.

The audit also expands the Baja validation from the earlier 65-record low-confidence subset to all 112 rankable Baja spots. One hundred eleven pass the direct independent GMRT and NOAA ETOPO threshold. Punta Arenas is the sole documented refraction exception: two exact guides support south swell, a third describes the Gulf wrap, and the window is narrowed to `157.5°–180°` to exclude the land-blocked SSW side.

## Exact artifacts

- Bathymetry screen: `catalog-source-bathymetry-screen.json`
- Source resolution: `catalog-source-bathymetry-resolution.json`
- Targeted evidence: `manual-direction-evidence.json`
- Surf-Forecast evidence: `surf-forecast-direction-evidence.json`
- SurfSpots.co evidence: `surfspots-direction-evidence.json`
- Catalog bathymetry script: `scripts/research-catalog-bathymetry.py`
- Surf-Forecast fetcher: `scripts/fetch-catalog-surf-guide-evidence.py`
- SurfSpots.co fetcher: `scripts/fetch-catalog-surfspots-evidence.py`
- Resolution script: `scripts/resolve-catalog-swell-windows.py`

Current SHA-256 values:

- Bathymetry screen: `72bc5e1f282c71f17fc1ed31ae426e5c92b12ccc3829abfaba46ab083f23f511`
- Source resolution: `ec7685e48a434597b81a8f0a5b35854d4d4f233b96eaa3f866603b0259752081`
- Targeted evidence: `f59d23837462d1629670b70b26e2dfe6f1000473811c57932bee05307865d2be`
- Surf-Forecast evidence: `3cf77013af3920a56619508f5b6ad189c912be555113732a6672a63d24c1f429`
- SurfSpots.co evidence: `759278511c8d62874e34c6cfbf08d21e2fde2a99f5cfb3041430aa15ae5dbf1d`
- Catalog bathymetry script: `40958e5092b27f510449bbbf25f8d168894b19dc62ca9f9326fd8841155cff2c`
- Surf-Forecast fetcher: `f1ea14fdefe8daffe3186424f2cdb42499c357adab29ed9736f2e35dd5d0b706`
- SurfSpots.co fetcher: `23fa5fc9acdc519fb10fa1ae872954e693e01673a6fc5a4586bdd046282f327d`
- Resolution script: `605d225117ee3dab894cbab500213a6e371335310d174f034b52f9863641a547`

Any artifact-content change invalidates these hashes and requires regeneration.

## Methodology and limits

1. Candidate records are derived mechanically from the catalog snapshot. Material disagreement means either a circular endpoint shift of at least `90°` or a circular span change of at least `120°`.
2. Each V1/V2 candidate window is sampled at five bearings from 4–60 km against GMRT 500 m and NOAA ETOPO 2022 15 arc-second grids.
3. A direct-exposure window passes only when at least three of five bearings remain at least 85% ocean in both independent grids. This screen is not a wave-transformation model and cannot by itself exclude documented refracted or headland-wrapped swell.
4. Bathymetry establishes geometric plausibility, not wave quality, reef takeoff behavior, tide preference, crowd level, or skill suitability.
5. Published guide evidence is accepted automatically only with a coordinate-and-name match that preserves named sub-break qualifiers. The same shared qualifier validator gates primary and secondary candidates from both automated providers; section, street, pier, jetty, cove, peak, and similar qualifiers must agree unless an explicit alias is documented. Aliases and complex records use documented targeted research. When no exact guide exists, regional direction context is explicitly labeled and may be used only with an exact-location identity source and both exact-coordinate terrain grids.
6. When one candidate fails direct bathymetry, it is not selected unless exact spot sources and the local terrain jointly document refraction or wrapping. Those exceptions require an explicit source-plus-terrain override; Fort Point uses `270°–315°`, Mitchell's Cove uses `225°–315°`, and Westport Half Moon Bay uses `225°–315°`.
7. When both candidates pass, the candidate matching more normalized source directions wins; ties prefer the narrower window. Any selected update with zero source-direction hits fails closed.
8. All selected windows remain medium confidence. No record is promoted to high confidence solely from guide text plus coarse bathymetry.

## Identity dispositions

### Short Sands displaced duplicate

- Displaced record: `2c2dea98-280b-488c-9d46-ffed8226447b` at `45.8117,-123.9632`.
- Canonical record: `6d3a734b-b051-490d-87e4-df83c3f49c42` at `45.7599,-123.9666`.
- Map verification: the displaced pin reverse-geocodes to a house on Pacific Road in Arch Cape; the canonical pin reverse-geocodes to Short Sand Beach Trail at Oswald West.
- Proposed action: retain and update the canonical record; soft-delete the displaced duplicate only after a fresh dependency count for sessions, favorites, reviews, photos, forecasts, and other foreign-key consumers.

### Waikoloa Village Lagoon

- Record: `22d65140-1c40-4bbe-8790-5068fa6e5f22` at `19.922,-155.887`.
- Map verification: the pin reverse-geocodes to Waikoloa Beach Drive, not an ocean surf break.
- Official resort documents describe protected lagoon/bay wave climate, not a validated open-ocean break.
- Proposed action: do not assign the candidate swell window. Keep SEO and recommendation eligibility disabled and exclude the record from surf forecasting. Decide separately whether to soft-delete it after dependency review.

## Release gate

No SQL migration is release-ready from this artifact alone. Before generating SQL:

1. Obtain a fresh read-only production extract for the 128 exact IDs, including current V1/V2 window fields, deletion state, coordinates, terrain fields, SEO state, and editorial provenance.
2. Require exact identity agreement with the committed snapshot or document every drift.
3. Count dependent rows before either identity disposition.
4. Generate guarded SQL whose `WHERE` clauses include the observed current values and whose postconditions require the exact affected-row count.
5. Back up affected beach and photo rows before applying.
6. Run a linked dry run and require the pending migration set to contain only the reviewed catalog migration.
7. Obtain a new explicit production approval. This plan does not authorize commit, push, merge, deploy, or database mutation.

The plain HTTP production endpoint is bot-protected, and the browser surface does not expose the internal V2 fields. Accessing the local service-role credential requires separate operator confirmation under workspace safety policy, so fresh production reconciliation remains the final release-preparation gate.
