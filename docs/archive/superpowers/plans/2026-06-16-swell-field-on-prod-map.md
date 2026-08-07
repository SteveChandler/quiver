# Animated Swell/Wind Field on Prod /map (Track 2) Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the animated swell/wind flow-field (prototyped in `components/map/surf-map-prototype.tsx`) into the production `/map` surface (`components/map/interactive-map.tsx`). End state: prod `/map` gains (a) real swell/wind partition data flowing through the existing bulk API + loader, (b) an animated flow-field rendered as a Mapbox `CustomLayerInterface` WebGL layer locked to geography (NOT a screen-space Canvas-2D overlay), and (c) an on-brand layer selector + forecast timeline — all themed via `components/map/swell-map-theme.ts` and honoring `useReducedMotion`. Markers already use `mapboxgl.Marker` (`interactive-map.tsx:948`); this ADDS the flow layer + controls and does NOT rewrite markers.

**Architecture:** Three independently shippable phases.
- **Phase B1 (DATA):** `app/api/forecasts/bulk/route.ts` already SELECTs the partition columns (`BULK_FORECAST_SELECT`, line 30-31) but never emits them. Build a `swellPartitionMap`, add `swellPartitions` to the success response, and parse it in `components/map/map-beach-loader.ts` into a new `partitionsMap`.
- **Phase B2 (WEBGL):** Pure flow-field math in `components/map/swell-field/field-sampler.ts`; a real Mapbox `CustomLayerInterface` factory in `components/map/swell-field/swell-particle-layer.ts` with full GLSL, advecting particles in Mercator coordinates against the projection matrix. This replaces the prototype's screen-space Canvas-2D engine; the Canvas-2D path remains only as a documented no-WebGL fallback.
- **Phase B3 (INTEGRATION):** Extend `InteractiveMapProps`, add/remove the custom layer via the existing `mapRef`/`isMapReady`, mount an on-brand `SwellLayerSelector` + `SwellForecastTimeline` as children of the existing container return (`interactive-map.tsx:962-969`), wire `partitionsMap` from the loader down through the existing render chain (`app/map/map-page-client.tsx` → `components/map-view.tsx` → `MapContent` → `InteractiveMap`).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Mapbox GL 3.19.0 (`mapboxgl.MercatorCoordinate`, `CustomLayerInterface`), WebGL1 (`WebGLRenderingContext`), Tailwind (tokens in `tailwind.config.ts`), Jest (`yarn test:unit`), Playwright (`npx playwright test`, with `setupErrorDetection`/`assertNoErrors` from `e2e/utils/error-detection.ts`).

---

## File Structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `components/map/swell-map-theme.ts` | Create (if Plan A hasn't) | Shared design tokens (surfaces, sticker shadow/radius, layer colors, CTA class). Single source of truth consumed by B2/B3. |
| `app/api/forecasts/bulk/route.ts` | Modify | Build `swellPartitionMap` from already-selected columns; export `SwellPartition` type; add `swellPartitions` to success + empty responses. |
| `components/map/map-beach-loader.ts` | Modify | Add `partitionsMap: Map<string, SwellPartition>` to `BeachLoaderResult`; parse `data?.data?.swellPartitions`. |
| `components/map/swell-field/field-sampler.ts` | Create | PURE flow-field math: `degToVector`, IDW `buildFlowField` over a coarse lng/lat grid. No React, no GL, no DOM. |
| `components/map/swell-field/swell-particle-layer.ts` | Create | `createSwellParticleLayer(...)` → Mapbox `CustomLayerInterface` with full GLSL, Mercator advection, additive trails, reduced-motion static frame, GL cleanup. |
| `components/map/swell-field/swell-layer-selector.tsx` | Create | On-brand layer toggle (S1 / S2 / Wind / Combined), `role="switch"`, focus rings, opaque navy sticker. |
| `components/map/swell-field/swell-forecast-timeline.tsx` | Create | On-brand forecast-hour scrubber emitting a time index, Space Mono values. |
| `components/map/interactive-map.tsx` | Modify | Extend props; add/remove custom layer on `isMapReady && showSwellField`; mount selector + timeline as container children; pass `partitionsMap` through `populateLocations`. |
| `components/map/map-content.tsx` | Modify | Thread `showSwellField`/`swellLayerId`/`onSwellLayerChange`/timeline props into `<InteractiveMap>` (line 207). |
| `components/map-view.tsx` | Modify | Own swell-field UI state (layer id, time index, enabled) and pass to `MapContent` (line 388). |
| `__tests__/app/api/forecasts/bulk/swell-partitions.test.ts` | Create | Jest: partition mapping incl. nulls + unit conversion. |
| `__tests__/components/map/map-beach-loader-partitions.test.ts` | Create | Jest: loader parses `swellPartitions` into `partitionsMap`. |
| `__tests__/components/map/swell-field/field-sampler.test.ts` | Create | Jest: `degToVector` cardinal cases + IDW interpolation. |
| `__tests__/components/map/swell-field/swell-particle-layer.test.ts` | Create | Jest: pure shader-source/uniform-name exports + reseed math (GL render validated in B3 Playwright). |
| `e2e/map-swell-field.spec.ts` | Create | Playwright: toggle field, assert layer exists, animates vs static under reduced motion, switch layers, no console errors, mobile + desktop. |

---

### Task 1: Shared design tokens (idempotent — skip if Plan A landed it)

**Files:**
- Create (only if absent): `components/map/swell-map-theme.ts`

