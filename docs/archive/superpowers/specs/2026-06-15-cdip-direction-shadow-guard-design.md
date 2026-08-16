# CDIP Direction-Aware Shadow Guard — Design Spec

**Date:** 2026-06-15
**Status:** Approved (design), pending implementation plan
**Related:** PR #321 (held as draft until this ships), `docs/archive/superpowers/plans/2026-06-15-cdip-fallback-calibration-loss.md`

## Problem

On the CDIP source, Quiver's wave-height transform short-circuits to `face = raw_CDIP_Hs × period_bucket` with **no direction/shadow term**. The period bucket is direction-blind by construction (one value per period band, fit as `surfline_face_ft / cdip_hs_ft`). So when a south swell arrives at a beach that's heavily shadowed from the south — Point-Loma-blocked breaks like **Ocean Beach Pier** — the displayed face tracks the full offshore buoy Hs and **over-reads**.

Live example (2026-06-16 00:00 UTC, 16s SSW groundswell): OB Pier displays **4.5 ft** (raw CDIP-220 Hs 4.30 × bucket 1.04) vs offshore buoy Hs 3.74 ft vs real-world ~**2–3 ft**. The Point Loma shadow is modeled on the *model/OpenMeteo* path (via `swell_access_factors`, SSW access ≈ 0.008) but **not** on the CDIP path.

This is the inverse of the under-read fixed in the CDIP-fallback work, and that fix (widening the CDIP nowcast horizon) makes south-shadowed beaches sit on this over-reading CDIP path for *more* hours — which is why PR #321 is held until this lands.

## Goal

Make the CDIP calibrated path read **real-world truth** at south-shadowed breaks (below Surfline where Surfline doesn't model the shadow), **without regressing** west-facing in-window calibrated beaches (Blacks, Cottons) or OB's own in-window swells.

## Decision summary (research-backed)

Three independent evidence streams (coastal-engineering physics, commercial-product practice, live fleet/ground-truth data) converged on **Approach A, gated**:

- **Rejected B** (decomposed per-CDIP-partition): the CDIP parser (`lib/services/cdip/data-parser.ts`) **never populates** `primarySwell/secondarySwell` — confirmed in source. B has no data; it degrades to the scalar path anyway. Not viable.
- **Rejected C** (cap by model-path face): couples two pipelines and re-imports OpenMeteo's missing-groundswell error (would clamp OB to OM's ~1.1 ft).
- **Chosen A-gated:** multiply the calibrated short-circuit result by a floored direction factor, fired **only when the incident swell direction is outside the beach's swell window**.

### Why the floor (0.6) is physically correct
Diffraction coefficient at a shadow boundary is ~0.5–0.7 for real **directional/irregular** seas — energy in a geometric shadow bottoms out around 0.3–0.6 of incident, **never zero**. The existing `terrainAccessFactor = 0.6 + √access·0.4` floor (0.6) *is* that diffraction/directional-spreading floor. The unfloored `directObservationFloorAccessFactor = √access` (→ 0.09 → 0.4 ft at OB) is non-physical and over-corrects — **must not be reused**.

### Why the gate is load-bearing (not optional)
An *unconditional* `terrainAccessFactor` would mis-fire on legitimate in-window swells:
- OB Pier's own window-center access is only **0.74** → unconditional would cut OB ~13% on its in-window WNW swells.
- Blacks at WNW can bin-read as low as **0.11** → unconditional would falsely chop Blacks ~26%.

Gating to **out-of-window only** (in-window → factor = 1.0) eliminates this and is also the **double-counting guard**: the Surfline-fit bucket was calibrated at the beach's in-window incident direction, so a factor that is exactly 1.0 in-window never touches the calibrated direction — it only bites off-window directions the bucket never saw and cannot represent. (`swell_access_factors` is confirmed pure geometric line-of-sight in `scripts/terrain/swell-access.ts`, so it carries no physics that would double-count the bucket.)

### Chosen floor: 0.6
Owner decision. Floor 0.6 lands OB ~2.9 ft (top of the "2–3 at best" band), reuses `terrainAccessFactor` unchanged, and **never under-calls** (the safe direction). Measured shadow is ~0.57 (would be floor ~0.5 → OB ~2.4); we deliberately take the conservative top-of-band floor and can tune down later if it reads hot.

## Mechanism

In `lib/utils/wave-height-transformer.ts`, inside `transformToFaceHeightWithMetadata`'s **calibrated short-circuit** (the branch that today returns `{ faceHeightFt: Math.round(rawHeightFt * bucketFactor * 10) / 10, isCalibrated: true }`), fold in a gated direction factor **before** rounding:

```
faceHeightFt = Math.round(rawHeightFt * bucketFactor * dirFactor * 10) / 10
```

where `dirFactor` comes from a new pure helper:

