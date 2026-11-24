# Bolsa Chica State Beach — catalog addition, 2026-10-31

Adds **Bolsa Chica State Beach** (Huntington Beach, Orange County) as a searchable catalog row.

## Why

Users look for Bolsa Chica and find nothing:

- Three users made their own custom spots for it: "Bolsa Chica Tower 21" (twice) and
  "Bolsa chica state beach surf point".
- One user tapped "missing spot" after searching `bolsa chica state beach`.

Two causes:

1. **It is not in the catalog.** Production has 573 beaches. No name or slug contains "bolsa". The
   nearest rows are HB Cliffs (33.6908,-118.0451) to the south and Seal Beach Pier
   (33.737726,-118.107552) to the north. Nothing sits between them.
2. **Native spot search is name-only.** `quiver-native/src/hooks/use-beach-search.ts` matches
   `name` with `ilike`, so the row name has to contain the words people type. "Bolsa Chica State
   Beach" contains both `bolsa chica` and `bolsa chica state beach`.

## Row

| Field | Value | Basis |
|---|---|---|
| id | `dd21a212-1f15-5b34-8749-8d54c44f3b25` | `uuid5(NAMESPACE_URL, "https://quiversurf.app/beach/bolsa-chica-state-beach-huntington-beach-ca")` |
| name | Bolsa Chica State Beach | Official park name (California State Parks) |
| slug | `bolsa-chica-state-beach-huntington-beach-ca` | Same pattern as `sapphire-street-redondo-beach-ca` |
| city / state / country | Huntington Beach / CA / USA | |
| region | `Orange County` | Queried: every Huntington Beach row in production (Huntington State Beach, Huntington St., the three pier rows, Goldenwest, HB Cliffs) uses `Orange County`, as does Seal Beach Pier. `region_id` is null on all of them, so it is left null here too. |
| timezone | America/Los_Angeles | |
| break_type | beach | |
| lat, lon | 33.6970, -118.0521 | See "Pin" |
| flags | `seo_indexable`, `recommendation_eligible`, `terrain_enabled`, `is_private` all false | Same as the precedent |

## Pin (OSM + Esri World Imagery, about 0.000006°/px close-up in this folder)

The pin is in nearshore water off **Tower 21**, the stretch users named in their custom spots.

