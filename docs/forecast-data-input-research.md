# Forecast Data Input Research

Generated: 2026-06-20

Conclusion: Quiver can improve recommendations with current data first. The highest-impact next input is better break-specific metadata plus session-derived calibration, not direct production GFS-Wave ingestion. GFS-Wave is worth a small San Diego proof of concept, but not as a first production dependency.

## Current Quiver Data Inventory

### Forecast Data In Use

| Input | Current source/path | Consumers | Notes |
| --- | --- | --- | --- |
| Wave forecast | `lib/services/noaa-wavewatch/*` | `enhanced_forecasts`, discovery, beach detail, spot reports | Current service resolves NWS points/grid data and merges Open-Meteo for extended/fallback horizons. |
| Open-Meteo marine values | `fetchOpenMeteoData` | Extended wave forecasts, raw `_om` fields, disabled GFS-Wave shadow | Open-Meteo Marine returns hourly wave forecasts and exposes wave/swell/wind-wave variables. Free API is non-commercial only; commercial Quiver use needs a paid plan or self-hosting. |
| Tides | `NOAACOOPSService` | `tide_forecasts`, `enhanced_forecasts`, session snapshots | NOAA CO-OPS API provides tide predictions and observations with request limits by interval. |
| Wind/weather | NWS API via `NOAAWeatherDataSource` | `enhanced_forecasts`, scoring | NWS API provides forecasts, alerts, and observations through cache-friendly JSON-LD endpoints. |
| CDIP observations | `lib/services/cdip/*` | nowcast anchoring, forecast builder, observation truth | CDIP THREDDS has observed and modeled wave data; realtime files update about every 30 minutes. |
| IOOS/NDBC observations | `ForecastDataSourceManager.fetchBuoyObservationWithFallback` | fallback buoy observations, cache | IOOS cached-first strategy with NDBC direct fallback in database views/migrations. |
| Sun times | `sun_times` | discovery window selection | Used to avoid/shape windows around daylight and sunset. |
| Break metadata | `beaches` | all scoring paths | Existing fields cover core swell/wind/tide orientation but gaps remain for size limits, bottom type, seasonality, and local effects. |

### Current Forecast Gaps

- Direct NOAA/NCEP GFS-Wave NOMADS ingestion is not implemented.
- GFS-Wave is present only indirectly through Open-Meteo model support and a disabled report-only shadow path.
- Session snapshots do not store recommendation score/rank at session time.
- Break metadata exists but is uneven: many useful columns are present, yet not all breaks have curated local rules or size/tide limits.
- Forecast confidence exists, but confidence is not yet explicitly adjusted by session-confirmed break behavior.
- Safety overlays are incomplete: NWS alerts/beach hazards are not clearly folded into scoring as hard demotions.

## Missing Data Input Candidates

