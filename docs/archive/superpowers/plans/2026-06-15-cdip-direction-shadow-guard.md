# CDIP Direction-Aware Shadow Guard Implementation Plan

> **For the implementing agent (Codex):** You have zero prior context. Read the design spec `docs/archive/superpowers/specs/2026-06-15-cdip-direction-shadow-guard-design.md` first — it has the physics rationale and the decisions. Then work these tasks in order. Each is TDD: write the failing test, run it red, implement, run it green, commit. Steps use `- [ ]` checkboxes.

**Goal:** Stop the CDIP calibrated wave-height path from over-reading south swells at Point-Loma-shadowed breaks (OB Pier reads 4.5 ft when reality is 2–3 ft), without changing west-facing in-window beaches (Blacks/Cottons) or OB's own in-window swells.

**Architecture:** Add one pure, exported helper `calibratedShadowFactor(swellDirectionDeg, beach)` in `lib/utils/wave-height-transformer.ts` that returns a floored geometric-shadow multiplier **only when the incident direction is outside the beach's swell window** (in-window or missing data → `1.0`). Multiply it into the calibrated short-circuit of `transformToFaceHeightWithMetadata`. That short-circuit is the single point the CDIP path (and CDIP-backed scoring) flows through, so one insertion covers display and scoring.

**Tech Stack:** TypeScript (strict), Jest (`yarn test:unit`, **Node 22**). Typecheck `yarn typecheck`. Lint a file: `npx eslint --max-warnings=0 <file>`.

---

## Background (read first)

The calibrated short-circuit today is (`lib/utils/wave-height-transformer.ts`, in `transformToFaceHeightWithMetadata`):

```ts
if (canUseCalibratedShoaling(source, allowCalibratedShoaling)) {
  const bucketFactor = lookupShoalingBucket(periodS, beach?.shoaling_factors);
  if (bucketFactor != null) {
    return {
      faceHeightFt: Math.round(rawHeightFt * bucketFactor * 10) / 10,
      isCalibrated: true,
    };
  }
}
```

`bucketFactor` is period-keyed and direction-blind (fit as `surfline_face/cdip_hs`), so a south swell at a south-shadowed beach reads the full offshore Hs. The model path already shadows via `swell_access_factors` (pure geometric line-of-sight); the CDIP path does not. We add the missing direction term, gated to out-of-window directions only (the gate is what prevents regressing in-window swells, where the bucket was calibrated).

**Critical correctness note:** do **not** call the existing `terrainAccessFactor(access)` — it returns `0` when `access <= 0`, which would zero a fully-blocked direction and defeat the diffraction floor. Inline the floored formula so `access 0 → 0.6` (the floor), using the existing exported constants `DIRECTION_FACTOR_MIN` (0.6) and `DIRECTION_FACTOR_RANGE` (0.4).

## File Map

| File | Responsibility | Change |
|------|----------------|--------|
| `lib/utils/wave-height-transformer.ts` | Hs→face transform + the new shadow helper | Add `calibratedShadowFactor`; fold it into the calibrated short-circuit |
| `__tests__/lib/utils/wave-height-transformer.test.ts` | Unit tests for the helper + the short-circuit | Add two `describe` blocks + an `accessArray` test helper |
| `CHANGELOG.md` | Release notes | One `Fixed` bullet under `[Unreleased]` |

No other files change. No data-pipeline, model-path, or `forecast-builder.ts` changes.

---

## Task 1: `calibratedShadowFactor` pure helper

**Files:**
- Modify: `lib/utils/wave-height-transformer.ts` (add an exported function; place it just after `alignmentFactor`, which ends ~line 625)
- Test: `__tests__/lib/utils/wave-height-transformer.test.ts`

- [ ] **Step 1: Add the test helper + failing tests.**

