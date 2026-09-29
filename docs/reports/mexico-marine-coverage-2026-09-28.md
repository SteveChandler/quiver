# Mexico marine coverage research — September 28, 2026

## Recommendation

Reuse the real, unmodified Open-Meteo wave inputs already ingested by Quiver before adding another provider. This is a proposed follow-up, not an implemented or validated hazard model. Keep modeled forecasts distinct from buoy observations and keep incomplete hazard coverage visible.

Read-only production checks on September 29 UTC / September 28 PDT found:

| Region | Current public beaches | Beaches with recently updated raw wave height + period in the next 24 hours | Beaches with any tide rows in the next 24 hours |
| --- | ---: | ---: | ---: |
| Baja California | 68 | 68 | 47 |
| Baja California Sur | 45 | 45 | 16 |
| Total | 113 | 113 | 63 |

The original September 27 investigation used an earlier inventory (107 Mexican beaches) and identified 84 with no marine-cache rows. Inventory has since expanded. The newer figures above count positive raw periods, nonnegative raw heights and `updated_at` within 12 hours; they do not establish provider initialization time, complete daily slots, or beach-level accuracy. Tide counts establish presence only, not the complete local-day coverage required by Seaside.

## Why Mexico is failing the current pipeline

The marine refresh writes buoy observations, their short persistence projections, and NWS wind. Many Mexican beaches have no supported buoy within the 80 km radius. Increasing that radius is not a sound substitute for local representativeness.

The enhanced forecast pipeline already calls Open-Meteo Marine and persists raw `wave_height_om`, `wave_period_om`, and direction values. Seaside's derived rip-risk path reads `marine_forecasts` and `tide_forecasts`, not those raw fields. Consequently data exists for surf forecasting without satisfying the separate hazard-input contract.

There are two additional blockers to simple reuse:

- `wave_period_om` is mean period; the hazard function's `tp_s` convention expects peak period. The parser has `wave_peak_period_om` internally, but the inspected enhanced-forecast table does not expose that column. Preserve the real peak-period value/provenance or validate an explicitly different hazard formula; do not silently substitute mean period or a synthetic fallback.
- 50 of 113 beaches have no upcoming tide rows, and the remaining 63 still need a full local-day coverage check. The current hazard path requires tide support.

## Options

| Option | Fit | Tradeoff |
| --- | --- | --- |
| Existing Open-Meteo ingestion | First choice: already stores real wave data for all 113 beaches | Needs a modeled-input contract, peak-period provenance and tide coverage. Reuse existing ingestion/caches instead of issuing duplicate per-beach requests. |
| Direct NOAA GFS-Wave | Global model; Quiver already contains a GFS-wave shadow path | GRIB extraction, spatial selection, run freshness and operational ownership add work. A candidate if independence from Open-Meteo becomes necessary. |
| Copernicus global waves | Global 0.083° model with wave/swell partitions | A separate integration and access workflow. Research option; no local ingestion or live sample validated. |

Open-Meteo supports global wave forecasts, multiple coordinates and sea-cell selection. Its marine API also provides modeled sea level including tides; its documentation cautions that coastal tide accuracy is limited. Tide suitability for a safety-related beach hazard estimate needs representative validation before use.

The inspected Open-Meteo client uses the public endpoint. Official pricing reserves commercial API use for a subscription; account entitlement was not inspected. Confirm the intended customer endpoint/licensing before expanding use. No paid API, purchase or account change was made.

## Smallest next implementation

1. Reuse existing raw model ingestion while preserving the provider, model/run timestamp, valid time, units, peak period and `is_observed=false` distinction.
2. Validate usable wave and tide slots for representative Pacific Baja, southern Baja and Gulf-facing beaches. Do not shift every Mexican coordinate west: the coast orientation varies.
3. Evaluate the modeled hazard estimate against an accepted reference and retain `unavailable` where inputs/validation are insufficient. Never turn missing data into low risk.
4. Only then add an explicit derived-risk fallback for uncovered beaches; do not weaken the observed-buoy coverage check to hide the gap.

## Sources and local evidence

- [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api)
- [Open-Meteo pricing and commercial endpoint](https://open-meteo.com/en/pricing)
- [NOAA NOMADS operational models](https://nomads.ncep.noaa.gov/)
- [Copernicus global wave product](https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027/description)
- Web: `lib/services/noaa-wavewatch/api-client.ts`, `data-processors.ts`, `lib/services/forecast/forecast-builder.ts`.
- Deployed Seaside revision `b6e1562`: `crons/fetch_rip_current_risk.py`, `_prepare_derived_risk_rows`.

Research only: Mexico ingestion, risk formulas and production rows were not changed.