- [ ] **Step 1: Check whether Plan A already created the theme.** Run:
  ```bash
  test -f components/map/swell-map-theme.ts && echo "EXISTS — skip Task 1" || echo "MISSING — create it"
  ```
  Expected: if `EXISTS`, skip to Task 2 (do NOT overwrite Plan A's file). If `MISSING`, do Step 2.

- [ ] **Step 2: Create the shared token module (only if missing).** Write `components/map/swell-map-theme.ts` with EXACTLY:
  ```ts
  export type SwellLayerId = "s1" | "s2" | "wind" | "combined";

  // Opaque navy surfaces (NO glass). rgba alphas are for layering over the map, still navy-tinted.
  export const SWELL_MAP_SURFACE = {
    base: "#252D6B",      // Deep Twilight navy — canvas
    panel: "#1E2558",     // opaque card (header.start)
    panelDeep: "#161A40", // darker card / drawer
    border: "rgba(255,255,255,0.12)",
  } as const;

  // Hard offset sticker shadow (no blur) — use as boxShadow.
  export const SWELL_MAP_STICKER_SHADOW = "2px 3px 0 0 rgba(0,0,0,0.35)";
  export const SWELL_MAP_STICKER_RADIUS = "12px 4px 14px 6px"; // asymmetric

  // Layer accent colors — sanctioned palette only, NO cyan/purple.
  export const SWELL_LAYER_COLOR: Record<SwellLayerId, string> = {
    s1: "#F78E42",   // primary swell — Charming Orange (decorative)
    s2: "#FDB84B",   // secondary swell — Paradise Gold
    wind: "#00D4AA", // wind — Pacific Teal (the ONE sanctioned teal; NOT #38bdf8 cyan)
    combined: "#F78E42",
  };

  // CTA tokens (Tailwind classes). Interactive buttons w/ white text MUST use ocean-blue (#9E5010, AA-safe),
  // NEVER bg-[#f78e42] white-text (2.36:1 AA fail). Decorative orange text-on-navy uses text-ocean-blue-decorative.
  export const SWELL_MAP_CTA_CLASS = "bg-ocean-blue text-white hover:bg-ocean-blue/90";
  ```

- [ ] **Step 3: Typecheck.** Run:
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: PASS (clean).

- [ ] **Step 4: Commit (only if you created the file).**
  ```bash
  git add components/map/swell-map-theme.ts
  git commit -m "feat(map): add shared swell-field design tokens"
  ```

---

## PHASE B1 — DATA (API + loader + types + tests)

### Task 2: Confirm swell-height units on a real row (verification gate — no code)

**Files:** none (read-only DB check).

- [ ] **Step 1: Sample one real row to decide the height conversion.** The `EnhancedForecastEntity` swell fields are TEXT strings (`types/forecast.ts:141-146`) and their unit is ambiguous (raw partition meters vs feet). Run this via the Supabase MCP (`mcp__supabase__execute_sql`) against the production project, or psql:
  ```sql
  SELECT beach_id,
         wave_height,                 -- known display feet, for magnitude comparison
         swell_1_height, swell_1_period, swell_1_direction,
         swell_2_height, swell_2_period, swell_2_direction,
         wind_speed, wind_direction_deg
  FROM enhanced_forecasts
  WHERE swell_1_height IS NOT NULL
    AND forecast_at >= now()
  ORDER BY forecast_at ASC
  LIMIT 5;
  ```
  Expected decision rule, RECORD THE ANSWER in the Task 3 implementation comment:
  - If `swell_1_height` magnitudes are roughly `wave_height / 3.28` (e.g. `wave_height`≈"4" while `swell_1_height`≈"1.0"–"1.3"), the partitions are **meters** → set `SWELL_HEIGHT_IS_METERS = true` (convert `*3.28084`).
  - If `swell_1_height` magnitudes track `wave_height` closely (both ≈"3"–"5"), they are **feet** → set `SWELL_HEIGHT_IS_METERS = false` (no conversion).
  - `wind_speed`: confirm units the same way (compare to a known knots value); typical surf forecasts store knots. If values look like 5–35, treat as knots (no conversion). Record this too.

- [ ] **Step 2: Write the confirmed constants into Task 3.** Before writing route code, fill the two booleans (`SWELL_HEIGHT_IS_METERS`, `WIND_SPEED_IS_KNOTS`) in Task 3 Step 4 with the values you just determined. Do NOT leave a TODO in code.

---

### Task 3: Emit swell partitions from the bulk forecast route

**Files:**
- Modify: `app/api/forecasts/bulk/route.ts` (add `SwellPartition` type + `buildSwellPartitionMap`; emit at response lines 272-278; add to `emptyBulkForecastResponse` line 22-28)
- Test: `__tests__/app/api/forecasts/bulk/swell-partitions.test.ts`

- [ ] **Step 1: Write the failing test.** Create `__tests__/app/api/forecasts/bulk/swell-partitions.test.ts`:
  ```ts
  /**
   * @jest-environment node
   */
  import { rowToSwellPartition } from "@/app/api/forecasts/bulk/route";

  describe("rowToSwellPartition", () => {
    it("parses populated string fields into numbers", () => {
      const p = rowToSwellPartition({
        swell_1_height: "1.2",
        swell_1_period: "14",
        swell_1_direction: "270",
        swell_2_height: "0.6",
        swell_2_period: "8",
        swell_2_direction: "200",
        wind_speed: "12",
        wind_direction_deg: 310,
      });
      // SWELL_HEIGHT_IS_METERS is confirmed in Task 2; if meters, 1.2m -> ~3.94ft.
      expect(p.s1Dir).toBe(270);
      expect(p.s1PeriodS).toBe(14);
      expect(p.s2Dir).toBe(200);
      expect(p.s2PeriodS).toBe(8);
      expect(p.windDir).toBe(310);
      expect(p.windKt).toBe(12);
      expect(p.s1HeightFt).not.toBeNull();
      expect(p.s2HeightFt).not.toBeNull();
      expect(p.s1HeightFt!).toBeGreaterThan(p.s2HeightFt!);
    });

    it("returns nulls for missing/garbage fields without throwing", () => {
      const p = rowToSwellPartition({
        swell_1_height: null,
        swell_1_period: null,
        swell_1_direction: null,
        swell_2_height: "not-a-number",
        swell_2_period: undefined,
        swell_2_direction: "",
        wind_speed: null,
        wind_direction_deg: null,
      });
      expect(p.s1Dir).toBeNull();
      expect(p.s1PeriodS).toBeNull();
      expect(p.s1HeightFt).toBeNull();
      expect(p.s2HeightFt).toBeNull();
      expect(p.s2Dir).toBeNull();
      expect(p.windDir).toBeNull();
      expect(p.windKt).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run it — expect FAIL (import does not exist yet).**
  ```bash
  yarn test:unit __tests__/app/api/forecasts/bulk/swell-partitions.test.ts
  ```
  Expected: FAIL — `rowToSwellPartition is not a function` / module export missing.

- [ ] **Step 3: Add the `SwellPartition` type + empty-response key.** In `app/api/forecasts/bulk/route.ts`, after the `ConditionSummary` type (line 20), add:
  ```ts
  export interface SwellPartition {
    s1Dir: number | null;
    s1PeriodS: number | null;
    s1HeightFt: number | null;
    s2Dir: number | null;
    s2PeriodS: number | null;
    s2HeightFt: number | null;
    windDir: number | null;
    windKt: number | null;
  }
  ```
  Then add `swellPartitions: {}` to `emptyBulkForecastResponse` (lines 22-28):
  ```ts
  const emptyBulkForecastResponse = {
    forecasts: {},
    waterTemps: {},
    isCalibrated: {},
    conditionScores: {},
    conditionSummaries: {},
    swellPartitions: {},
  };
  ```

- [ ] **Step 4: Add the pure parser + map builder.** Below `parseDisplayWaveHeight` (ends line 95) add (fill the two booleans from Task 2):
  ```ts
  // Confirmed via Task 2 verification on a live `enhanced_forecasts` row.
  // <<FILL FROM TASK 2>>: true if swell_*_height columns are partition meters.
  const SWELL_HEIGHT_IS_METERS = true;
  // <<FILL FROM TASK 2>>: true if wind_speed is already knots.
  const WIND_SPEED_IS_KNOTS = true;
  const METERS_TO_FEET = 3.28084;

  function parseFiniteFloat(value: string | number | null | undefined): number | null {
    if (value == null) return null;
    const parsed = typeof value === "number" ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseSwellHeightFt(value: string | null | undefined): number | null {
    const raw = parseFiniteFloat(value);
    if (raw == null) return null;
    return SWELL_HEIGHT_IS_METERS ? raw * METERS_TO_FEET : raw;
  }

  function parseWindKt(value: string | null | undefined): number | null {
    const raw = parseFiniteFloat(value);
    if (raw == null) return null;
    // If wind_speed were m/s we would multiply by 1.94384; Task 2 confirmed knots.
    return WIND_SPEED_IS_KNOTS ? raw : raw * 1.94384;
  }

  type SwellPartitionRow = Pick<
    EnhancedForecastEntity,
    | "swell_1_height" | "swell_1_period" | "swell_1_direction"
    | "swell_2_height" | "swell_2_period" | "swell_2_direction"
    | "wind_speed" | "wind_direction_deg"
  >;

  export function rowToSwellPartition(row: SwellPartitionRow): SwellPartition {
    return {
      s1Dir: parseFiniteFloat(row.swell_1_direction),
      s1PeriodS: parseFiniteFloat(row.swell_1_period),
      s1HeightFt: parseSwellHeightFt(row.swell_1_height),
      s2Dir: parseFiniteFloat(row.swell_2_direction),
      s2PeriodS: parseFiniteFloat(row.swell_2_period),
      s2HeightFt: parseSwellHeightFt(row.swell_2_height),
      windDir: parseFiniteFloat(row.wind_direction_deg),
      windKt: parseWindKt(row.wind_speed),
    };
  }
  ```

- [ ] **Step 5: Run the test — expect PASS.**
  ```bash
  yarn test:unit __tests__/app/api/forecasts/bulk/swell-partitions.test.ts
  ```
  Expected: PASS (2 passing).

- [ ] **Step 6: Build the per-beach map and emit it in the handler.** In `bulkForecastHandler`, after the `waveHeightMap` block (ends line 197), add:
  ```ts
  const swellPartitionMap: Record<string, SwellPartition> = {};
  (data || []).forEach((row) => {
    swellPartitionMap[row.beach_id] = rowToSwellPartition(row);
  });
  ```
  Then add `swellPartitions` to the `createSuccessResponse` object (lines 272-278):
  ```ts
  return createSuccessResponse({
    forecasts: waveHeightMap,
    waterTemps: waterTempMap,
    isCalibrated: isCalibratedMap,
    conditionScores: conditionScoreMap,
    conditionSummaries: conditionSummaryMap,
    swellPartitions: swellPartitionMap,
  });
  ```

- [ ] **Step 7: Typecheck + run the pre-existing route tests (blast radius).**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  yarn test:unit __tests__/app/api/forecasts/bulk/route.test.ts __tests__/api/forecasts/forecasts-bulk.test.ts
  ```
  Expected: typecheck clean; both pre-existing route specs still PASS (they assert the existing keys; the added key is additive and must not break them).

- [ ] **Step 8: Lint touched files + commit.**
  ```bash
  npx eslint --max-warnings=0 app/api/forecasts/bulk/route.ts __tests__/app/api/forecasts/bulk/swell-partitions.test.ts
  git add app/api/forecasts/bulk/route.ts __tests__/app/api/forecasts/bulk/swell-partitions.test.ts
  git commit -m "feat(map): emit swell/wind partitions from bulk forecast route"
  ```

---

### Task 4: Parse swell partitions in the beach loader

**Files:**
- Modify: `components/map/map-beach-loader.ts` (extend `BeachLoaderResult` line 26-37; init map line 112-115; parse in `results.forEach` 148-182; return line 191)
- Test: `__tests__/components/map/map-beach-loader-partitions.test.ts`

- [ ] **Step 1: Write the failing test.** Create `__tests__/components/map/map-beach-loader-partitions.test.ts`:
  ```ts
  import { loadBeachesAndWaveHeights } from "@/components/map/map-beach-loader";
  import type { Beach } from "@/types/database";

  const beach = (id: string, lat: number, lon: number): Beach =>
    ({ id, name: id, lat, lon } as unknown as Beach);

  describe("loadBeachesAndWaveHeights — swell partitions", () => {
    const originalFetch = global.fetch;
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("parses swellPartitions from the bulk response into partitionsMap", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            forecasts: { a: 3.5 },
            waterTemps: {},
            conditionScores: {},
            conditionSummaries: {},
            swellPartitions: {
              a: {
                s1Dir: 270, s1PeriodS: 14, s1HeightFt: 3.9,
                s2Dir: 200, s2PeriodS: 8, s2HeightFt: 1.9,
                windDir: 310, windKt: 12,
              },
            },
          },
        }),
      }) as unknown as typeof fetch;

      const result = await loadBeachesAndWaveHeights(
        32.7, -117.2,
        [beach("a", 32.71, -117.21)],
        { fetchNearbyBeaches: async () => ({ data: [] }) }
      );

      expect(result.partitionsMap.get("a")).toEqual({
        s1Dir: 270, s1PeriodS: 14, s1HeightFt: 3.9,
        s2Dir: 200, s2PeriodS: 8, s2HeightFt: 1.9,
        windDir: 310, windKt: 12,
      });
    });

    it("returns an empty partitionsMap when the field is absent", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ data: { forecasts: { a: 3.5 } } }),
      }) as unknown as typeof fetch;

      const result = await loadBeachesAndWaveHeights(
        32.7, -117.2,
        [beach("a", 32.71, -117.21)],
        { fetchNearbyBeaches: async () => ({ data: [] }) }
      );
      expect(result.partitionsMap.size).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run it — expect FAIL.**
  ```bash
  yarn test:unit __tests__/components/map/map-beach-loader-partitions.test.ts
  ```
  Expected: FAIL — `result.partitionsMap` is `undefined`.

- [ ] **Step 3: Import the type + extend the result interface.** At top of `components/map/map-beach-loader.ts` add to the imports:
  ```ts
  import type { SwellPartition } from "@/app/api/forecasts/bulk/route";
  ```
  Then add to `BeachLoaderResult` (after `conditionSummaryMap`, line 36):
  ```ts
    /** Map from beach ID to parsed swell/wind partition for the flow field */
    partitionsMap: Map<string, SwellPartition>;
  ```

- [ ] **Step 4: Initialize and parse the map.** After `const conditionSummaryMap = new Map...` (line 115) add:
  ```ts
  const partitionsMap = new Map<string, SwellPartition>();
  ```
  Inside `results.forEach((data) => { ... })`, after the `conditionSummaries` block (ends line 181) add:
  ```ts
  const swellPartitions = data?.data?.swellPartitions || {};
  Object.entries(swellPartitions).forEach(([beachId, partition]) => {
    if (partition && typeof partition === "object") {
      partitionsMap.set(beachId, partition as SwellPartition);
    }
  });
  ```

- [ ] **Step 5: Return the new map.** Change the return (line 191) to:
  ```ts
  return { locations, waveHeightMap, waterTempMap, conditionScoreMap, conditionSummaryMap, partitionsMap };
  ```

- [ ] **Step 6: Run the test — expect PASS.**
  ```bash
  yarn test:unit __tests__/components/map/map-beach-loader-partitions.test.ts
  ```
  Expected: PASS (2 passing).

- [ ] **Step 7: Typecheck (interactive-map consumes BeachLoaderResult — must still compile).**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: PASS. `interactive-map.tsx` destructures specific fields, so the additive field does not break it.

- [ ] **Step 8: Lint + commit.**
  ```bash
  npx eslint --max-warnings=0 components/map/map-beach-loader.ts __tests__/components/map/map-beach-loader-partitions.test.ts
  git add components/map/map-beach-loader.ts __tests__/components/map/map-beach-loader-partitions.test.ts
  git commit -m "feat(map): parse swell partitions in beach loader"
  ```

---

## PHASE B2 — WEBGL FLOW-FIELD LAYER

### Task 5: Pure flow-field sampler

**Files:**
- Create: `components/map/swell-field/field-sampler.ts`
- Test: `__tests__/components/map/swell-field/field-sampler.test.ts`

- [ ] **Step 1: Write the failing test.** Create `__tests__/components/map/swell-field/field-sampler.test.ts`:
  ```ts
  import {
    degToVector,
    buildFlowField,
    type BeachPartitionPoint,
  } from "@/components/map/swell-field/field-sampler";

  describe("degToVector", () => {
    // Swell direction is the bearing the swell COMES FROM; travel vector is +180deg.
    // Screen-y is DOWN, so a swell coming FROM the North (0deg) travels south (+y).
    it("FROM north (0) travels south: +y, ~0 x", () => {
      const v = degToVector(0);
      expect(v.x).toBeCloseTo(0, 5);
      expect(v.y).toBeCloseTo(1, 5);
    });
    it("FROM west (270) travels east: +x, ~0 y", () => {
      const v = degToVector(270);
      expect(v.x).toBeCloseTo(1, 5);
      expect(v.y).toBeCloseTo(0, 5);
    });
    it("FROM south (180) travels north: -y", () => {
      const v = degToVector(180);
      expect(v.y).toBeCloseTo(-1, 5);
    });
    it("returns a unit vector", () => {
      const v = degToVector(217);
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 5);
    });
  });

  describe("buildFlowField", () => {
    const pt = (
      lon: number, lat: number, dir: number, periodS: number, heightFt: number
    ): BeachPartitionPoint => ({ lon, lat, dir, periodS, heightFt });

    it("single source returns that source's travel direction at every cell", () => {
      const field = buildFlowField(
        [pt(-117.2, 32.7, 270, 14, 4)],
        { west: -117.3, south: 32.6, east: -117.1, north: 32.8 },
        4
      );
      const cell = field.cells[0];
      // FROM-west swell -> travels east: vx > 0, vy ~ 0
      expect(cell.vx).toBeGreaterThan(0);
      expect(Math.abs(cell.vy)).toBeLessThan(1e-6);
      expect(field.cols).toBe(4);
    });

    it("IDW midpoint blends two opposing sources toward zero horizontal", () => {
      const field = buildFlowField(
        [pt(-117.3, 32.7, 270, 14, 4), pt(-117.1, 32.7, 90, 14, 4)],
        { west: -117.3, south: 32.6, east: -117.1, north: 32.8 },
        3
      );
      // Center column cell should see near-equal weights -> vx cancels toward 0.
      const centerRowMid = field.cells.find(
        (c) => Math.abs(c.lon - -117.2) < 1e-6 && Math.abs(c.lat - 32.7) < 1e-6
      );
      expect(centerRowMid).toBeDefined();
      expect(Math.abs(centerRowMid!.vx)).toBeLessThan(0.2);
    });

    it("speed scales with period and alpha with height^2", () => {
      const slowSmall = buildFlowField(
        [pt(-117.2, 32.7, 270, 6, 1)],
        { west: -117.3, south: 32.6, east: -117.1, north: 32.8 }, 2
      ).cells[0];
      const fastBig = buildFlowField(
        [pt(-117.2, 32.7, 270, 18, 6)],
        { west: -117.3, south: 32.6, east: -117.1, north: 32.8 }, 2
      ).cells[0];
      expect(fastBig.speed).toBeGreaterThan(slowSmall.speed);
      expect(fastBig.alpha).toBeGreaterThan(slowSmall.alpha);
    });

    it("empty sources yields empty cells", () => {
      const field = buildFlowField([], { west: -1, south: -1, east: 1, north: 1 }, 4);
      expect(field.cells).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 2: Run it — expect FAIL (module missing).**
  ```bash
  yarn test:unit __tests__/components/map/swell-field/field-sampler.test.ts
  ```
  Expected: FAIL — cannot find module `field-sampler`.

- [ ] **Step 3: Implement the sampler.** Create `components/map/swell-field/field-sampler.ts`:
  ```ts
  import type { SwellLayerId } from "@/components/map/swell-map-theme";
  import type { SwellPartition } from "@/app/api/forecasts/bulk/route";

  export interface Vec2 {
    x: number;
    y: number;
  }

  /** One beach reduced to a single (direction, period, height) sample for a layer. */
  export interface BeachPartitionPoint {
    lon: number;
    lat: number;
    /** Oceanographic bearing the energy COMES FROM, in degrees. */
    dir: number;
    /** Period in seconds (drives advection speed). */
    periodS: number;
    /** Height in feet (drives alpha/energy). */
    heightFt: number;
  }

  export interface FlowCell {
    lon: number;
    lat: number;
    /** Unit-ish travel vector (screen-y down). */
    vx: number;
    vy: number;
    /** Normalized advection speed (0..~1.2), from deep-water celerity ~1.56*T. */
    speed: number;
    /** Normalized alpha/energy 0..1, from height^2. */
    alpha: number;
  }

  export interface FlowField {
    cols: number;
    rows: number;
    cells: FlowCell[];
  }

  export interface GeoBounds {
    west: number;
    south: number;
    east: number;
    north: number;
  }

  /**
   * Convert an oceanographic FROM-bearing to a screen-space travel vector.
   * Energy travels in the bearing + 180deg. Screen-y points DOWN, so a swell
   * coming FROM north (0deg) travels south = +y. Returns a unit vector.
   */
  export function degToVector(fromDeg: number): Vec2 {
    const travelDeg = (fromDeg + 180) % 360;
    const rad = (travelDeg * Math.PI) / 180;
    // Compass: 0=N(up,-y in math), 90=E(+x). Screen-y down flips the y sign.
    return {
      x: Math.sin(rad),
      y: Math.cos(rad),
    };
  }

  /** Deep-water group celerity ~ 1.56 * T (m/s). Normalize against a 20s ceiling. */
  function speedFromPeriod(periodS: number): number {
    if (!Number.isFinite(periodS) || periodS <= 0) return 0;
    const celerity = 1.56 * periodS; // m/s
    return Math.min(1.2, celerity / 26); // ~14s -> 0.84, ~20s -> 1.2 (clamped)
  }

  /** Energy ~ H^2. Normalize against a 10ft ceiling, clamp to [0.08, 1]. */
  function alphaFromHeight(heightFt: number): number {
    if (!Number.isFinite(heightFt) || heightFt <= 0) return 0;
    const energy = (heightFt * heightFt) / 100; // 10ft -> 1.0
    return Math.max(0.08, Math.min(1, energy));
  }

  /**
   * Reduce a beach's full partition to the single sample relevant to `layerId`.
   * Returns null when that layer has no usable data at the beach.
   */
  export function partitionToPoint(
    lon: number,
    lat: number,
    partition: SwellPartition,
    layerId: SwellLayerId
  ): BeachPartitionPoint | null {
    if (layerId === "wind") {
      if (partition.windDir == null || partition.windKt == null) return null;
      // Treat wind like a short-period, height-proxied flow: period from kt, height from kt.
      return {
        lon, lat,
        dir: partition.windDir,
        periodS: Math.max(3, partition.windKt * 0.4),
        heightFt: Math.max(0.5, partition.windKt * 0.12),
      };
    }
    if (layerId === "s2") {
      if (partition.s2Dir == null) return null;
      return {
        lon, lat,
        dir: partition.s2Dir,
        periodS: partition.s2PeriodS ?? 8,
        heightFt: partition.s2HeightFt ?? 1,
      };
    }
    // "s1" and "combined" both anchor on the primary swell.
    if (partition.s1Dir == null) return null;
    return {
      lon, lat,
      dir: partition.s1Dir,
      periodS: partition.s1PeriodS ?? 12,
      heightFt: partition.s1HeightFt ?? 2,
    };
  }

  /**
   * Build a coarse `resolution x resolution` IDW-interpolated flow field over
   * `bounds`. Pure: no DOM, no GL. `power=2` inverse-distance weighting.
   */
  export function buildFlowField(
    points: BeachPartitionPoint[],
    bounds: GeoBounds,
    resolution: number
  ): FlowField {
    const cols = Math.max(2, Math.floor(resolution));
    const rows = cols;
    if (points.length === 0) {
      return { cols, rows, cells: [] };
    }

    const cells: FlowCell[] = [];
    const lonSpan = bounds.east - bounds.west;
    const latSpan = bounds.north - bounds.south;
    const POWER = 2;
    const EPS = 1e-9;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lon = bounds.west + (lonSpan * c) / (cols - 1);
        const lat = bounds.south + (latSpan * r) / (rows - 1);

        let wSum = 0;
        let vx = 0;
        let vy = 0;
        let speed = 0;
        let alpha = 0;

        for (const p of points) {
          const dLon = lon - p.lon;
          const dLat = lat - p.lat;
          const dist2 = dLon * dLon + dLat * dLat;
          const w = 1 / Math.pow(dist2 + EPS, POWER / 2);
          const vec = degToVector(p.dir);
          vx += w * vec.x;
          vy += w * vec.y;
          speed += w * speedFromPeriod(p.periodS);
          alpha += w * alphaFromHeight(p.heightFt);
          wSum += w;
        }

        const inv = wSum > 0 ? 1 / wSum : 0;
        // Re-normalize the blended direction to a unit vector (magnitude carries via speed).
        let nvx = vx * inv;
        let nvy = vy * inv;
        const mag = Math.hypot(nvx, nvy);
        if (mag > EPS) {
          nvx /= mag;
          nvy /= mag;
        } else {
          nvx = 0;
          nvy = 0;
        }

        cells.push({
          lon,
          lat,
          vx: nvx,
          vy: nvy,
          speed: speed * inv,
          alpha: alpha * inv,
        });
      }
    }

    return { cols, rows, cells };
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  yarn test:unit __tests__/components/map/swell-field/field-sampler.test.ts
  ```
  Expected: PASS (all describe blocks green). If the IDW midpoint test fails because the grid does not land a cell exactly on (-117.2, 32.7), the `resolution: 3` over `[-117.3, -117.1]` puts a column at the exact midpoint — confirm `cols-1 === 2` denominator yields lon `-117.2` for `c=1`.

- [ ] **Step 5: Lint + commit.**
  ```bash
  npx eslint --max-warnings=0 components/map/swell-field/field-sampler.ts __tests__/components/map/swell-field/field-sampler.test.ts
  git add components/map/swell-field/field-sampler.ts __tests__/components/map/swell-field/field-sampler.test.ts
  git commit -m "feat(map): add pure swell flow-field sampler"
  ```

---

### Task 6: Mapbox CustomLayerInterface WebGL particle layer

**Files:**
- Create: `components/map/swell-field/swell-particle-layer.ts`
- Test: `__tests__/components/map/swell-field/swell-particle-layer.test.ts`

- [ ] **Step 1: Write the failing test (pure exports only — GL render is validated in B3 Playwright).** Create `__tests__/components/map/swell-field/swell-particle-layer.test.ts`:
  ```ts
  import {
    PARTICLE_VERTEX_SHADER,
    PARTICLE_FRAGMENT_SHADER,
    SHADER_UNIFORM_NAMES,
    reseedParticle,
    PARTICLE_COUNT_DESKTOP,
    PARTICLE_COUNT_MOBILE,
    resolveParticleCount,
  } from "@/components/map/swell-field/swell-particle-layer";

  describe("swell particle layer — pure exports", () => {
    it("exposes GLSL sources referencing the declared uniforms", () => {
      expect(PARTICLE_VERTEX_SHADER).toContain("attribute");
      expect(PARTICLE_VERTEX_SHADER).toContain("u_matrix");
      expect(PARTICLE_FRAGMENT_SHADER).toContain("gl_FragColor");
      for (const name of SHADER_UNIFORM_NAMES) {
        const inAny =
          PARTICLE_VERTEX_SHADER.includes(name) ||
          PARTICLE_FRAGMENT_SHADER.includes(name);
        expect(inAny).toBe(true);
      }
    });

    it("reseedParticle returns coords inside the unit Mercator bounds", () => {
      const rng = () => 0.5;
      const p = reseedParticle(rng, { minX: 0.1, minY: 0.2, maxX: 0.3, maxY: 0.4 });
      expect(p.x).toBeCloseTo(0.2, 6);
      expect(p.y).toBeCloseTo(0.3, 6);
      expect(p.age).toBe(0);
    });

    it("scales particle count down on small screens", () => {
      expect(resolveParticleCount(1440)).toBe(PARTICLE_COUNT_DESKTOP);
      expect(resolveParticleCount(380)).toBe(PARTICLE_COUNT_MOBILE);
      expect(PARTICLE_COUNT_MOBILE).toBeLessThan(PARTICLE_COUNT_DESKTOP);
    });
  });
  ```

- [ ] **Step 2: Run it — expect FAIL (module missing).**
  ```bash
  yarn test:unit __tests__/components/map/swell-field/swell-particle-layer.test.ts
  ```
  Expected: FAIL — cannot find module `swell-particle-layer`.

- [ ] **Step 3: Implement the custom layer.** Create `components/map/swell-field/swell-particle-layer.ts`:
  ```ts
  import mapboxgl from "mapbox-gl";
  import type { FlowField } from "@/components/map/swell-field/field-sampler";

  export interface MercatorBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  export interface ParticleSeed {
    x: number;
    y: number;
    age: number;
  }

  export const PARTICLE_COUNT_DESKTOP = 2400;
  export const PARTICLE_COUNT_MOBILE = 700;

  /** Below this CSS width we treat the device as small and cut particle count. */
  const SMALL_SCREEN_PX = 640;

  export function resolveParticleCount(viewportWidthPx: number): number {
    return viewportWidthPx < SMALL_SCREEN_PX
      ? PARTICLE_COUNT_MOBILE
      : PARTICLE_COUNT_DESKTOP;
  }

  /** Uniform names referenced by the shaders (asserted in unit tests). */
  export const SHADER_UNIFORM_NAMES = ["u_matrix", "u_color", "u_alpha"] as const;

  // Vertex shader: positions arrive as line endpoints already in Mercator [0..1]
  // unit space; the passed mapbox projection matrix (u_matrix) maps them to clip
  // space. a_alpha carries per-vertex trail fade.
  export const PARTICLE_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_pos;
  attribute float a_alpha;
  uniform mat4 u_matrix;
  varying float v_alpha;
  void main() {
    v_alpha = a_alpha;
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  }
  `;

  // Fragment shader: additive trail color, modulated by per-vertex fade and a
  // global u_alpha (reduced-motion / layer dimming).
  export const PARTICLE_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec3 u_color;
  uniform float u_alpha;
  varying float v_alpha;
  void main() {
    gl_FragColor = vec4(u_color, v_alpha * u_alpha);
  }
  `;

  /** Pick a fresh in-box spawn point. `rng` injectable for deterministic tests. */
  export function reseedParticle(rng: () => number, box: MercatorBox): ParticleSeed {
    return {
      x: box.minX + (box.maxX - box.minX) * rng(),
      y: box.minY + (box.maxY - box.minY) * rng(),
      age: 0,
    };
  }

  function compileShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string
  ): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("swell-field: failed to create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`swell-field: shader compile failed: ${log}`);
    }
    return shader;
  }

  function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return [r, g, b];
  }

  /** Sample the flow field for the cell nearest a lng/lat. Returns travel vec + speed. */
  function sampleField(field: FlowField, lon: number, lat: number) {
    if (field.cells.length === 0) return { vx: 0, vy: 0, speed: 0, alpha: 0 };
    let best = field.cells[0];
    let bestD = Infinity;
    for (const cell of field.cells) {
      const d = (cell.lon - lon) ** 2 + (cell.lat - lat) ** 2;
      if (d < bestD) {
        bestD = d;
        best = cell;
      }
    }
    return best;
  }

  export interface SwellParticleLayerOptions {
    id: string;
    /** Returns the current flow field (re-read each frame so timeline scrubs apply). */
    getField: () => FlowField;
    /** Hex accent for the active layer. */
    getColorHex: () => string;
    /** When true: render ONE static frame, never triggerRepaint. */
    reducedMotion: boolean;
    /** CSS viewport width for particle-count scaling. */
    viewportWidthPx: number;
  }

  /**
   * Build a Mapbox CustomLayerInterface that advects additive particle trails
   * through the swell flow field, locked to geography via Mercator coordinates.
   */
  export function createSwellParticleLayer(
    options: SwellParticleLayerOptions
  ): mapboxgl.CustomLayerInterface {
    const count = resolveParticleCount(options.viewportWidthPx);
    let program: WebGLProgram | null = null;
    let posBuffer: WebGLBuffer | null = null;
    let alphaBuffer: WebGLBuffer | null = null;
    let aPosLoc = -1;
    let aAlphaLoc = -1;
    let uMatrixLoc: WebGLUniformLocation | null = null;
    let uColorLoc: WebGLUniformLocation | null = null;
    let uAlphaLoc: WebGLUniformLocation | null = null;
    let mapRef: mapboxgl.Map | null = null;

    // Particle state in Mercator unit space [0..1].
    const px = new Float32Array(count);
    const py = new Float32Array(count);
    const page = new Float32Array(count);
    const life = new Float32Array(count);
    // Two vertices per particle (trail segment); 2 floats pos + 1 float alpha each.
    const vertexPos = new Float32Array(count * 2 * 2);
    const vertexAlpha = new Float32Array(count * 2);

    const rng = Math.random;
    const SPEED_SCALE = 0.0008; // Mercator-unit step per frame at speed=1.

    function viewBoxMercator(map: mapboxgl.Map): MercatorBox {
      const b = map.getBounds();
      const sw = mapboxgl.MercatorCoordinate.fromLngLat({
        lng: b.getWest(),
        lat: b.getSouth(),
      });
      const ne = mapboxgl.MercatorCoordinate.fromLngLat({
        lng: b.getEast(),
        lat: b.getNorth(),
      });
      return {
        minX: Math.min(sw.x, ne.x),
        maxX: Math.max(sw.x, ne.x),
        minY: Math.min(sw.y, ne.y),
        maxY: Math.max(sw.y, ne.y),
      };
    }

    function seedAll(map: mapboxgl.Map): void {
      const box = viewBoxMercator(map);
      for (let i = 0; i < count; i += 1) {
        const s = reseedParticle(rng, box);
        px[i] = s.x;
        py[i] = s.y;
        page[i] = Math.floor(rng() * 60);
        life[i] = 40 + Math.floor(rng() * 60);
      }
    }

    function advanceAndFill(map: mapboxgl.Map): void {
      const field = options.getField();
      const box = viewBoxMercator(map);
      for (let i = 0; i < count; i += 1) {
        const prevX = px[i];
        const prevY = py[i];
        // Convert this particle's Mercator pos back to lng/lat to sample the geo field.
        const merc = new mapboxgl.MercatorCoordinate(px[i], py[i]);
        const ll = merc.toLngLat();
        const cell = sampleField(field, ll.lng, ll.lat);
        const step = SPEED_SCALE * (0.25 + cell.speed);
        // Screen-y down maps to +Mercator-y down, so vy sign is consistent.
        px[i] += cell.vx * step;
        py[i] += cell.vy * step;
        page[i] += 1;

        const out =
          px[i] < box.minX ||
          px[i] > box.maxX ||
          py[i] < box.minY ||
          py[i] > box.maxY ||
          page[i] > life[i];
        if (out) {
          const s = reseedParticle(rng, box);
          px[i] = s.x;
          py[i] = s.y;
          page[i] = 0;
          // Zero-length segment on respawn so we don't draw a jump streak.
          vertexPos[i * 4 + 0] = px[i];
          vertexPos[i * 4 + 1] = py[i];
          vertexPos[i * 4 + 2] = px[i];
          vertexPos[i * 4 + 3] = py[i];
          vertexAlpha[i * 2 + 0] = 0;
          vertexAlpha[i * 2 + 1] = 0;
          continue;
        }

        const fade = Math.min(1, cell.alpha) * (1 - page[i] / life[i]);
        vertexPos[i * 4 + 0] = prevX;
        vertexPos[i * 4 + 1] = prevY;
        vertexPos[i * 4 + 2] = px[i];
        vertexPos[i * 4 + 3] = py[i];
        vertexAlpha[i * 2 + 0] = 0;
        vertexAlpha[i * 2 + 1] = fade;
      }
    }

    return {
      id: options.id,
      type: "custom",
      renderingMode: "2d",

      onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
        mapRef = map;
        const vs = compileShader(gl, gl.VERTEX_SHADER, PARTICLE_VERTEX_SHADER);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, PARTICLE_FRAGMENT_SHADER);
        const prog = gl.createProgram();
        if (!prog) throw new Error("swell-field: failed to create program");
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          const log = gl.getProgramInfoLog(prog);
          throw new Error(`swell-field: program link failed: ${log}`);
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        program = prog;

        aPosLoc = gl.getAttribLocation(prog, "a_pos");
        aAlphaLoc = gl.getAttribLocation(prog, "a_alpha");
        uMatrixLoc = gl.getUniformLocation(prog, "u_matrix");
        uColorLoc = gl.getUniformLocation(prog, "u_color");
        uAlphaLoc = gl.getUniformLocation(prog, "u_alpha");

        posBuffer = gl.createBuffer();
        alphaBuffer = gl.createBuffer();
        seedAll(map);
      },

      render(gl: WebGLRenderingContext, matrix: number[]) {
        if (!program || !mapRef) return;
        advanceAndFill(mapRef);

        gl.useProgram(program);
        gl.uniformMatrix4fv(uMatrixLoc, false, matrix);
        const [r, g, b] = hexToRgb(options.getColorHex());
        gl.uniform3f(uColorLoc, r, g, b);
        gl.uniform1f(uAlphaLoc, options.reducedMotion ? 0.5 : 0.85);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive trails

        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexPos, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aPosLoc);
        gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexAlpha, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aAlphaLoc);
        gl.vertexAttribPointer(aAlphaLoc, 1, gl.FLOAT, false, 0, 0);

        gl.lineWidth(1);
        gl.drawArrays(gl.LINES, 0, count * 2);

        // Animate only when motion is allowed. Under reduced motion we draw a
        // single static frame and never request another.
        if (!options.reducedMotion) {
          mapRef.triggerRepaint();
        }
      },

      onRemove(_map: mapboxgl.Map, gl: WebGLRenderingContext) {
        if (program) gl.deleteProgram(program);
        if (posBuffer) gl.deleteBuffer(posBuffer);
        if (alphaBuffer) gl.deleteBuffer(alphaBuffer);
        program = null;
        posBuffer = null;
        alphaBuffer = null;
        mapRef = null;
      },
    };
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  yarn test:unit __tests__/components/map/swell-field/swell-particle-layer.test.ts
  ```
  Expected: PASS (pure exports verified; no GL context needed in Jest).

- [ ] **Step 5: Typecheck + lint + commit.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  npx eslint --max-warnings=0 components/map/swell-field/swell-particle-layer.ts __tests__/components/map/swell-field/swell-particle-layer.test.ts
  git add components/map/swell-field/swell-particle-layer.ts __tests__/components/map/swell-field/swell-particle-layer.test.ts
  git commit -m "feat(map): add WebGL swell particle CustomLayer"
  ```

> **Reality note:** This WebGL layer replaces the prototype's screen-space `runCanvasParticleFallback` (`surf-map-prototype.tsx:282`) as the production renderer. The Canvas-2D path is retained ONLY as the documented no-WebGL fallback for browsers where `mapboxgl.supported()` is false; it is not wired into `/map` by this plan.

---

## PHASE B3 — /map INTEGRATION (UI + theming + tests)

### Task 7: On-brand layer selector + forecast timeline controls

**Files:**
- Create: `components/map/swell-field/swell-layer-selector.tsx`
- Create: `components/map/swell-field/swell-forecast-timeline.tsx`

- [ ] **Step 1: Build the layer selector.** Create `components/map/swell-field/swell-layer-selector.tsx`:
  ```tsx
  "use client";

  import type { ReactElement } from "react";
  import {
    SWELL_LAYER_COLOR,
    SWELL_MAP_SURFACE,
    SWELL_MAP_STICKER_SHADOW,
    SWELL_MAP_STICKER_RADIUS,
    type SwellLayerId,
  } from "@/components/map/swell-map-theme";

  const LAYERS: Array<{ id: SwellLayerId; label: string }> = [
    { id: "s1", label: "Primary" },
    { id: "s2", label: "Secondary" },
    { id: "wind", label: "Wind" },
    { id: "combined", label: "Combined" },
  ];

  interface SwellLayerSelectorProps {
    active: SwellLayerId;
    onChange: (id: SwellLayerId) => void;
  }

  export function SwellLayerSelector({
    active,
    onChange,
  }: SwellLayerSelectorProps): ReactElement {
    return (
      <div
        data-testid="swell-layer-selector"
        className="pointer-events-auto absolute right-3 top-3 z-10 flex flex-col gap-1.5 p-2"
        style={{
          background: SWELL_MAP_SURFACE.panel,
          border: `1px solid ${SWELL_MAP_SURFACE.border}`,
          borderRadius: SWELL_MAP_STICKER_RADIUS,
          boxShadow: SWELL_MAP_STICKER_SHADOW,
        }}
      >
        <span className="font-heading text-[10px] uppercase tracking-wide text-white/70">
          Swell field
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {LAYERS.map((layer) => {
            const isActive = layer.id === active;
            return (
              <button
                key={layer.id}
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-pressed={isActive}
                data-testid={`swell-layer-${layer.id}`}
                onClick={() => onChange(layer.id)}
                className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={{
                  background: isActive
                    ? SWELL_MAP_SURFACE.panelDeep
                    : "transparent",
                }}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: SWELL_LAYER_COLOR[layer.id] }}
                />
                {layer.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Build the forecast timeline.** Create `components/map/swell-field/swell-forecast-timeline.tsx`:
  ```tsx
  "use client";

  import type { ReactElement } from "react";
  import {
    SWELL_MAP_SURFACE,
    SWELL_MAP_STICKER_SHADOW,
    SWELL_MAP_STICKER_RADIUS,
    SWELL_MAP_CTA_CLASS,
  } from "@/components/map/swell-map-theme";

  interface SwellForecastTimelineProps {
    /** Discrete forecast-hour labels, e.g. ["Now", "+3h", "+6h", ...]. */
    steps: string[];
    index: number;
    onIndexChange: (index: number) => void;
  }

  export function SwellForecastTimeline({
    steps,
    index,
    onIndexChange,
  }: SwellForecastTimelineProps): ReactElement | null {
    if (steps.length === 0) return null;
    const clamped = Math.min(Math.max(index, 0), steps.length - 1);
    return (
      <div
        data-testid="swell-forecast-timeline"
        className="pointer-events-auto absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 px-3 py-2"
        style={{
          background: SWELL_MAP_SURFACE.panel,
          border: `1px solid ${SWELL_MAP_SURFACE.border}`,
          borderRadius: SWELL_MAP_STICKER_RADIUS,
          boxShadow: SWELL_MAP_STICKER_SHADOW,
        }}
      >
        <button
          type="button"
          aria-label="Previous forecast step"
          disabled={clamped === 0}
          onClick={() => onIndexChange(clamped - 1)}
          className={`rounded-sm px-2 py-1 text-xs disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${SWELL_MAP_CTA_CLASS}`}
        >
          ‹
        </button>
        <input
          type="range"
          min={0}
          max={steps.length - 1}
          step={1}
          value={clamped}
          aria-label="Forecast time"
          data-testid="swell-timeline-range"
          onChange={(e) => onIndexChange(Number(e.target.value))}
          className="h-1 w-40 cursor-pointer accent-[#F78E42]"
        />
        <span className="font-mono text-xs tabular-nums text-white">
          {steps[clamped]}
        </span>
        <button
          type="button"
          aria-label="Next forecast step"
          disabled={clamped === steps.length - 1}
          onClick={() => onIndexChange(clamped + 1)}
          className={`rounded-sm px-2 py-1 text-xs disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${SWELL_MAP_CTA_CLASS}`}
        >
          ›
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 3: Typecheck + lint + commit.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  npx eslint --max-warnings=0 components/map/swell-field/swell-layer-selector.tsx components/map/swell-field/swell-forecast-timeline.tsx
  git add components/map/swell-field/swell-layer-selector.tsx components/map/swell-field/swell-forecast-timeline.tsx
  git commit -m "feat(map): add on-brand swell layer selector and timeline"
  ```

---

### Task 8: Wire the custom layer + controls into InteractiveMap

**Files:**
- Modify: `components/map/interactive-map.tsx` (props 45-65; `populateLocations` 474-515; layer effect — new; render 962-969)

- [ ] **Step 1: Read the current render site + populateLocations before editing.** Re-read `components/map/interactive-map.tsx` lines 104-118 (destructured props), 474-515 (`populateLocations`), and 962-970 (render). Confirm line numbers have not shifted from prior tasks (only `map-beach-loader.ts` and the API changed — this file is untouched so far).

- [ ] **Step 2: Add imports.** After the existing `loadBeachesAndWaveHeights` import block (lines 28-31) add:
  ```ts
  import type { SwellPartition } from "@/app/api/forecasts/bulk/route";
  import type { SwellLayerId } from "@/components/map/swell-map-theme";
  import {
    buildFlowField,
    partitionToPoint,
    type BeachPartitionPoint,
    type FlowField,
  } from "@/components/map/swell-field/field-sampler";
  import { createSwellParticleLayer } from "@/components/map/swell-field/swell-particle-layer";
  import { SWELL_LAYER_COLOR } from "@/components/map/swell-map-theme";
  import { SwellLayerSelector } from "@/components/map/swell-field/swell-layer-selector";
  import { SwellForecastTimeline } from "@/components/map/swell-field/swell-forecast-timeline";
  import { useReducedMotion } from "@/hooks/use-reduced-motion";
  ```

- [ ] **Step 3: Extend the props interface.** In `InteractiveMapProps` (after `clusterClickBehavior`, line 64) add:
  ```ts
    showSwellField?: boolean;
    swellLayerId?: SwellLayerId;
    onSwellLayerChange?: (id: SwellLayerId) => void;
    /** Forecast-step labels for the timeline scrubber (e.g. ["Now","+3h"]). */
    swellTimelineSteps?: string[];
    swellTimelineIndex?: number;
    onSwellTimelineChange?: (index: number) => void;
  ```
  And destructure them in the component signature (after `clusterClickBehavior = "expand",`, line 117):
  ```ts
    showSwellField = false,
    swellLayerId = "s1",
    onSwellLayerChange,
    swellTimelineSteps = [],
    swellTimelineIndex = 0,
    onSwellTimelineChange,
  ```

- [ ] **Step 4: Add partition state + reduced-motion + a field ref.** After the `conditionSummaryMap` state (line 145) add:
  ```ts
  const [partitionsMap, setPartitionsMap] = useState<Map<string, SwellPartition>>(new Map());
  const reducedMotion = useReducedMotion();
  // Live flow field read by the GL layer each frame (avoids re-adding the layer on scrub).
  const flowFieldRef = useRef<FlowField>({ cols: 0, rows: 0, cells: [] });
  const swellLayerIdRef = useRef<SwellLayerId>(swellLayerId);
  ```

- [ ] **Step 5: Capture partitions in populateLocations.** In `populateLocations`, after `setConditionSummaryMap(result.conditionSummaryMap);` (line 507) add:
  ```ts
  setPartitionsMap(result.partitionsMap);
  ```

- [ ] **Step 6: Recompute the flow field whenever inputs change.** After the `populateLocations` ref-sync effect (lines 517-519) add a new effect:
  ```ts
  useEffect(() => {
    swellLayerIdRef.current = swellLayerId;
  }, [swellLayerId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !showSwellField) {
      flowFieldRef.current = { cols: 0, rows: 0, cells: [] };
      return;
    }
    const beachList = beaches && beaches.length > 0 ? beaches : [];
    const points: BeachPartitionPoint[] = [];
    for (const beach of beachList) {
      const partition = partitionsMap.get(beach.id);
      if (!partition || beach.lat == null || beach.lon == null) continue;
      const point = partitionToPoint(beach.lon, beach.lat, partition, swellLayerId);
      if (point) points.push(point);
    }
    const b = map.getBounds();
    flowFieldRef.current = buildFlowField(
      points,
      {
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      },
      12
    );
    // Nudge a repaint so a static (reduced-motion) frame reflects the new field.
    map.triggerRepaint();
  }, [partitionsMap, swellLayerId, swellTimelineIndex, isMapReady, showSwellField, beaches, mapBounds]);
  ```

- [ ] **Step 7: Add/remove the custom layer.** Add another effect right below Step 6's:
  ```ts
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;
    const layerId = "quiver-swell-field";

    if (!showSwellField) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      return;
    }

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    const viewportWidthPx =
      typeof window !== "undefined" ? window.innerWidth : 1024;
    map.addLayer(
      createSwellParticleLayer({
        id: layerId,
        getField: () => flowFieldRef.current,
        getColorHex: () => SWELL_LAYER_COLOR[swellLayerIdRef.current],
        reducedMotion,
        viewportWidthPx,
      })
    );

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    };
    // Re-add only when toggled, motion preference flips, or the map (re)mounts.
  }, [showSwellField, isMapReady, reducedMotion]);
  ```

- [ ] **Step 8: Mount the controls in the render.** Change the return (lines 962-969) to:
  ```tsx
  return (
    <div
      ref={mapContainerRef}
      className={`${className} mapbox-container relative overflow-hidden`}
      style={{ width: "100%", height: "100%" }}
    >
      {displayMode === "wave-height" && <MapConditionLegend />}
      {showSwellField && onSwellLayerChange && (
        <SwellLayerSelector active={swellLayerId} onChange={onSwellLayerChange} />
      )}
      {showSwellField && onSwellTimelineChange && swellTimelineSteps.length > 0 && (
        <SwellForecastTimeline
          steps={swellTimelineSteps}
          index={swellTimelineIndex}
          onIndexChange={onSwellTimelineChange}
        />
      )}
    </div>
  );
  ```

- [ ] **Step 9: Typecheck + blast-radius unit tests.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  yarn test:unit __tests__/components/map/map-content.test.tsx __tests__/components/map/map-forecast-basic.test.tsx __tests__/components/map/map-condition-summary.test.ts __tests__/components/location/location-map.test.tsx __tests__/components/city/city-map-view.test.tsx
  ```
  Expected: typecheck clean (new props are optional, so existing `<InteractiveMap>` callers compile unchanged); all listed specs still PASS (swell props default off).

- [ ] **Step 10: Lint + commit.**
  ```bash
  npx eslint --max-warnings=0 components/map/interactive-map.tsx
  git add components/map/interactive-map.tsx
  git commit -m "feat(map): add swell flow-field layer and controls to InteractiveMap"
  ```

---

### Task 9: Thread swell-field props through the /map render chain

**Files:**
- Modify: `components/map/map-content.tsx` (props interface 16-…; `<InteractiveMap>` line 207)
- Modify: `components/map-view.tsx` (state + `<MapContent>` line 388)

- [ ] **Step 1: Grep + read the real render site before editing.** Confirm the chain with:
  ```bash
  grep -n "InteractiveMap" components/map/map-content.tsx
  grep -n "MapContent" components/map-view.tsx
  ```
  Expected: `<InteractiveMap` at `map-content.tsx:207`; `<MapContent` at `map-view.tsx:388`. Read `map-content.tsx:16-75` (props interface + destructure) and `map-view.tsx:380-410` before editing.

- [ ] **Step 2: Extend MapContentProps + pass through.** In `components/map/map-content.tsx`, add to `MapContentProps` (after `onWaveHeightsChange?`, ~line 41):
  ```ts
    showSwellField?: boolean;
    swellLayerId?: import("@/components/map/swell-map-theme").SwellLayerId;
    onSwellLayerChange?: (id: import("@/components/map/swell-map-theme").SwellLayerId) => void;
    swellTimelineSteps?: string[];
    swellTimelineIndex?: number;
    onSwellTimelineChange?: (index: number) => void;
  ```
  Destructure them in the component params (alongside `onWaveHeightsChange`, ~line 72), then forward to `<InteractiveMap>` (line 207-219) by adding inside the JSX props:
  ```tsx
              showSwellField={showSwellField}
              swellLayerId={swellLayerId}
              onSwellLayerChange={onSwellLayerChange}
              swellTimelineSteps={swellTimelineSteps}
              swellTimelineIndex={swellTimelineIndex}
              onSwellTimelineChange={onSwellTimelineChange}
  ```

- [ ] **Step 3: Own the UI state in map-view.** In `components/map-view.tsx`, add state near the other view state (top of the component body):
  ```ts
  const [showSwellField, setShowSwellField] = useState(false);
  const [swellLayerId, setSwellLayerId] = useState<import("@/components/map/swell-map-theme").SwellLayerId>("s1");
  const [swellTimelineIndex, setSwellTimelineIndex] = useState(0);
  const swellTimelineSteps = useMemo(() => ["Now", "+3h", "+6h", "+9h", "+12h"], []);
  ```
  (Ensure `useState`/`useMemo` are imported — they almost certainly already are; verify the existing import line.) Then pass to `<MapContent>` (line 388-...):
  ```tsx
            showSwellField={showSwellField}
            swellLayerId={swellLayerId}
            onSwellLayerChange={setSwellLayerId}
            swellTimelineSteps={swellTimelineSteps}
            swellTimelineIndex={swellTimelineIndex}
            onSwellTimelineChange={setSwellTimelineIndex}
  ```

- [ ] **Step 4: Add a toggle entry point.** In `components/map-view.tsx`, add an on-brand toggle button near the existing map controls (reuse `SWELL_MAP_CTA_CLASS`). Minimal version, mount inside the map header/controls area:
  ```tsx
  <button
    type="button"
    aria-pressed={showSwellField}
    data-testid="swell-field-toggle"
    onClick={() => setShowSwellField((v) => !v)}
    className={`rounded-md px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${SWELL_MAP_CTA_CLASS}`}
  >
    {showSwellField ? "Hide swell field" : "Show swell field"}
  </button>
  ```
  Add the import at top of `map-view.tsx`:
  ```ts
  import { SWELL_MAP_CTA_CLASS } from "@/components/map/swell-map-theme";
  ```
  (Place the button where the existing display-mode controls live; read the surrounding JSX first so it lands in the controls row, not floating.)

- [ ] **Step 5: Typecheck + blast-radius tests.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  yarn test:unit __tests__/components/map/map-content.test.tsx
  ```
  Expected: typecheck clean; `map-content.test.tsx` still PASS (new props optional).

- [ ] **Step 6: Lint + commit.**
  ```bash
  npx eslint --max-warnings=0 components/map/map-content.tsx components/map-view.tsx
  git add components/map/map-content.tsx components/map-view.tsx
  git commit -m "feat(map): wire swell-field toggle through /map render chain"
  ```

---

### Task 10: Playwright E2E for the swell field on /map

**Files:**
- Create: `e2e/map-swell-field.spec.ts`

- [ ] **Step 1: Identify the blast-radius E2E specs to run alongside.** Run:
  ```bash
  grep -rln "interactive-map\|map-content\|__quiverMapInstance\|map-container" e2e/ | sort -u
  ```
  Expected hits include `e2e/map.spec.ts`, `e2e/map-use-near-me.spec.ts`, `e2e/map-coordinate-validation.spec.ts`. These exercise the same `/map` page and MUST still pass after this change — run them in Step 5.

- [ ] **Step 2: Write the spec.** Create `e2e/map-swell-field.spec.ts`:
  ```ts
  import { test, expect } from "@playwright/test";
  import { setupErrorDetection, assertNoErrors } from "./utils/error-detection";

  async function waitForMapInstance(page: import("@playwright/test").Page) {
    await page.waitForFunction(
      () => Boolean((window as unknown as { __quiverMapInstance?: unknown }).__quiverMapInstance),
      { timeout: 30000 }
    );
  }

  async function layerExists(page: import("@playwright/test").Page): Promise<boolean> {
    return page.evaluate(() => {
      const map = (window as unknown as { __quiverMapInstance?: { getLayer: (id: string) => unknown } }).__quiverMapInstance;
      return Boolean(map && map.getLayer("quiver-swell-field"));
    });
  }

  for (const viewport of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test.describe(`swell field — ${viewport.name}`, () => {
      let errorCapture: Awaited<ReturnType<typeof setupErrorDetection>>;

      test.beforeEach(async ({ page }) => {
        errorCapture = await setupErrorDetection(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test.afterEach(async ({ page }) => {
        await assertNoErrors(page, errorCapture);
      });

      test("toggles the swell field layer on and off", async ({ page }) => {
        await page.goto("/map");
        await page.waitForLoadState("load");
        await waitForMapInstance(page);

        expect(await layerExists(page)).toBe(false);
        await page.getByTestId("swell-field-toggle").click();
        await expect(page.getByTestId("swell-layer-selector")).toBeVisible();
        await page.waitForFunction(
          () => {
            const map = (window as unknown as { __quiverMapInstance?: { getLayer: (id: string) => unknown } }).__quiverMapInstance;
            return Boolean(map && map.getLayer("quiver-swell-field"));
          },
          { timeout: 10000 }
        );

        await page.getByTestId("swell-field-toggle").click();
        await expect(page.getByTestId("swell-layer-selector")).toHaveCount(0);
      });

      test("switches layers without console errors", async ({ page }) => {
        await page.goto("/map");
        await page.waitForLoadState("load");
        await waitForMapInstance(page);
        await page.getByTestId("swell-field-toggle").click();
        await expect(page.getByTestId("swell-layer-selector")).toBeVisible();

        await page.getByTestId("swell-layer-wind").click();
        await expect(page.getByTestId("swell-layer-wind")).toHaveAttribute("aria-checked", "true");
        await page.getByTestId("swell-layer-s2").click();
        await expect(page.getByTestId("swell-layer-s2")).toHaveAttribute("aria-checked", "true");
        expect(await layerExists(page)).toBe(true);
      });

      test("animates when motion allowed, static under reduced motion", async ({ browser }) => {
        // Motion allowed.
        const ctx1 = await browser.newContext({ reducedMotion: "no-preference", viewport });
        const page1 = await ctx1.newPage();
        const cap1 = await setupErrorDetection(page1);
        await page1.goto("/map");
        await page1.waitForLoadState("load");
        await waitForMapInstance(page1);
        await page1.getByTestId("swell-field-toggle").click();
        await page1.waitForFunction(
          () => Boolean((window as unknown as { __quiverMapInstance?: { getLayer: (id: string) => unknown } }).__quiverMapInstance?.getLayer("quiver-swell-field")),
          { timeout: 10000 }
        );
        const a = await page1.locator("canvas.mapboxgl-canvas").first().screenshot();
        // eslint-disable-next-line playwright/no-wait-for-timeout -- need two frames apart to observe animation
        await page1.waitForTimeout(900);
        const b = await page1.locator("canvas.mapboxgl-canvas").first().screenshot();
        expect(Buffer.compare(a, b)).not.toBe(0); // frames differ -> animating
        await assertNoErrors(page1, cap1);
        await ctx1.close();

        // Reduced motion.
        const ctx2 = await browser.newContext({ reducedMotion: "reduce", viewport });
        const page2 = await ctx2.newPage();
        const cap2 = await setupErrorDetection(page2);
        await page2.goto("/map");
        await page2.waitForLoadState("load");
        await waitForMapInstance(page2);
        await page2.getByTestId("swell-field-toggle").click();
        await page2.waitForFunction(
          () => Boolean((window as unknown as { __quiverMapInstance?: { getLayer: (id: string) => unknown } }).__quiverMapInstance?.getLayer("quiver-swell-field")),
          { timeout: 10000 }
        );
        const c = await page2.locator("canvas.mapboxgl-canvas").first().screenshot();
        // eslint-disable-next-line playwright/no-wait-for-timeout -- confirm NO change over time under reduced motion
        await page2.waitForTimeout(900);
        const d = await page2.locator("canvas.mapboxgl-canvas").first().screenshot();
        expect(Buffer.compare(c, d)).toBe(0); // identical -> static
        await assertNoErrors(page2, cap2);
        await ctx2.close();
      });
    });
  }
  ```

- [ ] **Step 3: Verify the error-detection helper exports match.** Run:
  ```bash
  grep -n "export" e2e/utils/error-detection.ts | grep -iE "setupErrorDetection|assertNoErrors"
  ```
  Expected: both exported. If the signatures differ from `(page)` / `(page, capture)`, adjust the spec's calls to match the real helper before running.

- [ ] **Step 4: Run the new spec.**
  ```bash
  npx playwright test e2e/map-swell-field.spec.ts
  ```
  Expected: PASS on desktop + mobile projects. If the animation pixel-hash is flaky because the map style tiles are still loading, gate the first screenshot on `page.waitForFunction(() => window.__quiverMapInstance.isStyleLoaded())` before sampling.

- [ ] **Step 5: Run the blast-radius E2E specs (same page).**
  ```bash
  npx playwright test e2e/map.spec.ts e2e/map-use-near-me.spec.ts e2e/map-coordinate-validation.spec.ts
  ```
  Expected: all still PASS — the swell field defaults OFF, so existing `/map` behavior is unchanged.

- [ ] **Step 6: Commit.**
  ```bash
  git add e2e/map-swell-field.spec.ts
  git commit -m "test(map): e2e for swell flow-field toggle, layers, reduced motion"
  ```

---

### Task 11: Final verification + CHANGELOG

**Files:**
- Modify: `CHANGELOG.md` (under `[Unreleased]`)

- [ ] **Step 1: Full typecheck + lint of every touched file.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  npx eslint --max-warnings=0 \
    app/api/forecasts/bulk/route.ts \
    components/map/map-beach-loader.ts \
    components/map/swell-field/field-sampler.ts \
    components/map/swell-field/swell-particle-layer.ts \
    components/map/swell-field/swell-layer-selector.tsx \
    components/map/swell-field/swell-forecast-timeline.tsx \
    components/map/interactive-map.tsx \
    components/map/map-content.tsx \
    components/map-view.tsx
  ```
  Expected: clean.

- [ ] **Step 2: Run the full unit blast radius once more.**
  ```bash
  yarn test:unit __tests__/app/api/forecasts/bulk __tests__/components/map
  ```
  Expected: all PASS.

- [ ] **Step 3: Update CHANGELOG.** Add under `[Unreleased]` → `Added`:
  ```
  - Animated swell/wind flow-field layer on /map (WebGL Mapbox custom layer), with on-brand layer selector and forecast timeline; honors prefers-reduced-motion. Bulk forecast API now emits per-beach swell/wind partitions.
  ```

- [ ] **Step 4: Commit.**
  ```bash
  git add CHANGELOG.md
  git commit -m "docs(map): changelog for swell flow-field on /map"
  ```

---

## Self-Review Checklist

| Review finding / requirement | Addressed by |
|------------------------------|--------------|
| Bulk route SELECTs partition columns but never emits them (the core gap) | Task 3 (Steps 4-6) — `rowToSwellPartition` + `swellPartitions` in success/empty responses |
| Swell-height unit (m vs ft) must be confirmed against real data, not assumed | Task 2 (SQL verification gate) feeding Task 3 Step 4 booleans |
| Swell string fields parsed with `Number.parseFloat`, null-safe | Task 3 `parseFiniteFloat`/`parseSwellHeightFt`/`parseWindKt`; tested in Task 3 Step 1 |
| Loader exposes `partitionsMap` mirroring existing forecasts/waterTemps parsing | Task 4 (Steps 3-5), tested Task 4 Step 1 |
| Swell direction is FROM-bearing; travel = +180°; screen-y down | Task 5 `degToVector`, cardinal-case tests in Task 5 Step 1 |
| Speed from deep-water celerity ~1.56·T; alpha from height² | Task 5 `speedFromPeriod`/`alphaFromHeight`, tested Task 5 Step 1 |
| IDW interpolation: single-source returns source vector; midpoint blends | Task 5 `buildFlowField`, tests in Task 5 Step 1 |
| Real Mapbox `CustomLayerInterface` (`type:'custom'`, `renderingMode:'2d'`, `onAdd(map,gl)`, `render(gl,matrix)`, `onRemove`) | Task 6 — full implementation, no pseudocode |
| Full GLSL vertex + fragment shaders, additive blend | Task 6 `PARTICLE_VERTEX_SHADER`/`PARTICLE_FRAGMENT_SHADER`, `gl.blendFunc(SRC_ALPHA, ONE)` |
| Mercator advection via `MercatorCoordinate.fromLngLat` + projection matrix | Task 6 `viewBoxMercator`/`advanceAndFill`, `u_matrix` |
| Animate only when motion allowed; static frame + no triggerRepaint under reduced motion | Task 6 `render()` guard; Task 8 passes `reducedMotion`; verified Task 10 Step 2 |
| Particle count scales down on small screens | Task 6 `resolveParticleCount`, tested Task 6 Step 1 |
| GL cleanup (delete program/buffers) | Task 6 `onRemove` |
| Canvas-2D engine is fallback-only, not the prod renderer | Task 6 Reality note |
| Reuse existing `mapRef`/`isMapReady`; do NOT stand up a second map | Task 8 Steps 6-7 (effects use `mapRef.current`) |
| Add/remove layer on toggle + clean up on unmount | Task 8 Step 7 |
| On-brand controls: opaque navy, sticker shadow/radius, Space Mono values, ocean-blue CTAs, `role=switch`/`aria-pressed`, focus-visible rings | Task 7 (both components use `swell-map-theme` tokens) |
| Do NOT refactor existing `MapConditionLegend` (out of scope) | Untouched — new overlays added as siblings (Task 8 Step 8) |
| Wire data through the REAL parent chain (grep first, then edit) | Task 9 Step 1 grep; chain `map-page-client → map-view → map-content → InteractiveMap` |
| Theme module shared with Plan A, not duplicated | Task 1 (idempotent create/skip) |
| Blast-radius tests on shipped `/map` page + importers | Task 8 Step 9, Task 9 Step 5, Task 10 Steps 1 & 5 |
| Coordinate law (`beach.lat`/`beach.lon`, lon-first into Mapbox) | Task 5 `partitionToPoint(beach.lon, beach.lat, …)`; Task 8 Step 6 |
| E2E uses `setupErrorDetection`/`assertNoErrors`, mobile + desktop, no 500s | Task 10 Step 2 |
| Conventional, atomic commits | Every task's commit step |