At the top of the test file ensure these imports exist (add what's missing):

```ts
import {
  calibratedShadowFactor,
  transformToFaceHeightWithMetadata,
} from '@/lib/utils/wave-height-transformer';
import { TERRAIN_BINS, toBin5 } from '@/types/terrain';
```

Add this helper near the top of the test file (after imports):

```ts
function accessArray(overrides: Record<number, number>): number[] {
  const a = new Array(TERRAIN_BINS).fill(1.0);
  for (const [bin, val] of Object.entries(overrides)) a[Number(bin)] = val;
  return a;
}
```

Add the describe block:

```ts
describe('calibratedShadowFactor', () => {
  // OB Pier-like: window center 293, halfwidth 73 => window 220-366 deg.
  const obBeach = {
    swell_window_center_deg: 293,
    swell_window_halfwidth_deg: 73,
    swell_access_factors: accessArray({ [toBin5(202)]: 0.008 }),
  };

  it('returns 1.0 for in-window directions (bucket already calibrated there)', () => {
    expect(calibratedShadowFactor(293, obBeach)).toBe(1.0); // dead center
    expect(calibratedShadowFactor(250, obBeach)).toBe(1.0); // inside halfwidth
  });

  it('applies the floored shadow for an out-of-window low-access direction', () => {
    // 202deg is 91deg from center 293 (> halfwidth 73) => out of window.
    // 0.6 + sqrt(0.008)*0.4 = 0.6353
    expect(calibratedShadowFactor(202, obBeach)).toBeCloseTo(0.6353, 3);
  });

  it('floors at 0.6 even when access is exactly 0 (diffraction floor, not zero)', () => {
    const beach = { ...obBeach, swell_access_factors: accessArray({ [toBin5(202)]: 0 }) };
    expect(calibratedShadowFactor(202, beach)).toBeCloseTo(0.6, 5);
  });

  it('returns 1.0 for an out-of-window but fully-exposed direction', () => {
    const beach = { ...obBeach, swell_access_factors: accessArray({ [toBin5(202)]: 1.0 }) };
    expect(calibratedShadowFactor(202, beach)).toBeCloseTo(1.0, 5);
  });

  it('treats the window boundary (distance == halfwidth) as out-of-window', () => {
    // 220deg is exactly 73deg from center 293 => boundary => shadow applies.
    const beach = { ...obBeach, swell_access_factors: accessArray({ [toBin5(220)]: 0.01 }) };
    expect(calibratedShadowFactor(220, beach)).toBeLessThan(1.0);
  });

  it('is a no-op (1.0) when direction, window, or access is missing/invalid', () => {
    expect(calibratedShadowFactor(null, obBeach)).toBe(1.0);
    expect(calibratedShadowFactor(202, {
      swell_window_center_deg: null,
      swell_window_halfwidth_deg: null,
      swell_access_factors: obBeach.swell_access_factors,
    })).toBe(1.0);
    expect(calibratedShadowFactor(202, {
      swell_window_center_deg: 293,
      swell_window_halfwidth_deg: 73,
      swell_access_factors: [0.1, 0.2], // wrong-length array
    })).toBe(1.0);
    expect(calibratedShadowFactor(202, null)).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run the tests — expect FAIL (helper not defined).**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn test:unit __tests__/lib/utils/wave-height-transformer.test.ts -t calibratedShadowFactor`
Expected: FAIL — `calibratedShadowFactor is not a function` / import error.

- [ ] **Step 3: Implement the helper.**

In `lib/utils/wave-height-transformer.ts`, add (just after the `alignmentFactor` function, ~line 625):

```ts
/**
 * Direction-aware shadow multiplier for the CDIP **calibrated** short-circuit.
 *
 * The period bucket (surfline_face / cdip_hs) is direction-blind, so on the CDIP
 * path a south swell at a Point-Loma-shadowed break (e.g. OB Pier) reads the full
 * offshore Hs. This applies a floored geometric-shadow factor, but ONLY when the
 * incident direction is OUTSIDE the beach's swell window:
 *
 *  - in-window (distance < halfwidth)        -> 1.0  (the bucket was calibrated here)
 *  - missing direction / window / access     -> 1.0  (graceful no-op)
 *  - out-of-window                           -> 0.6 + sqrt(access)*0.4
 *
 * The 0.6 floor is the diffraction / directional-spreading floor: energy in a
 * geometric shadow bottoms out around 0.5-0.7 of incident for real seas, never
 * zero. We inline the floored form (instead of calling terrainAccessFactor, which
 * returns 0 at access<=0) so a fully-blocked direction still floors at 0.6.
 */
export function calibratedShadowFactor(
  swellDirectionDeg: number | null | undefined,
  beach: BeachTerrainConfig | null | undefined,
): number {
  if (swellDirectionDeg == null || !Number.isFinite(swellDirectionDeg)) {
    return 1.0;
  }
  const center = beach?.swell_window_center_deg;
  const halfwidth = beach?.swell_window_halfwidth_deg;
  if (
    center == null ||
    halfwidth == null ||
    !Number.isFinite(center) ||
    !Number.isFinite(halfwidth) ||
    halfwidth <= 0
  ) {
    return 1.0;
  }
  // Short-arc angular distance to window center, normalized to [0, 180] —
  // identical math to alignmentFactor so the two agree on "in-window".
  const rawDelta = ((swellDirectionDeg - center) % 360 + 540) % 360 - 180;
  const distance = Math.abs(rawDelta);
  if (distance < halfwidth) {
    return 1.0; // in-window: the bucket is already calibrated for this direction
  }
  const access = beach?.swell_access_factors;
  if (!Array.isArray(access) || access.length !== TERRAIN_BINS) {
    return 1.0;
  }
  const rawAccess = access[toBin5(swellDirectionDeg)];
  if (!Number.isFinite(rawAccess)) {
    return 1.0;
  }
  const clampedAccess = Math.max(0, Math.min(1, rawAccess));
  return DIRECTION_FACTOR_MIN + Math.sqrt(clampedAccess) * DIRECTION_FACTOR_RANGE;
}
```

(`BeachTerrainConfig`, `TERRAIN_BINS`, `toBin5`, `DIRECTION_FACTOR_MIN`, `DIRECTION_FACTOR_RANGE` are all already in scope in this file.)

- [ ] **Step 4: Run the tests — expect PASS.**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn test:unit __tests__/lib/utils/wave-height-transformer.test.ts -t calibratedShadowFactor`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Commit.**

```bash
git add lib/utils/wave-height-transformer.ts __tests__/lib/utils/wave-height-transformer.test.ts
git commit -m "feat(forecast): add gated calibratedShadowFactor for CDIP direction shadow"
```

---

## Task 2: Fold the shadow factor into the calibrated short-circuit

**Files:**
- Modify: `lib/utils/wave-height-transformer.ts` (`transformToFaceHeightWithMetadata`, the `bucketFactor != null` return ~line 432-436)
- Test: `__tests__/lib/utils/wave-height-transformer.test.ts`

- [ ] **Step 1: Add failing integration tests.**

Add this describe block to the test file:

```ts
describe('transformToFaceHeightWithMetadata — CDIP direction shadow', () => {
  const OB_BUCKETS = {
    version: 1 as const,
    type: 'period_lookup' as const,
    buckets: [
      { tp_min_s: 0, tp_max_s: 8, factor: 0.96 },
      { tp_min_s: 8, tp_max_s: 12, factor: 1.0 },
      { tp_min_s: 12, tp_max_s: 16, factor: 1.04 },
      { tp_min_s: 16, tp_max_s: 999, factor: 1.0 },
    ],
  };
  const BLACKS_BUCKETS = {
    version: 1 as const,
    type: 'period_lookup' as const,
    buckets: [
      { tp_min_s: 0, tp_max_s: 8, factor: 1.57 },
      { tp_min_s: 8, tp_max_s: 12, factor: 1.7 },
      { tp_min_s: 12, tp_max_s: 16, factor: 2.13 },
      { tp_min_s: 16, tp_max_s: 999, factor: 2.4 },
    ],
  };

  it('shadows OB Pier south swell on the CDIP calibrated path', () => {
    const result = transformToFaceHeightWithMetadata({
      rawHeightFt: 4.30,
      periodS: 14,
      swellDirectionDeg: 202, // SSW, outside OB's 220-366 window
      source: 'cdip_sig',
      beach: {
        shoaling_factors: OB_BUCKETS,
        swell_window_center_deg: 293,
        swell_window_halfwidth_deg: 73,
        swell_access_factors: accessArray({ [toBin5(202)]: 0.008 }),
      },
    });
    // 4.30 * 1.04 (14s bucket) * 0.6353 (shadow) = 2.84 -> 2.8
    expect(result.isCalibrated).toBe(true);
    expect(result.faceHeightFt).toBeCloseTo(2.8, 1);
  });

  it('leaves OB Pier own in-window WNW swell unchanged', () => {
    const result = transformToFaceHeightWithMetadata({
      rawHeightFt: 4.30,
      periodS: 14,
      swellDirectionDeg: 290, // WNW, inside the window
      source: 'cdip_sig',
      beach: {
        shoaling_factors: OB_BUCKETS,
        swell_window_center_deg: 293,
        swell_window_halfwidth_deg: 73,
        swell_access_factors: accessArray({ [toBin5(290)]: 0.74 }),
      },
    });
    // in-window -> shadow 1.0 -> 4.30 * 1.04 = 4.472 -> 4.5
    expect(result.faceHeightFt).toBeCloseTo(4.5, 1);
  });

  it('leaves a west-facing in-window break (Blacks) byte-identical', () => {
    const result = transformToFaceHeightWithMetadata({
      rawHeightFt: 2.0,
      periodS: 16,
      swellDirectionDeg: 270, // W, inside Blacks 195-341 window
      source: 'cdip_sig',
      beach: {
        shoaling_factors: BLACKS_BUCKETS,
        swell_window_center_deg: 268,
        swell_window_halfwidth_deg: 73,
        swell_access_factors: accessArray({}), // all 1.0
      },
    });
    // 16s -> 16+ bucket 2.4; in-window -> 1.0 -> 2.0 * 2.4 = 4.8
    expect(result.faceHeightFt).toBeCloseTo(4.8, 1);
  });
});
```

- [ ] **Step 2: Run — expect the OB shadow test to FAIL (still no direction factor).**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn test:unit __tests__/lib/utils/wave-height-transformer.test.ts -t "CDIP direction shadow"`
Expected: "shadows OB Pier" FAILS (returns 4.5, not 2.8); the two in-window tests already pass (shadow not yet wired, but they expect no change).

- [ ] **Step 3: Wire the shadow into the short-circuit.**

In `transformToFaceHeightWithMetadata`, replace the `bucketFactor != null` return block with:

```ts
    if (bucketFactor != null) {
      const shadow = calibratedShadowFactor(swellDirectionDeg, beach);
      return {
        faceHeightFt: Math.round(rawHeightFt * bucketFactor * shadow * 10) / 10,
        isCalibrated: true,
      };
    }
```

- [ ] **Step 4: Run all three — expect PASS.**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn test:unit __tests__/lib/utils/wave-height-transformer.test.ts`
Expected: all PASS, including the full existing suite (no regressions).

- [ ] **Step 5: Typecheck + lint.**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn typecheck
npx eslint --max-warnings=0 lib/utils/wave-height-transformer.ts __tests__/lib/utils/wave-height-transformer.test.ts
```
Expected: clean. (If typecheck reports only errors inside `.next/` generated files referencing routes, clear the stale cache: `rm -rf .next && yarn typecheck`.)

- [ ] **Step 6: Run the forecast-builder + formatter suites (blast radius).**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn test:unit \
  __tests__/lib/utils/wave-formatters.test.ts \
  __tests__/lib/services/forecast/forecast-builder-cdip-semantics.test.ts \
  __tests__/lib/services/forecast/forecast-builder.test.ts \
  __tests__/lib/services/forecast/forecast-builder-nowcast-anchor.test.ts
```
Expected: all PASS. If any CDIP-semantics fixture asserted an over-reading south-swell value, update it to the new shadowed value **in this commit** (it's a corrected expectation, not a regression). West-facing fixtures must be unchanged.

- [ ] **Step 7: Commit.**

```bash
git add lib/utils/wave-height-transformer.ts __tests__/lib/utils/wave-height-transformer.test.ts
git commit -m "fix(forecast): apply gated direction shadow to CDIP calibrated face height

South swells at Point-Loma-shadowed breaks (OB Pier) read the full offshore
CDIP Hs because the period bucket is direction-blind. Fold a floored,
out-of-window-gated shadow factor into the calibrated short-circuit: OB Pier
4.5ft -> ~2.8ft on a 16s SSW swell; in-window and west-facing beaches unchanged."
```

---

## Task 3: CHANGELOG + verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a CHANGELOG entry** under `[Unreleased]` → `### Fixed`:

```markdown
- **CDIP south-swell over-read fixed at shadowed breaks** (`lib/utils/wave-height-transformer.ts`). The CDIP calibrated path applied a direction-blind period bucket to the full offshore Hs, so south swells at Point-Loma-shadowed breaks (OB Pier, Ocean Beach, Avalanche) read ~4.5 ft when reality is 2–3 ft. Adds `calibratedShadowFactor`, a floored geometric-shadow multiplier gated to out-of-window directions only (in-window and west-facing beaches are byte-identical). OB Pier 16s SSW: 4.5 ft → ~2.8 ft.
```

- [ ] **Step 2: Commit.**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note CDIP direction shadow guard"
```

- [ ] **Step 3: Live verification (read-only, do not block the commit).** After this lands on a branch, sanity-check against the live DB (Supabase project `vawdnbbgawichorsjiwe`): the 3 firing station-220 beaches (OB Pier `65d177de-...`, Ocean Beach `15c7337e-...`, Avalanche `63af8c07-...`) should compute ~2–3 ft on the current south swell, and Mondos (station 179, WNW-dominant) unchanged. Note `enhanced_forecasts.wave_height` only updates when the batch cron regenerates — this guard is cron-affecting (`lib/services/forecast/**` consumer), so it only changes stored output once deployed to **prod**.

---

## Ship sequencing (from the spec)

This guard and PR #321 (the CDIP nowcast-horizon widen) must reach **prod together** — the horizon-widen makes south-shadowed beaches use the (previously over-reading) CDIP path for more hours, so it must not reach prod without this guard. Land this on `main` → verify on dev → then promote #321's commits **and** this guard to prod in one promotion (or rebase this onto the #321 prod branch). #321 stays a draft until then.

---

## Self-Review

- **Spec coverage:** helper (Task 1) ✓; gated out-of-window only ✓; floor 0.6 via inlined formula ✓; one-line short-circuit fold covering display+scoring (Task 2) ✓; regression safety tests (in-window OB + Blacks) ✓; CHANGELOG ✓; live validation + ship sequencing ✓. Deferred v2 items (taper, period-aware floor, windswell strip, 0.6→0.5 tune) intentionally excluded.
- **Placeholder scan:** none — every step has real code/commands.
- **Type consistency:** `calibratedShadowFactor(swellDirectionDeg, beach)` signature identical in Task 1 (definition) and Task 2 (call). `accessArray` helper defined once, used in both describe blocks. `OB_BUCKETS`/`BLACKS_BUCKETS` shapes match `ShoalingFactors`.
