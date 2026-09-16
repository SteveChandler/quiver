# Redondo jetty breaks — release receipt, 2026-09-14

- Approved plan: `production-plan.md` (this folder). SHA256
  `bfad21b3df29eb5d44b166a86f40e089b58a98801a1afa783f2d291e5660deb9`. Approved by Steven in
  session with `APPROVE: bfad21b3…deb9`.
- Merged:
  - SteveChandler/quiver#779 → main `4feb5934cf74e38c60de6214bc86a0ce936c0ff2`
  - SteveChandler/quiver-native#343 → main `e1ab8d8d1` (native alias; ships with the next OTA,
    none published)
- Applied `supabase/migrations/20260914160000_add_sapphire_street_redondo_beach.sql`:
  - taken from origin/main, SHA256 `a483c27bfe17014f0e7e948935d33e0c9c4535228c46268fb2c55bb9c039dfd8`
    (matches the plan)
  - run at 2026-09-14T18:32:21Z as owner `postgres` (server 15.8), with psql 15.14 and
    `ON_ERROR_STOP`
  - its own transaction committed: `INSERT 0 2` beaches, `INSERT 0 2` sources, and both in-file
    guards passed
- Ledger: `20260914160000 add_sapphire_street_redondo_beach` was inserted after the commit. The
  stored statement is the exact file text minus its final newline (`$(cat)` strips it): md5
  `0f43d2cc6e0cb52d11d9c54df4bf867c` equals the md5 of the file with the trailing newline removed.
- Backup: `quiver-redondo-jetty-20260914.dump`, a pg_dump 15.14 custom archive of `beaches` and
  `beach_sources`, 522283 bytes, SHA256 `8cac5c2c…9659`. It was 115 minutes old at apply. It is kept
  in the session scratchpad, not the repo.

## Preflight, re-run immediately before apply

Everything matched the plan:
- 495 beaches and 172 sources
- `beaches_md5=9b73e6a989068d539c4aceffc4e6f2c9`, `sources_md5=6faf46597c96d26f3da18bd18d114a7f`
- ledger version absent; neither UUID present; 0 name/slug conflicts
- 0 sapphire/topaz/knob names, deleted rows included
- 0 live beaches within 1 km of either pin
- 14/14 required columns present

## Postflight: PASS

- Both rows exact: name, slug, city, lat/lon, `America/Los_Angeles`.
  - Knob Hill (Redondo Beach): 33.829,-118.3922, 5 editorial sources.
  - Sapphire Street (Redondo Beach): 33.8325,-118.3918, 7 editorial sources.
  - `seo_indexable`, `recommendation_eligible`, `terrain_enabled` and `is_private` are all false,
    and neither row is deleted.
- 2 `open_meteo` sources. Totals: 497 beaches and 174 sources.
- Existing rows unchanged: md5 over every row except the 2 new IDs equals the preflight values for
  both tables.
- Native name-only search against production (the `ilike('name', …)` path the app uses):
  - `sapphir` → Sapphire Street
  - `redondo beach` → Sapphire Street and Knob Hill
  - `knob hill` → Knob Hill
  - `Redondo` (the new alias target) → Sapphire Street, Knob Hill and Redondo Breakwall
- Web `/api/beaches/search`: scripted curl gets 403 from bot protection, as in the 2026-09-03
  release, so it was verified in a real browser:
  - "sapphire" → Sapphire Street
  - "knob hill" → Knob Hill
  - "redondo beach" → both new rows

## Detail pages and phone check (2026-09-14, about 20:10Z)

- Dev: `dev.quiversurf.app` serves preview `dpl_9etyvx1UFcRGrKJFKbZAgzPzb625`, built from main
  `1afd3d209`, which contains the #779 merge. Dev reads the same catalog:
  `/ca/redondo-beach/sapphire-street-redondo-beach-ca` renders there.
- Web at a 375×812 phone viewport, on production www and on dev: both detail pages render title,
  city, the forecast card (2–3 ft, best window 2:00–4:30 PM, primary 5.8 ft @ 10s W, tide,
  confidence 40/100), the 11-day outlook, current conditions and hourly rows. Knob Hill and
  Sapphire show identical forecast numbers; the 390 m apart pins resolve to the same model output.
- Native, iOS Simulator (iPhone 17 Pro, `app.quiversurf.mobile`), opened with
  `xcrun simctl openurl quiver://beach/<uuid>` because the dedicated simulator tool is unavailable
  in this session:
  - both detail screens render title, city, the map pin in nearshore water on the correct side of
    the jetty, and primary/secondary swell and wind
  - "Map forecast unavailable at this time" also appears on the existing Redondo Breakwall, so it
    is not specific to the new rows
- Not exercised: the native spot-picker search (it needs taps and typing, which this session
  can't do), and the alias, which is not in the installed build.

## Not yet verified

- Forecasts. `enhanced_forecasts` had 0 rows for either new ID at 18:3xZ, so they wait on the
  regular forecast crons. Check again after the next dispatch/refresh cycles.
- Detail-page rendering and on-device native appearance.
- The native alias reaches users only after an OTA.
