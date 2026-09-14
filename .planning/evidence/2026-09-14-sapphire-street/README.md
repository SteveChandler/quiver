# Redondo Beach jetty breaks — catalog addition, 2026-09-14

Adds **Sapphire Street (Redondo Beach)** and **Knob Hill (Redondo Beach)**, the breaks on the north
and south sides of the Topaz Street jetty.

## Why

On 2026-09-11 a new native user tried to log a session and searched the spot picker for
`sap`, `sapp`, `sapphir`, then `redondo be`, `redondo beac`, `redondo beach`. All six returned
nothing (`session_spot_search_no_results`, `missed_spot_query`). She abandoned the log, then
tapped through South Bay map markers and opened Redondo Breakwall and El Porto.

Two causes:

1. **Neither jetty break is in the catalog.** Production has 495 beaches. None has a name or slug
   containing sapphire, topaz or knob.
2. **Native spot search is name-only.** `quiver-native/src/hooks/use-beach-search.ts` runs
   `ilike('name', '%query%')` after a small alias map, and no name contained "redondo beach". Web
   search also matches city, so this miss is native-only. The paired native PR aliases the full
   phrase `redondo beach` to `Redondo`, so Redondo Breakwall is returned too.

## Spot decisions

Surfline's map data for the area (`services.surfline.com/kbyg/mapview`, read 2026-09-14 through an
authenticated browser session) lists these spots:

| Spot | Surfline point | Decision |
|---|---|---|
| Redondo Breakwater | 33.85045,-118.40048 | Already catalogued as Redondo Breakwall |
| Sapphire St. | 33.83267,-118.39133 | **Added** |
| Knob Hill | 33.82895,-118.39123 | **Added** |
| Burnout Beach | 33.81589,-118.39218 | Not added. Nobody asked for it, and it sits about 375 m from the existing Torrance Beach (RAT Beach) row. It needs its own identity review. |
| Torrance Beach / RAT Beach | 33.8112 / 33.8093 | Already catalogued as one merged row |
| Haggerty's | 33.80282,-118.39989 | Out of scope (Palos Verdes Estates) |

- **Topaz Street:** no separate row. Surf-Forecast lists a "Topaz Street" break, but Surfline does
  not. Make the Trip Matter equates "Topaz Jetty" with Sapphire St., while other sources put Topaz
  on the south side. A third row would duplicate one of the two added breaks. Neither added name
  contains "topaz".
- **Avenue C:** not added. The only sources describe it as an LA County beach access point (stairs
  and ramp); no surf source lists it as a break.

## Sources (retrieved 2026-09-14)