| Source/Input | Data Type | Coverage/Freshness | Cost/Licensing | Complexity | Product Value | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Curated break metadata | Ideal/acceptable swell, wind, tide, min/max size, bottom type, seasonality, local effects | Only where curated; stable | Internal data | Low/medium | High for break-level recommendations | Priority 1. Fill San Diego first. |
| Session-derived calibration | Completed/intent/repeat behavior by conditions | Current Quiver users; grows over time | Internal data; privacy-sensitive | Low/medium | High for personalization and calibration | Priority 1. Implement conservative aggregate boost now. |
| NWS alerts/beach hazards | Advisories, warnings, beach hazards, marine hazards | US; live API | NWS public-domain data with attribution caveats | Low | High safety value | Priority 1 as a safety demotion/flag. |
| CDIP modeled nearshore wave data | Modeled nearshore waves, buoy observations | Strong West Coast coverage; realtime observed data | Open academic/government program | Medium | High for California calibration | Priority 1/2. Expand where station mapping is good. |
| NOAA/NDBC spectral wave data | Spectral wave observations | Buoy-dependent; realtime and historical | NOAA/NWS data | Medium | Medium/high for validation, not direct UX | Priority 2. Use for model validation. |
| NOAA CO-OPS water levels/currents | Tide/water level observations/predictions, currents | Station-dependent; official | NOAA/NWS data | Low/medium | Medium; high for tide-sensitive breaks/inlets | Priority 2. Current tide predictions already exist. |
| NOAA/NCEP GFS-Wave direct | GRIB2 model wave partitions | Global/regional cycles 00/06/12/18 UTC; out to 384h | NOAA/NWS public-domain data | High | Medium as validation/source parity | Priority 2 PoC only, not production first. |
| HRRR/RAP wind | High-res wind model | CONUS; hourly; HRRR 3km | NOAA open data | High | Medium for wind-sensitive breaks | Priority 2 after metadata and safety overlays. |
| National Blend of Models | Calibrated gridded weather guidance | CONUS/open AWS bucket | NOAA open data | High | Medium for wind/weather consistency | Priority 2/3. Useful but broad. |
| Bathymetry/shoreline contours | Nearshore depth/shoreline geometry | Public sources vary by area | Usually open but source-specific | High | High long-term, slow to operationalize | Priority 2/3. Use selectively. |
| Webcams | Visual truth/crowd proxy | Spot-dependent | Legally variable | High | Potentially high but risky | Do not add yet without rights. |
| Commercial surf APIs | Surf model/spot forecasts | Broad | Paid/commercial | Low/medium | Potential value, duplicates current stack | Do not add before internal calibration. |
| Crowd proxies | Popularity/parking/crowd | Fragmented | Privacy/legal risk | Medium/high | Medium, easy to misuse | Do not add yet. |

## GFS-Wave Assessment

### Does Quiver Already Use It?

Not directly. Quiver does not download NOMADS GFS-Wave GRIB2 files. Current wave ingestion is named `NOAAWaveWatchService`, but its primary near-term path is NWS grid forecast data with Open-Meteo marine fallback/extension. There is a report-only GFS-Wave shadow helper that pins Open-Meteo model `ncep_gfswave016`, writes to `gfs_wave_shadow_forecasts`, and is disabled in code.

### Official Data Facts

- NOAA/NCEP describes GFS-Wave as WAVEWATCH III unified with GFS.
- It runs four cycles daily: 00, 06, 12, and 18 UTC.
- Forecast horizon is hourly from 0-120 hours and every 3 hours from 120-384 hours.
- Post-processed grids include West Coast/Eastern Pacific/Atlantic at about 0.16 degrees and global at 0.25 degrees.
- West Coast regional grid file names include `gfswave.tCCz.wcoast.0p16.fNNN.grib2`.
- Output parameters include combined wave height/direction/period, wind-wave height/period/direction, and first/second/third swell partition height/period/direction.
- NOMADS supports GFS Wave access through grib filter and HTTPS data listings.

Sources:

