# Scoped Decay-Off Behind a Flag — Design

Date: 2026-06-26
Status: approved design, pending implementation plan
Scope: Quiver web (forecast display transform). No Seaside, no migration, no DB writes.

## Objective

The deepwater-decay multiplier (`beach.deepwater_decay_factor`, e.g. 0.4–0.7) is applied to
`model_swell`-sourced forecasts and systematically over-shrinks the displayed surf height on
sheltered beaches. The 2026-06-26 truth-scored replay
(`quiver/.planning/forecast-replay-truth-2026-06-26.md`) measured four transform levers against
real observations and found **decay-off** (`V1`) is the only safe transform-lever improvement.

Ship decay-off **behind a default-off flag, scoped to a validated allowlist of mid-decay
(0.5–0.8) beaches**, starting with `malibu-first-point-surfrider`.

## Evidence and constraints (from the replay)

- decay-off (V1) obs MAE 0.388 vs current (V0) 0.414 overall; in the 0.5–0.8 decay bucket it
  improves materially (0.586 → 0.356). `malibu-first-point-surfrider`: 0.425 → 0.150, zero overshoot.
- **decouple-buckets (V2) is rejected** — it made MAE *worse* (0.500). Not in scope.
- raw-OM matches offshore Hs best but is diagnostic-only (no face truth to ship it as face).
- **decay-off overshoots `<0.5`-decay beaches** (bias flipped +0.26). Must NOT apply there.
- Validation target was offshore CDIP Hs (significant wave height), not surf face — 0 session
  face-anchors joined. Physics: face ≳ Hs and we under-read today, so raising toward Hs is
  directionally safe. Re-validate as session face-truth accrues.
- county-line / rincon "improve" but keep large residuals driven by a separate **source-data**
  gap (Open-Meteo under-reads the observation there); decay-off does not fix those. They are
  NOT first-ship beaches.

## Design

### 1. Flag module — `lib/flags/decay-off.ts`
Mirrors `lib/flags/app-first-landing.ts`.
- `isDecayOffEnabled(): boolean` → `process.env.DECAY_OFF_ENABLED === "true"` (default-off).
- `DECAY_OFF_BEACH_ALLOWLIST: ReadonlySet<string>` of beach slugs, initially
  `{ "malibu-first-point-surfrider" }`.
- `DECAY_OFF_BAND = { min: 0.5, max: 0.8 }` (inclusive) — the validated safe band.
  Verified: `malibu-first-point-surfrider.deepwater_decay_factor = 0.6` (in band, flag takes
  effect). county-line / rincon are also 0.6 but excluded for their source-data residual.
- `shouldForceNoDecay(beach): boolean` → `isDecayOffEnabled()
  && DECAY_OFF_BEACH_ALLOWLIST.has(beach.slug)
  && beach.deepwater_decay_factor != null
  && beach.deepwater_decay_factor >= 0.5 && beach.deepwater_decay_factor <= 0.8`.

### 2. Application point — `forecast-builder.ts` `getWaveHeight`
The pure transform (`wave-height-transformer.ts`) is NOT modified and reads no env. Instead,
`getWaveHeight` (which has the full `beach` row, including `slug` and `deepwater_decay_factor`)
computes `shouldForceNoDecay(beach)` once and, when true, passes a shallow clone
`{ ...beach, deepwater_decay_factor: null }` into the transform. The existing transform logic
(`decay = deepwater_decay_factor != null ? deepwater_decay_factor : 1`) then naturally yields
`decay = 1` at both sites (`wave-height-transformer.ts:440` scalar and `:908` decomposed). No
transform signature change, no mutation of the original beach object.

### 3. The band guard
`DECAY_OFF_BAND` is an explicit invariant, not redundant with the allowlist: the replay proved
decay-off overshoots `<0.5`-decay beaches. The band check ensures that even a future careless
allowlist addition of a deeply-sheltered beach cannot regress it. Cheap (two comparisons),
encodes a measured failure mode.

## Validation

- **Unit tests** (`wave-height-transformer` / `forecast-builder` blast radius):
  - flag on + allowlisted + decay 0.6 → display computed with decay = 1 (higher than baseline).
  - flag off → decay applied (byte-identical to today).
  - flag on + NOT allowlisted + decay 0.6 → decay applied.
  - flag on + allowlisted + decay 0.4 (out of band) → decay STILL applied (band guard).
  - both transform paths (scalar + decomposed) covered.
- **forecast-pipeline-trace** skill on `malibu-first-point-surfrider`: old vs new display against
  live NOAA/CDIP/OM data, confirming the rise and no unexpected movement elsewhere.
- Run blast-radius tests for files importing the transform / builder.

## Rollout

1. Land code on a dedicated branch (default-off flag → zero behavior change until enabled).
2. Enable `DECAY_OFF_ENABLED=true` in dev; verify `malibu-first-point-surfrider` shows the
   corrected (higher) number and other beaches are unchanged.
3. Promote to prod as a **code-only slice** (no migration — prod/dev share one DB; the
   allowlist + flag are code). Enable the prod env flag.
4. Expand coverage by adding a slug to `DECAY_OFF_BEACH_ALLOWLIST` and re-validating that beach
   (must be in the 0.5–0.8 band). Re-run the truth-scored replay as session face-truth accrues.

## Out of scope (YAGNI)

- No new DB columns and no shadow-candidate logging — the truth-scored replay is the evaluation
  harness and is re-runnable.
- No partial-decay tuning (e.g. raising the decay floor); only full decay-off (V1) was measured.
- No changes to `<0.5` or `>0.8` decay beaches.
- No decouple-buckets (V2) — rejected by the replay.
- Track 2 (session face-truth collection) is a separate spec, not bolted on here.

## Open questions

None blocking. Implementation detail to confirm: `beach.slug` is present on the object reaching
`getWaveHeight` (it is the full beach row; verify field name during implementation).
