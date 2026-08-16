# Scoped Decay-Off Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Behind a default-off flag, remove the deepwater-decay multiplier (decay → 1) for an allowlisted set of validated mid-decay (0.5–0.8) beaches, starting with `malibu-first-point-surfrider`, so their displayed surf height stops under-reading.

**Architecture:** A small server-side flag module (`lib/flags/decay-off.ts`) exposes `shouldForceNoDecay(beach)`. `forecast-builder.ts` already builds a `beachTerrain` config object that feeds the transform; the only wiring is to null `beachTerrain.deepwater_decay_factor` when `shouldForceNoDecay` is true. The pure transform (`wave-height-transformer.ts`) is unchanged and reads no env. Default-off → byte-identical output until the flag is enabled.

**Tech Stack:** TypeScript (strict), Next.js, Jest. Design spec: `docs/archive/superpowers/specs/2026-06-26-scoped-decay-off-design.md`.

---

## File Structure

- **Create** `lib/flags/decay-off.ts` — flag read, allowlist, band, and the `shouldForceNoDecay` decision. One responsibility: decide whether to force decay-off for a beach.
- **Create** `lib/flags/__tests__/decay-off.test.ts` — unit tests for the decision across all branches.
- **Modify** `lib/services/forecast/forecast-builder.ts` — add one import; change the `deepwater_decay_factor` line in the `beachTerrain` builder (currently line ~1182).
- **Create** `lib/services/forecast/__tests__/forecast-builder.decay-off.test.ts` — wiring test asserting the transform receives a nulled decay only when the flag applies.

Patterns followed: `lib/subscription/grant-promotional-entitlement.ts` (direct `process.env` flag read, no `server-only`, so it unit-tests cleanly) and `lib/flags/app-first-landing.ts` (flag module location).

---

## Task 1: Flag module + decision logic

**Files:**
- Create: `lib/flags/decay-off.ts`
- Test: `lib/flags/__tests__/decay-off.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/flags/__tests__/decay-off.test.ts`:

```ts
import {
  shouldForceNoDecay,
  DECAY_OFF_BEACH_ALLOWLIST,
  DECAY_OFF_BAND,
} from "../decay-off";

type BeachLike = { slug: string; deepwater_decay_factor: number | null };
const beach = (over: Partial<BeachLike> = {}): BeachLike => ({
  slug: "malibu-first-point-surfrider",
  deepwater_decay_factor: 0.6,
  ...over,
});

describe("shouldForceNoDecay", () => {
  const prev = process.env.DECAY_OFF_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.DECAY_OFF_ENABLED;
    else process.env.DECAY_OFF_ENABLED = prev;
  });

  it("is false when the flag is disabled even if allowlisted + in band", () => {
    delete process.env.DECAY_OFF_ENABLED;
    expect(shouldForceNoDecay(beach())).toBe(false);
  });

  it("is true when flag on + allowlisted + in band (0.6)", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach())).toBe(true);
  });

  it("is false when the beach is not allowlisted", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach({ slug: "county-line-malibu-ca" }))).toBe(false);
  });

  it("is false when allowlisted but below the band (<0.5 overshoots)", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach({ deepwater_decay_factor: 0.4 }))).toBe(false);
  });

  it("is false when allowlisted but above the band (>0.8)", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach({ deepwater_decay_factor: 0.9 }))).toBe(false);
  });

  it("is false when the decay factor is null", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach({ deepwater_decay_factor: null }))).toBe(false);
  });

  it("includes band boundaries (0.5 and 0.8 inclusive)", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach({ deepwater_decay_factor: 0.5 }))).toBe(true);
    expect(shouldForceNoDecay(beach({ deepwater_decay_factor: 0.8 }))).toBe(true);
  });

  it("seeds the allowlist with malibu-first-point-surfrider only", () => {
    expect([...DECAY_OFF_BEACH_ALLOWLIST]).toEqual(["malibu-first-point-surfrider"]);
    expect(DECAY_OFF_BAND).toEqual({ min: 0.5, max: 0.8 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:unit lib/flags/__tests__/decay-off.test.ts`
Expected: FAIL — `Cannot find module '../decay-off'`.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/flags/decay-off.ts`:

```ts
import type { Beach } from "@/types/database";

/** Default-off kill switch for the scoped decay-off lever. Enable with
 * DECAY_OFF_ENABLED=true. Reads process.env directly (no `server-only`) so the
 * decision unit-tests cleanly. */
export function isDecayOffEnabled(): boolean {
  return process.env.DECAY_OFF_ENABLED === "true";
}