- OSM lifeguard towers along the beach run from ref 16 (33.6850) in the south to ref 28 (33.7112)
  in the north. **Tower 21** is OSM node
  [11836050631](https://www.openstreetmap.org/node/11836050631) at 33.6978386,-118.0508078. It
  sits between towers 20 and 22, about 150 m north-west of the main beach access road and lifeguard
  HQ (OSM node 708503504).
- The park runs from Seapoint Avenue (about 33.683) to Warner Avenue (about 33.714), so Tower 21
  is close to mid-beach.
- OSM coastline way [157341965](https://www.openstreetmap.org/way/157341965) runs at a bearing of
  about 142° here. Its seaward normal is about 232°. The coastline foot opposite Tower 21 is at
  33.69755,-118.05125, about 52 m from the tower.
- **Pin 33.6970, -118.0521** is about 100 m along that normal past the coastline foot and about
  150 m from Tower 21. In `bolsa-chica-close.png` (red circle = pin, yellow = Tower 21) it is
  nearshore water just outside the outer whitewater line. The imagery shows a large swell day, so on
  normal days the pin is outside the breaking waves.
- Esri export used:
  `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-118.0545%2C33.6955%2C-118.0485%2C33.7005&bboxSR=4326&imageSR=4326&size=1000%2C833&format=png&f=image`.
  `bolsa-chica-wide.png` is the same view over a wider bbox (-118.0560,33.6940 to -118.0470,33.7015).
- Wannasurf and Mondo Surf list the spot at 33.696633,-118.049467. In the imagery that point is on
  the sand by the main lot, about 250 m from the pin, so it was not used.
- Distances from the pin: HB Cliffs 947 m, Goldenwest 3.9 km, Seal Beach Pier 6.9 km.
- **No competitor coordinate cross-check.** The precedent used Surfline's mapview through an
  authenticated browser. This run could not fetch it, so the pin rests on OSM and imagery only.

## Sources (retrieved 2026-10-31)

| Source | Used for |
|---|---|
| [California State Parks: Bolsa Chica SB](https://www.parks.ca.gov/?page_id=642) | Three miles from Warner Avenue to Seapoint Avenue along PCH; consistent surf; lifeguards patrol year-round, towers staffed about Memorial Day weekend to Labor Day weekend; per-vehicle day-use fee, cashless; open 6 AM–10 PM, gates close 9 PM; restrooms, outdoor showers, about 200 fire rings; no dogs on the sand |
| [Surf-Forecast: Bolsa Chica](https://www.surf-forecast.com/breaks/Bolsa-Chica) | Sheltered beach break, lefts and rights, SW swell ideal, NE offshore, closes out when bigger, sometimes crowded and busy in summer, "rips, locals and pollution" |
| [Wannasurf: Bolsa Chica](https://en.wannasurf.com/spot/North_America/USA/California/Orange_County/bolsa_chica/) | Beach break, sandy bottom, mid tide, all surfers, crowded weekends, mostly a cruising longboard wave |
| [Mondo Surf: Bolsa Chica](https://www.mondo.surf/surf-spot/bolsa-chica/guide/10863) | A-frame peaks that shift with the sandbars, SW groundswell with NE offshore, medium tide, closes out once bigger, coordinate reference (see Pin) |
| [Surf School: Huntington Beach surf spots](https://www.surfschool.net/blog/huntington-beaches-surf-spots) | Gentle break, outside waves break slowly, beginner-friendly; no black ball, so surfing is allowed all day |
| [OC Health Care Agency: ocbeachinfo.com](https://ocbeachinfo.com/) | Avoid water near storm drains, creeks and rivers and runoff on the sand (the "poor water quality after rain" hazard) |
| OSM node 11836050631, way 157341965 | Tower 21 location, coastline geometry |
| Esri World Imagery (above) | Pin check |

Not used in copy:

- Tower numbers from Wannasurf/Mondo ("park between lifeguard stands 16 and 17, north of the snack
  bar"). They conflict with current OSM numbering, where 16 and 17 are near the south end.
- Season: Surf-Forecast says summer and Mondo says winter, so the copy names neither.
- Exact fee amounts, which change. The copy says "paid day-use parking (cashless)".
- Free street parking inland of PCH appeared only in a search snippet, not a fetched page.

Description and access tips name no competitor apps. `editorial_sources` cites competitor URLs, as
the precedent does.

## Production preflight (read-only, Supabase MCP `execute_sql`, 2026-10-31)

- 573 beaches total.
- Name/slug search for `bolsa` or `tower 21`: none.
- UUID `dd21a212-…` not present. Name `bolsa chica state beach` and the slug not present.
- Every beach within 2 km of the pin, including private and deleted rows: only HB Cliffs, at 947 m.
  Rows in the bbox 33.66–33.76, -118.14 to -118.00 are the seven Huntington Beach rows and Seal
  Beach Pier; none is private. One private row exists in the whole table, and it is not near the
  pin. The users' custom Bolsa Chica spots are not in `public.beaches`, so they do not trip the
  300 m guard.
- `supabase_migrations.schema_migrations` latest version is `20261031200000`;
  `20261031210000` is free.
- Re-run these checks right before applying. The migration also repeats them itself and stops on a
  name/slug conflict, a UUID or coordinate conflict, or any live beach within 300 m (private rows
  included).

## What the row does and does not include

- Included: `beach_sources` → `open_meteo`, conservative flags, editorial sources,
  hazards/warnings (rip currents, closeouts on bigger swells, summer crowds, poor water quality after
  rain).
- Not included: photos (the existing fallback is used), cameras, terrain arrays, shoaling, swell
  windows, tide preferences, `region_id`, CDIP/MOP fields.
- Forecasts for the new ID have not been generated or checked.

## Checks (worktree branch `feat/add-bolsa-chica-beach`, off origin/main 2145e1871)

- PASS `python3 .planning/evidence/2026-10-31-bolsa-chica/verify-migration.py`. It ran the real
  SQL on local Supabase (127.0.0.1:54322) and checked:
  - one exact conservative row, its `open_meteo` source, and both user queries matching by name
  - an idempotent re-run
  - existing rows and sources unchanged
  - the UUID/coordinate, nearby-300 m and name conflict guards each raise

  The local DB lacks `recommendation_eligible`, so each transaction adds it (and the other
  editorial columns if missing) with the production definitions first. All writes were rolled back.
- PASS `jest --runInBand __tests__/migrations/bolsa-chica-state-beach.test.ts
  __tests__/migrations/sapphire-street-redondo-beach.test.ts` (6 tests; dummy Supabase env vars,
  since the tests only read the SQL file).
- PASS `eslint --max-warnings=0 __tests__/migrations/bolsa-chica-state-beach.test.ts`.
- PASS trailing-whitespace scan of the new files.

## Production plan (requires `APPROVE: <sha>` per docs/MIGRATION_SAFETY.md)

1. Merge this PR to `main`.
2. Take a fresh `pg_dump` backup of `public.beaches` and `public.beach_sources`.
3. Re-run the preflight (UUID/name/slug/nearby, ledger has no `20261031210000`).
4. Apply `20261031210000_add_bolsa_chica_state_beach.sql` with the production owner connection
   so migration tracking records it.
5. Postflight:
   - one exact row and one `open_meteo` source, with 0 promoted flags
   - existing rows unchanged
   - public and native search for "bolsa chica" returns the row
   - after the next refresh cycle, forecasts exist for the ID
