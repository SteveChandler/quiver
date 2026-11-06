# Surfers Beach / Princeton Jetty (El Granada) — catalog addition, 2026-11-06

Adds **Surfers Beach / Princeton Jetty (El Granada)**, the beach break at the south jetty of
Pillar Point Harbor, across Highway 1 from El Granada.

## Why

On 2026-10-28 a new native user opened the session log and searched the spot picker. Two bursts of
`session_spot_search_no_results` came back empty:

- query lengths 4, 5, 6, 8, 9, 12, 14, 15. "Princeton Jetty" has 15 characters.
- query lengths 5, 6, 8, 7, 5 about 30 s later. Telemetry stores length only; this fits "El Gr" to
  "El Grana", but that is not confirmed.

He then stopped logging. On 2026-11-06 he answered the welcome email: he wanted "the Princeton Jetty
aka Surfers Beach in El Granada". His other guess, Linda Mar, is already in the catalog and is his
home break.

Native spot search is name-only (`quiver-native/src/hooks/use-beach-search.ts`, `ilike('name', …)`
with a small alias map). So the name carries all three terms: "Surfers Beach", "Princeton Jetty"
and "El Granada". The `Pacifica / Linda Mar` row uses the same slash pattern. No native change or
OTA is needed.

## Spot decision

- One row. Mondo Surf's "Princeton Breakwater" guide describes the peak closest to the jetty and a
  quieter beach further down. That is the same stretch the other sources call Surfers Beach, and
  the user named both as one spot.
- Region `San Francisco` and timezone `America/Los_Angeles` match the nearest catalog row,
  Mavericks.

## Sources (retrieved 2026-11-06, each page read)

| Source | Used for |
|---|---|
| [Visit Half Moon Bay](https://www.visithalfmoonbay.org/places/surfers-beach/) | Directly south of Pillar Point Harbor; suits beginners and experienced surfers; rip currents and sneaker waves; several surf schools and rental shops nearby |
| [Pacific Beach Coalition](https://www.pacificbeachcoalition.org/take-action/monthly-adopt-a-beach-cleanups/surfers-beach-and-bluff/) | Starts at the South Jetty of Pillar Point Harbor, across Highway 1, near El Granada; waves reach the highway riprap at high tide; free parking on Highway 1 near the RV park and at the harbor; restrooms at the boat launch ramp |
| [Wannasurf: El Granada](http://en.wannasurf.com/spot/North_America/USA/California/SF_Marin/el_granada/) | 3 mi north of Half Moon Bay between Mirada Rd and the east breakwater; beach break, sandy bottom, rights and lefts; main peak crowds easily |
| [Mondo Surf: Princeton Breakwater](https://www.mondo.surf/surf-spot/princeton-breakwater/guide/10985) | Princeton name; peak closest to the jetty; beginners do better further down the beach; reference point 37.50068,-122.47103 |
| Esri World Imagery (`wide.png`, `close.png`) | Pin placement |
| OpenStreetMap (Overpass) | Pillar Point Harbor features; Mateo Coast State Beaches polygon starts at 37.50051,-122.46995 |

Not used: conflicting claims (Wannasurf says metered lot, Pacific Beach Coalition says free
parking; parking text keeps only the free Highway 1 and harbor parking). Not verified: the
breakwater sheltering the spot from north or northwest swell, water quality, Surfline's spot
guide (no Surfline access this run).

## Pin (Esri World Imagery, about 0.000008°/px in `close.png`)

- **37.4994, -122.4715.** Nearshore water about 185 m south of the jetty root, just outside the
  whitewater of the jetty peak. Mondo's point (37.50068,-122.47103) is at the shore by the jetty,
  about 150 m away.
- UUID `73cfa55c-0708-533b-b8c8-9af6db7bc7b2` = `uuid5(NAMESPACE_URL, "https://quiversurf.app/beach/surfers-beach-el-granada-ca")`.

## Production preflight (read-only, 2026-11-06)

- 574 live beaches.
- Only one row within about 5 km of the pin: Mavericks (37.4945,-122.5022), 2,766 m away.
- No name or slug contains princeton or granada. The only `surfers-beach` slug is Surfer's Beach,
  Aguadilla PR (slug `surfers-beach`), which does not clash with `surfers-beach-el-granada-ca`.
- The proposed UUID is not present. The latest applied migration is `20261105120000`.

## What the row does and does not include

- Included: `beach_sources` → `open_meteo`, conservative flags (`seo_indexable`,
  `recommendation_eligible`, `terrain_enabled` all false), editorial sources, hazards and warnings.
- Not included: photos (fallback is used), cameras, terrain arrays, shoaling, swell windows, tide
  preferences. Forecasts for the new ID are not generated or checked yet.

## Checks (worktree `feat/surfers-beach-el-granada`, off origin/main af9064bcb)

- PASS `python3 verify-migration.py <url>` on a throwaway Postgres 15 loaded with the production
  `beaches` and `beach_sources` schema and all their rows (574 beaches, 251 sources; the PostGIS
  `geog` column, policies and triggers stripped). It checked:
  - one exact row, its `open_meteo` source, and all three user terms matching by name
  - exactly one new beach, and an idempotent re-run
  - existing rows and sources unchanged
  - the UUID/coordinate, nearby 300 m and slug conflict guards each raise

  All writes were rolled back, and the throwaway database was stopped.
- PASS `yarn jest --runInBand __tests__/migrations/surfers-beach-el-granada.test.ts` (2 tests).
- PASS `npx eslint --max-warnings=0 __tests__/migrations/surfers-beach-el-granada.test.ts`.

## Production plan (requires `APPROVE: <sha>` per docs/MIGRATION_SAFETY.md)

1. Merge this PR to `main`.
2. Take a fresh `pg_dump` backup of `public.beaches` and `public.beach_sources`.
3. Re-run the preflight (UUID, name, slug, nearby; ledger has no `20261106180000`).
4. Apply `20261106180000_add_surfers_beach_el_granada.sql` with the production owner connection so
   migration tracking records it.
5. Postflight:
   - one exact row and one `open_meteo` source, with 0 promoted flags
   - existing rows unchanged
   - public search for "princeton jetty", "surfers beach" and "el granada" returns the row
   - after the next refresh cycle, a forecast exists for the ID
6. Reply to the user on his welcome thread that the spot is live.