| Source | Used for |
|---|---|
| [Surfline Sapphire St. spot guide](https://www.surfline.com/surf-report/sapphire-st-/584204214e65fad6a7709d0b/spot-guide) | W/NW swell only (the Redondo Submarine Canyon refracts long-period swell; shadowed from south swells), E/SE/ENE wind, low to medium tide, all abilities, sand bottom, access through Topaz Street, water quality poor after rain, shallow sandbars on the south side of the jetty |
| Surfline mapview (above) | Identity and reference points for both spots |
| [Surf-Forecast: Sapphire Street](https://www.surf-forecast.com/breaks/Sapphire-Street) | Beach/jetty break, rips, pollution, crowds |
| [Make the Trip Matter](https://makethetripmatter.com/redondo-beach-surf/) | Sapphire: beginners to intermediate, lesson traffic. Knob Hill: fast and steep beach break with several peaks, intermediate to advanced but manageable on smaller days, shorebreak, parking along Knob Hill Avenue and metered on the Esplanade |
| [LA County Beaches & Harbors](https://beaches.lacounty.gov/redondo-beach/) | Daylight lifeguards, Esplanade and Knob Hill stairs, restrooms/showers |
| [OpenStreetMap way 1452981257](https://www.openstreetmap.org/way/1452981257) | Jetty geometry, from 33.83194,-118.39095 (shore) to 33.83183,-118.39257 (tip) |
| Nominatim (OSM) | Sapphire St 33.83314; Topaz St 33.83121; Knob Hill Ave 33.82857 |

The Knob Hill Surfline spot guide page has no guide text, only the listing.

## Pins (Esri World Imagery, about 0.000006°/px close-ups in this folder)

- **Sapphire Street, 33.8325, -118.3918** (`sapphire-close.png`). The jetty in the imagery is at
  33.8319, which agrees with OSM. The pin is nearshore water about 70 m north of the jetty and about
  65 m off the sand, outside the whitewater. Surfline's point is at the shorebreak, about 45 m away.
- **Knob Hill, 33.8290, -118.3922** (`knobhill-close.png`). Surfline's point
  (33.82895,-118.39123) is on dry sand in the imagery. The pin moves west to nearshore water about
  45 m off the wet sand, outside the whitewater. It is about 330 m south of the jetty and about
  390 m from the Sapphire pin.
- UUIDs are `uuid5(NAMESPACE_URL, "https://quiversurf.app/beach/<slug>")`:
  - `c9ea72a3-d7bf-5f3d-b77e-1aa6cce81dee` (Sapphire)
  - `50b0ec6c-9254-5450-9b23-90cb85997cb1` (Knob Hill)

## Production preflight (read-only, public anon REST, 2026-09-14)

- 495 beaches total.
- Name/slug search for sapphire, topaz, knob or redondo returned only Redondo Breakwall.
- Neither proposed UUID is present.
- Rows within ±0.02° of the pins: Redondo Breakwall (33.849275,-118.401666) and Torrance Beach
  (RAT Beach) (33.8125,-118.3925). Both are more than 1.8 km from either pin.
- Limitation: anon reads are subject to RLS, so private or deleted rows might not be visible. The
  migration therefore repeats these checks itself and stops on a name/slug conflict, a UUID or
  coordinate conflict, or any live beach within 300 m of either pin.

## What the rows do and do not include

- Included: `beach_sources` → `open_meteo`, conservative flags (`seo_indexable`,
  `recommendation_eligible`, `terrain_enabled` all false), editorial sources, hazards/warnings.
- Not included:
  - photos: the existing fallback is used
  - cameras: Surfline cams have no rebroadcast rights
  - terrain arrays, shoaling, swell windows and tide preferences
- Forecasts for the new IDs have not been generated or checked.

## Checks (worktree `feat/add-sapphire-street-beach`, off origin/main 1f6d85953)

- PASS `python3 .planning/evidence/2026-09-14-sapphire-street/verify-migration.py`. It ran the real
  SQL on local Supabase and checked:
  - two exact rows, open_meteo sources, and both user queries matching by name
  - an idempotent re-run
  - existing rows and sources unchanged
  - the UUID/coordinate, nearby-300 m (at both pins) and name conflict guards each raise

  The local DB predates the editorial/eligibility columns, so each transaction adds them with their
  production definitions first. All writes were rolled back.
- PASS `yarn jest --runInBand __tests__/migrations/sapphire-street-redondo-beach.test.ts` (3 tests).
- PASS `npx eslint --max-warnings=0 __tests__/migrations/sapphire-street-redondo-beach.test.ts`.
- PASS trailing-whitespace scan of the new files.

## Production plan (requires `APPROVE: <sha>` per docs/MIGRATION_SAFETY.md)

1. Merge this PR to `main`.
2. Take a fresh `pg_dump` backup of `public.beaches` and `public.beach_sources`.
3. Re-run the preflight (UUID/name/slug/nearby, ledger has no `20260914160000`).
4. Apply `20260914160000_add_sapphire_street_redondo_beach.sql` with the production owner connection
   so migration tracking records it.
5. Postflight:
   - two exact rows and two `open_meteo` sources, with 0 promoted flags
   - existing rows unchanged
   - public search for "sapphire", "knob hill" and "redondo beach" returns the rows
   - after the next refresh cycle, forecasts exist for both IDs