/** Beaches where the deepwater-decay multiplier is removed (decay → 1) on
 * model-sourced forecasts. Validated against observations in the 2026-06-26
 * truth-scored replay. Expand ONLY with a re-validated beach inside the band. */
export const DECAY_OFF_BEACH_ALLOWLIST: ReadonlySet<string> = new Set([
  "malibu-first-point-surfrider",
]);

/** Validated safe decay band (inclusive). decay-off OVERSHOOTS beaches below
 * 0.5 (the replay showed bias flips positive), so the guard refuses to apply
 * outside this band even when a beach is allowlisted. */
export const DECAY_OFF_BAND = { min: 0.5, max: 0.8 } as const;

/** True when the scoped decay-off lever should remove deepwater decay for this
 * beach: flag on AND allowlisted AND its decay factor is in the safe band. */
export function shouldForceNoDecay(
  beach: Pick<Beach, "slug" | "deepwater_decay_factor">,
): boolean {
  if (!isDecayOffEnabled()) return false;
  if (!DECAY_OFF_BEACH_ALLOWLIST.has(beach.slug)) return false;
  const decay = beach.deepwater_decay_factor;
  if (decay == null) return false;
  return decay >= DECAY_OFF_BAND.min && decay <= DECAY_OFF_BAND.max;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:unit lib/flags/__tests__/decay-off.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/flags/decay-off.ts lib/flags/__tests__/decay-off.test.ts
git commit -m "feat(forecast): add scoped decay-off flag + decision"
```

---

## Task 2: Wire the decision into the forecast builder

**Files:**
- Modify: `lib/services/forecast/forecast-builder.ts` (import near line 47; `beachTerrain` builder near line 1182)
- Test: `lib/services/forecast/__tests__/forecast-builder.decay-off.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/services/forecast/__tests__/forecast-builder.decay-off.test.ts`. Copy the mock harness setup verbatim from `forecast-builder.height-offset.test.ts` lines 1–166 (the `jest.mock(...)` blocks for `@/lib/supabase`, `confidence-scorer`, `@/lib/logger`, `@/lib/utils/wave-formatters`, `../log-display-prediction`; plus `buildInputs`, `newBuilder`). Then add this suite, which additionally imports the mocked transform to inspect its call args:

```ts
import { toFaceHeightFeetDecomposedWithDebug } from "@/lib/utils/wave-formatters";

const transformMock = toFaceHeightFeetDecomposedWithDebug as unknown as jest.Mock;

const malibuBeach = (decay: number | null) =>
  ({
    id: "beach-1",
    name: "Malibu First Point",
    slug: "malibu-first-point-surfrider",
    lat: 34.03,
    lon: -118.68,
    deepwater_decay_factor: decay,
  }) as unknown as Beach;

// Returns the deepwater_decay_factor the transform was actually called with.
const decayPassedToTransform = (): Array<number | null> =>
  transformMock.mock.calls.map((c) => c[0]?.beach?.deepwater_decay_factor ?? null);

describe("ForecastBuilder scoped decay-off wiring", () => {
  const prev = process.env.DECAY_OFF_ENABLED;
  beforeEach(() => {
    transformMock.mockClear();
    insertMock.mockClear();
    fromMock.mockClear();
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.DECAY_OFF_ENABLED;
    else process.env.DECAY_OFF_ENABLED = prev;
  });

  it("flag off → transform receives the real decay factor (0.6)", async () => {
    delete process.env.DECAY_OFF_ENABLED;
    await newBuilder().buildForecasts(buildInputs({ beach: malibuBeach(0.6) }));
    expect(decayPassedToTransform().length).toBeGreaterThan(0);
    expect(decayPassedToTransform()).toContain(0.6);
    expect(decayPassedToTransform()).not.toContain(null);
  });

  it("flag on + allowlisted + in band → transform receives null (decay removed)", async () => {
    process.env.DECAY_OFF_ENABLED = "true";
    await newBuilder().buildForecasts(buildInputs({ beach: malibuBeach(0.6) }));
    const passed = decayPassedToTransform();
    expect(passed.length).toBeGreaterThan(0);
    expect(passed.every((d) => d === null)).toBe(true);
  });

  it("flag on but beach not allowlisted → transform receives the real decay", async () => {
    process.env.DECAY_OFF_ENABLED = "true";
    const other = { ...malibuBeach(0.6), slug: "county-line-malibu-ca" } as Beach;
    await newBuilder().buildForecasts(buildInputs({ beach: other }));
    expect(decayPassedToTransform()).toContain(0.6);
  });

  it("flag on + allowlisted but below band (0.4) → transform still receives 0.4", async () => {
    process.env.DECAY_OFF_ENABLED = "true";
    await newBuilder().buildForecasts(buildInputs({ beach: malibuBeach(0.4) }));
    expect(decayPassedToTransform()).toContain(0.4);
  });
});
```

Note: the harness mocks `toFaceHeightFeetDecomposedWithDebug` to return a fixed value, so this asserts purely on the `beach.deepwater_decay_factor` argument the builder hands to the transform — independent of transform math. All three transform branches in `getWaveHeight` pass the same `beachTerrain`, so any call reflects the wiring.

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:unit lib/services/forecast/__tests__/forecast-builder.decay-off.test.ts`
Expected: FAIL — the "flag on" case still sees `0.6` (wiring not present yet).

- [ ] **Step 3: Add the import**

In `lib/services/forecast/forecast-builder.ts`, near the existing `import type { Beach } from "@/types/database";` (line ~47), add:

```ts
import { shouldForceNoDecay } from "@/lib/flags/decay-off";
```

- [ ] **Step 4: Change the beachTerrain decay line**

In `lib/services/forecast/forecast-builder.ts`, inside the `beachTerrain` object (currently line ~1182), replace:

```ts
      deepwater_decay_factor: beach.deepwater_decay_factor ?? null,
```

with:

```ts
      // Scoped decay-off: validated allowlisted beaches in the 0.5–0.8 band get
      // decay removed (→ 1) behind a default-off flag. See lib/flags/decay-off.ts.
      deepwater_decay_factor: shouldForceNoDecay(beach)
        ? null
        : beach.deepwater_decay_factor ?? null,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test:unit lib/services/forecast/__tests__/forecast-builder.decay-off.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/services/forecast/forecast-builder.ts lib/services/forecast/__tests__/forecast-builder.decay-off.test.ts
git commit -m "feat(forecast): apply scoped decay-off in beachTerrain builder"
```

---

## Task 3: Verify (no behavior change off; correct change on)

**Files:** none (verification only).

- [ ] **Step 1: Default-off invariant — full builder suite stays green**

Run: `yarn test:unit lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts`
Expected: PASS. With the flag unset, `shouldForceNoDecay` returns false, so `beach.deepwater_decay_factor ?? null` is byte-identical to before.

- [ ] **Step 2: Blast-radius + typecheck**

Run: `yarn test:unit lib/services/forecast lib/utils/__tests__`
Run: `yarn typecheck`
Run: `NODE_OPTIONS="--max-old-space-size=8192" npx eslint --max-warnings=0 lib/flags/decay-off.ts lib/flags/__tests__/decay-off.test.ts lib/services/forecast/forecast-builder.ts lib/services/forecast/__tests__/forecast-builder.decay-off.test.ts`
Expected: all PASS / 0 warnings.

- [ ] **Step 3: Live old-vs-new trace on the target beach**

Use the `forecast-pipeline-trace` skill against `malibu-first-point-surfrider` with `DECAY_OFF_ENABLED` off vs on. Confirm: the displayed face height RISES with the flag on (decay 0.6 → 1.0), no other beach moves, and the rise is bounded (roughly `1 / 0.6 ≈ 1.67×` the model-swell contribution, not unbounded). Record the before/after numbers in the PR description.

- [ ] **Step 4: CHANGELOG**

Add under `[Unreleased]` in `CHANGELOG.md`:

```
### Added
- Scoped decay-off flag (`DECAY_OFF_ENABLED`, default-off) removing over-aggressive deepwater decay on validated mid-decay beaches (first: malibu-first-point-surfrider). No behavior change until enabled.
```

Commit:

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note scoped decay-off flag"
```

---

## Rollout (after merge)

1. Merge the branch (flag default-off → zero behavior change).
2. Enable `DECAY_OFF_ENABLED=true` in the dev environment; confirm `malibu-first-point-surfrider` shows the higher number and other beaches are unchanged.
3. Promote to prod as a **code-only slice** (no migration — prod/dev share one DB; flag + allowlist are code). Set the prod env flag.
4. Expand by adding a re-validated 0.5–0.8 beach slug to `DECAY_OFF_BEACH_ALLOWLIST`. Re-run the truth-scored replay as session face-truth accrues.

## Out of scope (YAGNI)

No DB columns, no shadow-candidate logging (the replay is the eval harness), no partial-decay tuning, no `<0.5`/`>0.8` beaches, no decouple-buckets (rejected by the replay).
