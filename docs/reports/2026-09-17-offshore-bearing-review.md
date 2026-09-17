# Offshore-bearing review — 2026-09-17

Status: DRAFT. No database mutation was performed. The rerun used regional Overpass bbox requests, cached each bbox response, and kept the existing per-beach cache readable. Reported-only beaches skipped geometry.

## Method

The script reads `public.beaches` through direct `POSTGRES_URL_NON_POOLING` with `PGOPTIONS='-c default_transaction_read_only=on'`. The 115 calibrated beaches were grouped into 18 lat/lon boxes. The clustering uses a 0.28° grid cell plus 0.02° padding, so every request stays below the requested 0.6° maximum span. Each box uses `[out:json][timeout:170]`, a 180-second request timeout, Kumi first, 5-second request spacing, and the existing 5/15/45-second retry backoff across the three endpoints.

Coastline ways were converted to local segment bearings; because coastline ways have land on the left and water on the right, seaward is segment bearing +90°. Geometry is required for every proposal. HIGH means coastline distance ≤400 m and aspect or swell-window center agrees with geometry seaward within 45°. MEDIUM means usable geometry within 1000 m without HIGH agreement. REVIEW means unavailable, distant, or ambiguous geometry. `CHANGE` means the shortest angular delta is at least 20°.

The machine-readable export is at `/private/tmp/claude-501/-Users-stevenchandler-Desktop-dev/b6860db2-3182-4df6-99d2-589286756ffa/scratchpad/offshore/run1/bearings.csv` and `bearings.json`.

## Counts

| Scope | HIGH | MEDIUM | REVIEW | geometry | changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Calibrated | 76 | 15 | 24 | 113 | 48 |
| Other, reported only | 0 | 0 | 350 | 0 | 0 |
| Total | 76 | 15 | 374 | 113 | 48 |

## HIGH changes

The draft migration contains 38 guarded HIGH updates. MEDIUM changes are commented out; there are 10 of them.

`52nd-street-newport-beach-ca`, `54th-street-newport-beach-ca`, `beacons`, `cardiff-reef`, `church`, `corona-del-mar`, `county-line-malibu-ca`, `crystal-pier`, `doheny-state-beach`, `d-street`, `el-porto-manhattan`, `el-segundo-beach-jetty-el-segundo-ca`, `georges`, `grandview`, `hermosa-pier`, `horseshoe`, `imperial-beach`, `jalama-beach-jalama-ca`, `k-40`, `la-jolla-shores`, `lower-trestles`, `manhattan-beach-pier-manhattan-beach-ca`, `middles`, `moonlight-state-beach`, `old-mans-sano`, `pacific-beach`, `pipes`, `river-jetties`, `san-elijo-state-beach`, `scripps`, `shipwrecks-coronado-ca`, `solana-beach`, `sunset-cliffs-garbage`, `tamarack`, `torrey-pines-state-beach`, `tourmaline`, `tourmaline-surf-park`, `upper-trestles`.

## Spot checks

| Beach | Geometry seaward | Proposed offshore | Confidence | Plain-language sanity check |
| --- | ---: | ---: | --- | --- |
| blacks | 256° | 75° | HIGH | The La Jolla coast is broadly west-facing; ENE offshore is sensible. |
| del-mar | 262° | 80° | HIGH | Del Mar is broadly west-facing; easterly offshore is sensible. |
| la-jolla-shores | 295° | 115° | HIGH | The cove turns NW/WNW; ESE offshore is consistent with that local turn. |
| scripps | 286° | 105° | HIGH | Scripps faces WNW locally; ESE offshore is sensible. |
| tourmaline | 255° | 75° | HIGH | Pacific Beach is broadly WSW-facing; ENE offshore is sensible. |
| oceanside-pier | 229° | 50° | HIGH | The pier area angles SW; NE offshore is plausible, with structures making it worth monitoring. |
| lower-trestles | 199.5° | 20° | HIGH | Lower Trestles faces roughly S/SSW; NNE offshore is sensible. |
| church | 191° | 10° | HIGH | Church faces roughly south; northerly offshore is sensible. |
| hb-cliffs | 232° | 50° | HIGH | The cliffs are broadly SSW/SW-facing; NE offshore is sensible. |
| huntington-beach-pier | 221° | 40° | HIGH | Huntington Beach Pier faces roughly SSW; NNE/NE offshore is sensible. |
| c-street-ventura-ca | 146.3° | 325° | MEDIUM | C Street faces roughly S/SSW, so NW proposed offshore conflicts with the real-coast sanity check; it remains commented out. |
| ocean-beach-sloat-san-francisco-ca | 268° | 90° | HIGH | Ocean Beach Sloat faces W; easterly offshore is exactly the expected orientation. |

## Artifacts

- Draft migration: `supabase/migrations/20260917120000_correct_offshore_bearings.sql`
- Export: `/private/tmp/claude-501/-Users-stevenchandler-Desktop-dev/b6860db2-3182-4df6-99d2-589286756ffa/scratchpad/offshore/run1/bearings.csv`
- Cache: 18 regional bbox responses plus readable legacy per-beach cache files.
