# Offshore-bearing review — 2026-09-17

Status: DRAFT. No database mutation was performed. The requested Overpass rerun was started with the existing cache, but public endpoints timed out across the rotated retry set and the run was stopped after the first uncached beaches. Cached responses were retained; uncached beaches are REVIEW with no proposal.

## Method

The script reads `public.beaches` through direct `POSTGRES_URL_NON_POOLING` with `PGOPTIONS='-c default_transaction_read_only=on'`. It uses a 60-second Overpass request timeout, 2-second request spacing, three retries with 5/15/45-second exponential backoff, `Retry-After`, endpoint rotation, on-disk caching, and stderr progress logging.

Geometry is required for every proposal. HIGH means coastline distance ≤400 m and aspect or swell-window center agrees with geometry seaward within 45°. MEDIUM means geometry is available within 1000 m but does not meet HIGH. REVIEW means no usable geometry or an ambiguous nearby coastline; no proposal is produced. Two coastline segments within 150 m differing by more than 60° are marked ambiguous.

The partial evidence export is at `/private/tmp/claude-501/-Users-stevenchandler-Desktop-dev/b6860db2-3182-4df6-99d2-589286756ffa/scratchpad/offshore/run1/bearings.csv` and `bearings.json`.

## Counts

| Scope | HIGH | MEDIUM | REVIEW | geometry | changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Calibrated | 3 | 1 | 111 | 7 | 2 |
| Other, reported only | 0 | 0 | 350 | 0 | 0 |
| Total | 3 | 1 | 461 | 7 | 2 |

## HIGH changes

| Beach | Current | Geometry seaward | Proposed offshore | Reason |
| --- | ---: | ---: | ---: | --- |
| 52nd Street Newport Beach | 90° | 238.5° | 60° | 117.7 m from coastline; aspect 260° agrees within 45°. |
| Cardiff Reef | 90° | 243.5° | 65° | 23.2 m from coastline; swell center 280° agrees within 45°. |

The migration contains only these two guarded HIGH updates. MEDIUM `204s` is commented out.

## Spot checks

| Beach | Geometry seaward | Proposed offshore | Confidence | Plain-language sanity check |
| --- | ---: | ---: | --- | --- |
| blacks | — | — | REVIEW | West-facing La Jolla coast would generally imply easterly offshore wind, but this run has no geometry. |
| del-mar | — | — | REVIEW | Del Mar is broadly west-facing and the current 90° is plausible; no geometry-backed proposal. |
| la-jolla-shores | — | — | REVIEW | The cove can vary toward NW/WNW; aspect-only correction is intentionally withheld. |
| scripps | — | — | REVIEW | Broadly west-facing coast makes 90° plausible, but geometry is unavailable. |
| tourmaline | — | — | REVIEW | Pacific Beach is broadly west-facing; swell disagreement and missing geometry prevent a proposal. |
| oceanside-pier | — | — | REVIEW | The pier area is broadly west-facing but structures make the nearest coast sensitive; no geometry. |
| lower-trestles | — | — | REVIEW | San Onofre shoreline orientation varies locally; no geometry-backed call. |
| church | — | — | REVIEW | Cove orientation cannot be inferred safely from the stored weak sources. |
| hb-cliffs | — | — | REVIEW | The coast is broadly southwest-facing, but no geometry was available. |
| huntington-beach-pier | — | — | REVIEW | Stored aspect is inconsistent with the known SSW coast; no proposal. |
| c-street-ventura-ca | — | — | REVIEW | Ventura Point is roughly S/SSW-facing, so the stored 45° remains plausible; the old 80° aspect-only proposal is rejected. |
| ocean-beach-sloat-san-francisco-ca | — | — | REVIEW | Ocean Beach Sloat is broadly west-facing and current 90° is plausible; geometry is unavailable. |

## Cached geometry notes

Seven cached beaches had geometry: `204s`, `52nd-street-newport-beach-ca`, `agate-street`, `big-rock-la-jolla-ca`, `birdrock`, `cardiff-reef`, and `carlsbad-state-beach`. `agate-street`, `big-rock-la-jolla-ca`, and `birdrock` were marked REVIEW because nearby coastline segments were ambiguous.