```
calibratedShadowFactor(swellDirectionDeg, beach):
  // No-op unless we have a window, a direction, and terrain access.
  if swellDirectionDeg is null/non-finite        -> return 1.0
  if beach.swell_window_center_deg == null
     OR beach.swell_window_halfwidth_deg == null  -> return 1.0
  // Short-arc angular distance to window center, normalized to [0,180].
  distance = shortArcDelta(swellDirectionDeg, center)
  if distance <= halfwidth                        -> return 1.0   // in-window: untouched
  if no valid swell_access_factors (len != TERRAIN_BINS) -> return 1.0
  access = clamp(swell_access_factors[toBin5(swellDirectionDeg)], 0, 1)
  return terrainAccessFactor(access)              // 0.6 + sqrt(access)*0.4
```

Reuse existing helpers: `toBin5`, `terrainAccessFactor`, `TERRAIN_BINS`, and the short-arc delta math already used by `alignmentFactor`.

**Coverage:** the CDIP path reaches this short-circuit via `transformToFaceHeightDecomposed` → (components all null) → `transformToFaceHeightWithMetadata`. The scalar scoring/discovery path (`toFaceHeightFeet`) reaches it directly. A single insertion in `transformToFaceHeightWithMetadata` therefore covers **both display and scoring**, keeping them consistent. It only fires inside the calibrated short-circuit, so it is inherently scoped to `cdip_sig` (and the synthetic CDIP nowcast anchor) — model/OpenMeteo paths are untouched.

## Components / boundaries

- **`calibratedShadowFactor(swellDirectionDeg, beach)`** — new pure, exported, unit-tested function. Input: a direction + a `BeachTerrainConfig`. Output: a multiplier in `[0.6, 1.0]` (or exactly `1.0` for in-window / missing data). Depends only on existing helpers. This is the whole new surface.
- **`transformToFaceHeightWithMetadata`** — one-line change: multiply the short-circuit face by `calibratedShadowFactor(...)`.
- No changes to `forecast-builder.ts`, the decomposed path, the model path, `swell_access_factors`, or any data pipeline.

## Regression safety (provable, not just empirical)

- In-window swells return `1.0` by the gate → byte-identical output. Blacks (incident W/WNW access 1.0, in-window) and Cottons (incident S in-window) are unchanged.
- `terrainAccessFactor(1.0) = 1.0`, so even a hypothetical full-access out-of-window swell is unchanged.
- Verified live: 6 south-shadowed beaches land 2.0–2.9 ft; Blacks/Cottons unchanged.

## Blast radius

87 calibrated CDIP beaches → 13 south-shadowed (mean S/SSW access < 0.1) → 4 on CDIP now → **3 firing** (OB Pier, Ocean Beach, Avalanche — all station-220 Point Loma breaks on the same 16s SSW swell). Self-limiting: only bites when a beach is on CDIP **and** its dominant swell is in a low-access out-of-window bin.

## Explicitly out of scope (deferred to a v2)

These are real but separable refinements; ship the gated flat-floor first:
1. **Cosine/Gaussian taper across the window edge** — physics prefers a smooth roll-off over the hard in/out step (avoids a small face discontinuity for swells crossing the boundary).
2. **Period-aware floor** — 15–17s groundswell wraps farther than 8–10s; could raise the floor for long periods.
3. **Windswell strip** — the combined CDIP Hs still folds in the 5s windswell; a ≥8s windsea de-rate on the Hs *before* the direction factor would remove it. (B's only real advantage, now moot since B has no data.)
4. **Floor 0.6 → 0.5 tune** — drop to centered if 0.6 reads hot against real reports.

## Testing / validation

**Unit (TDD):**
- `calibratedShadowFactor`: in-window → 1.0; out-of-window low access (OB SSW 202°, access 0.008) → ~0.636; full access out-of-window → 1.0; null direction / null window / wrong-length access array → 1.0; window-edge boundary (distance == halfwidth) → 1.0 (inclusive in-window).
- `transformToFaceHeightWithMetadata`: OB Pier params (raw 4.30, bucket ~1.04, SSW out-of-window, access 0.008, source `cdip_sig`) → ~2.84 ft; Blacks params (WNW in-window, access 1.0) → byte-identical to pre-change.

**Integration / regression:**
- Replay last 7 days of CDIP-source `enhanced_forecasts` for Blacks + Cottons through the new code; assert max |Δ| < 0.1 ft (in-window ⇒ no-op).
- Fleet sweep: for the 13 south-shadowed beaches, when on CDIP + south swell, assert new face ∈ [model_path × 0.9, offshore × 0.75] and never < model_path × 0.8.

**Live (post-deploy, prod — cron-gated):**
- Re-run the OB trace: OB Pier / Ocean Beach / Avalanche move into 2–3 ft; Mondos (WNW-dominant, station 179) unchanged.
- Ground-truth join on `ml_predictions_log` (`predicted_at` hour join, `observed_m > 0`): new face sits between offshore (`observed_m × 3.28`) and model-path, closer to model-path. **Do not** validate against `v5_shadow_height_m` (it over-reads the shadow).

## Ship sequencing

1. Land this guard on `main` (feature branch → main → dev verify).
2. Re-do / refresh the prod promotion so #321's CDIP horizon-widen **and** this guard go to prod together (or stack the guard onto the #321 branch). The horizon-widen must not reach prod without this guard, or south-shadowed over-reads get *more* frequent.
3. Un-draft and merge.