- [NCEP/EMC GFS-Wave model description](https://polar.ncep.noaa.gov/waves/Model_Description.pdf)
- [NCEP NOMADS GFS-Wave grib filter](https://nomads.ncep.noaa.gov/gribfilter.php?ds=gfswave)
- [NCEP wave model product inventory](https://www.nco.ncep.noaa.gov/pmb/products/wave/)

### Product Value

Direct GFS-Wave would add value mainly as:

- A validation/shadow source for current forecast rows.
- A fallback if Open-Meteo access, terms, or model blend becomes unsuitable.
- A way to inspect exact model partition fields and source cycles.
- A research baseline against CDIP/NDBC observations and completed Quiver sessions.

It is less likely to solve break-level recommendation quality by itself because:

- Even the 0.16 degree regional grid is still offshore/coastal model guidance, not a surf-break transformation.
- Break-level quality depends heavily on local exposure, bathymetry, tide behavior, wind shelter, and skill/board context.
- Quiver already has swell partition-like values through current NWS/Open-Meteo paths.
- GRIB2 ingestion adds parsing, storage, cycle, retry, and cache complexity.

### Minimal PoC Plan

Do not implement production ingestion first. If pursued:

1. Scope to San Diego / Southern California only.
2. Pick 5-10 known breaks: e.g. Ocean Beach Pier, Tourmaline, La Jolla Shores, Scripps, Del Mar, Ponto, Oceanside Harbor.
3. Map each break to one offshore point and one nearshore/coastal point where available.
4. Pull only West Coast 0.16-degree fields and only variables needed for validation:
   - `HTSGW`, `DIRPW`, `PERPW`
   - `WVHGT`, `WVPER`, `WVDIR`
   - `SWELL`, `SWPER`, `SWDIR` for partitions 1-3
   - `WIND`, `WDIR`, optionally `UGRD`/`VGRD`
5. Use NOMADS grib filter or partial GRIB requests. Do not download full global files.
6. Cache by cycle, file, grid point, and forecast hour.
7. Store either raw shadow rows or derived feature rows only, not production `enhanced_forecasts`.
8. Compare against:
   - CDIP/NDBC observations.
   - Existing `enhanced_forecasts`.
   - Completed session snapshots and ratings.
9. Success criterion: measurable improvement in validation error or explanation of completed-session behavior that current data misses.

### Operational Risks

- GRIB2 parsing in the current Next.js/Vercel path is not a good fit. Use a separate worker/offline script if needed.
- Forecast cycles can be late/missing; ingestion needs retry and fallback semantics.
- Regional grids still need local transformation and break metadata.
- Storage can grow quickly if storing full horizons for every break/cycle.
- NOAA/NWS data is public-domain unless otherwise noted, but Quiver must not imply NOAA endorsement or present modified output as official government material.

## Highest-Impact Input To Add First

Add/complete break-specific surf intelligence for San Diego and use current session behavior for calibration.

Why:

- Current break metadata already drives scoring. Filling the missing fields improves every recommendation immediately.
- It is cheaper and safer than a new model ingestion pipeline.
- It explains why users choose certain breaks under similar conditions better than another offshore model point.
- It supports conservative behavior scoring: sessions can validate or challenge curated rules.

How it should affect scoring:

- Hard safety/fit limits: max reasonable size, dangerous wind/onshore thresholds, break skill level.
- Soft boosts: ideal swell direction/period, tide band, offshore wind, board fit.
- Confidence: increase only when curated metadata and completed-session behavior agree; reduce when planned intent fails to complete repeatedly.

Validation:

- Backtest against completed sessions and session ratings.
- Compare before/after ranking for known San Diego breaks.
- Track recommendation impressions/taps/sessions once exact events are added.
- Keep boost caps and sparse-data penalties.

## Break Metadata Vs New Forecast API

Better break metadata should improve recommendations more than GFS-Wave in the near term.

Existing useful fields:

- `break_type`
- `skill_level`
- `aspect_deg`
- `swell_window_min_deg`, `swell_window_max_deg`, `swell_window_center_deg`, `swell_window_halfwidth_deg`
- `wind_offshore_deg`, `wind_offshore_tol_deg`, `wind_cross_shore_ok_kt`, `wind_onshore_bad_kt`
- `preferred_tide_ft_min`, `preferred_tide_ft_max`, `preferred_tide_direction`
- `terrain_enabled`, `swell_access_factors`, `wind_exposure_factors`
- `cdip_station`, `cdip_eligible`, `nws_forecast_zone`
- `shoaling_factors`, `deepwater_decay_factor`, height offset fields

Missing or incomplete metadata:

- Minimum size to work.
- Maximum reasonable/safe size.
- Closes-out-above size threshold.
- Bottom type: beach, reef, point, jetty, cobble, mixed.
- Long-period vs short-period swell handling.
- Directional shadow/blocking windows.
- Rising/falling/high/low tide sensitivity beyond broad preferred range.
- Seasonality.
- Board suitability.
- Crowd sensitivity, if represented safely.
- Local wind shelter/terrain notes as structured factors.
- Safety hazards as machine-readable flags.

Minimal schema option:

```sql
create table public.beach_break_intelligence (
  beach_id uuid primary key references public.beaches(id),
  min_workable_height_ft numeric,
  max_reasonable_height_ft numeric,
  closeout_height_ft numeric,
  bottom_type text,
  handles_long_period_swell boolean,
  handles_short_period_windswell boolean,
  ideal_period_min_s numeric,
  ideal_period_max_s numeric,
  preferred_tide_stage text[],
  bad_tide_stage text[],
  board_suitability jsonb,
  seasonality jsonb,
  local_effects jsonb,
  safety_hazards text[],
  source text not null default 'manual',
  confidence text not null default 'low',
  updated_at timestamptz not null default now()
);
```

Manual vs learned:

- Manually curate: bottom type, hazards, skill level, max safe size, local effects, blocked swell windows.
- Learn/infer: session condition clusters, user repeat behavior, board fit patterns, tide-stage completion patterns, confidence adjustment.
- Hybrid: min/max workable size and preferred period should start manual, then be validated by sessions.

San Diego first:

1. Ocean Beach Pier / Avalanche / Ocean Beach.
2. Tourmaline.
3. La Jolla Shores / Scripps / Blackies.
4. Del Mar / Ponto / Oceanside Harbor.

## Do Not Add Yet

- Direct production GFS-Wave ingestion: useful PoC, too much operational complexity for the first recommendation improvement.
- Webcam scraping: legal/terms risk and high maintenance.
- Commercial surf APIs: paid, potentially duplicative, and should be compared only after internal calibration.
- Raw HRRR/NBM ingestion: useful later for wind, but not the biggest current gap.
- Crowd proxies: privacy and interpretation risk.
- Free-text note/review mining: do not use without a privacy-safe policy and opt-in design.

## Implementation Proposal

1. Current phase: ship read-only session analysis plus conservative behavior score.
2. Next backend step: add exact instrumentation for recommendation impressions/taps, planned sessions, completions, cancellations, and alert opens.
3. Next data step: curate `beach_break_intelligence` for San Diego or fill existing `beaches` fields where they already cover the need.
4. Optional PoC: direct GFS-Wave shadow comparison for 5-10 San Diego breaks using NOMADS filtered GRIB2 subsets.
5. Cache strategy:
   - Behavior aggregates: query last 365 days on demand for candidate beach IDs, then cache per discovery request.
   - Break metadata: read with beach rows, long-lived.
   - GFS-Wave PoC: cache by cycle/grid point/forecast hour; do not write production forecast rows.
6. Backfill strategy:
   - Existing sessions and snapshots can seed behavior aggregates.
   - Existing reviews/favorites can seed confidence labels, not ranking boosts.
7. Tests:
   - Sparse-data suppression.
   - Repeat-user boost.
   - Recent activity boost.
   - High planned/low completed penalty.
   - Condition-match boost.
   - Forecast score floor prevents unsafe/bad-condition override.
8. Rollback:
   - Behavior score is isolated in `break-behavior-score.ts`.
   - Remove the orchestrator behavior block to return to prior ranking.

## External Source Notes

- NOAA/NWS API: [weather.gov API documentation](https://www.weather.gov/documentation/services-web-api)
- NWS alerts: [Alerts Web Service](https://www.weather.gov/documentation/services-web-alerts)
- NWS data use: [National Weather Service disclaimer](https://www.weather.gov/disclaimer)
- CDIP data access: [CDIP Data Access](https://cdip.ucsd.edu/m/documents/data_access.html)
- NDBC wave/spectral data: [NDBC raw spectral wave information](https://www.ndbc.noaa.gov/data_spec.shtml), [NDBC measurement descriptions](https://www.ndbc.noaa.gov/faq/measdes.shtml)
- NOAA CO-OPS APIs: [CO-OPS web services](https://tidesandcurrents.noaa.gov/web_services_info.html), [CO-OPS data API](https://api.tidesandcurrents.noaa.gov/api/prod/)
- HRRR: [NOAA HRRR](https://rapidrefresh.noaa.gov/hrrr/)
- NBM open data: [NOAA NBM AWS registry](https://registry.opendata.aws/noaa-nbm/)
- Open-Meteo Marine: [Marine Weather API](https://open-meteo.com/en/docs/marine-weather-api), [Open-Meteo terms](https://open-meteo.com/en/terms)
