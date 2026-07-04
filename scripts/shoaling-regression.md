# Shoaling Regression Suite (Workstream D)

Validates the 2026-04-09 shoaling decomposition + small-wave ceiling fix.
Six gates (A–F) with A–D/F blocking CI and E advisory-only.

## How to run

```bash
# Default (fixture mode, CI-safe, offline)
yarn regression:shoaling

# Live mode: requires .env.local with NEXT_PUBLIC_SUPABASE_URL pointing to
# dev/localhost and SUPABASE_SERVICE_ROLE_KEY. SELECT-only. Falls back to
# fixtures if the env is missing or the URL looks like production.
yarn regression:shoaling --live

# Skip Gate E (Surfline advisory; useful on offline CI)
yarn regression:shoaling --no-e2e
```

Exit codes:

| Code | Meaning |
|-----:|---------|
|    0 | All blocking gates (A–D/F) passed |
|    1 | One or more blocking gates failed |
|    2 | Fatal error (fixtures missing, syntax error, etc.) |

## Gates

### Gate A — clean-day well-exposed beaches unchanged (≤5% delta)

**Set:** Lower Trestles, Blacks, Rincon, Malibu First Point
**Check:** `|new_face - old_face| / old_face ≤ 5%`
**Failure signal:** the decomposition math over-corrects calibrated beaches
on clean single-dominant-swell days.

Each fixture has a single dominant `swell_1` component matching the combined
`wave_height`/`wave_period`, so the legacy scalar path and the new per-
component decomposed path should produce near-identical numbers.

### Gate B — protected PB reefs drop 30–70%

**Set:** Tourmaline Beach, Tourmaline Surf Park, Windansea
**Check:** delta in `[-70%, -30%]`
**Failure signal:** the fix didn't land.

Fixtures encode the 2026-04-09 bimodal reading that triggered the fix:

- 1 ft 14 s groundswell aligned to each beach's window
- 2.5 ft 7 s wind-swell that should contribute **zero** face height after
  the fix because of the 8 s short-period cutoff

### Gate C — wind-swell beaches near-neutral (`-20%` to `+10%`)

**Set:** HB Pier Southside, The Wedge
**Check:** delta in `[-20%, +10%]`
**Failure signal:** short-period cutoff over-zeros legitimate wind-swell
spots. Both fixtures use swell periods just above the 8 s cutoff (9–10 s).

### Gate D — uncalibrated beaches byte-identical to legacy

**Set:** HB Pier, HB Pier Northside, Crystal Cove
(uncalibrated → `shoaling_factors IS NULL`)
**Check:** `|new_face - old_face| < 0.01` AND `result.path === 'legacy'`
**Failure signal:** refactor accidentally changed the scalar transform.

Each fixture sets all swell components to `null`, forcing
`transformToFaceHeightDecomposed` through its legacy fallback branch.

### Gate E — Surfline parity (ADVISORY)

**Set:** Tourmaline, Blacks, Lower Trestles, Swami's, HB Pier Southside,
The Wedge
**Check:** reports `delta = (new_face - surfline_face) / surfline_face`
per beach; never fails the suite.
**Failure handling:** network errors, non-200 responses, and schema changes
are caught and logged as `Skipped.` notes.

Hits Surfline's undocumented LOTUS JSON endpoint:

```
GET https://services.surfline.com/kbyg/spots/forecasts/wave
    ?spotId=<id>&days=1&intervalHours=1&units[waveHeight]=FT
```

No token is used. If the endpoint is ever gated behind auth, Gate E will
degrade gracefully — it is deliberately best-effort.

### Gate F — CDIP→model handoff boundary default-off invariant + enabled blend

**Set:** Lower Trestles CDIP→NOAA_NWS handoff fixture
**Check:** with the blend flag off, the first model slot remains byte-identical;
with the blend flag on, the first model slot moves toward the last CDIP face
height through the bounded 48h taper.
**Failure signal:** the handoff instrumentation changed default behavior, or the
enabled blend no longer improves the discontinuity at the CDIP/model seam.

## Fixtures

Hand-curated snapshots at
`scripts/__fixtures__/shoaling-regression-fixtures.json`.
Beach IDs and swell windows come from two production migrations:

- `quiver/supabase/migrations/20260211120000_comprehensive_swell_window_fix.sql`
- `quiver/supabase/migrations/20260407134519_add_shoaling_factors_to_beaches.sql`

The canonical Tourmaline canary values (1 ft 14 s SSW + 2.5 ft 7 s W) are
the bimodal reading observed at ~21:00 UTC on 2026-04-09 that displayed as
"3–5 ft / 9.3/10" on Quiver vs "1–2 ft / POOR" on Surfline LOTUS.

## Live mode safety

The `--live` flag is SELECT-only and guarded two ways:

1. `.env.local` must set `NEXT_PUBLIC_SUPABASE_URL`; if the URL does not
   contain `dev` / `localhost` / `127.0.0.1` the script refuses to connect
   and falls back to fixture mode.
2. No write/delete/DDL SQL is ever issued.

Live row ingestion into the gate comparison is **not wired** in this
initial cut — the script prints a warning and still runs fixture-based
pass/fail. Fixture mode is the source of truth for CI.

## Adding a new beach to a gate

1. Add the beach under `beaches` in the fixtures JSON with its real ID,
   real swell window, and real (or null) `shoaling_factors` snapshot from
   the migration file.
2. Add the slug to the relevant `gates.<letter>` array.
3. Re-run `yarn regression:shoaling` and confirm the gate still passes.

If a new beach would fail a gate because its window math differs from the
existing fixtures, prefer adjusting the forecast values rather than
loosening the gate bounds. The gate bounds are intentionally tight.
