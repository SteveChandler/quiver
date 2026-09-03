import {
  degToVector,
  buildFlowField,
  computeCoastalBounds,
  detectWaterLayerIds,
  interpolateSwellPartition,
  maskFieldToWater,
  waterMaskableFlowComponents,
  partitionToPoint,
  resolveWindParticleCount,
  COASTAL_CORRIDOR_LAT_PAD,
  COASTAL_CORRIDOR_LON_PAD,
  COASTAL_CORRIDOR_MIN_SPAN,
  type BeachPartitionPoint,
  type FlowField,
  type WaterMaskMap,
} from "@/components/map/swell-field/field-sampler";
import type { SwellPartition } from "@/app/api/forecasts/bulk/route";

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

describe("interpolateSwellPartition", () => {
  const partition = (overrides: Partial<SwellPartition>): SwellPartition => ({
    s1Dir: 270,
    s1PeriodS: 12,
    s1HeightFt: 2,
    s2Dir: 180,
    s2PeriodS: 8,
    s2HeightFt: 1,
    windDir: 300,
    windMph: 10,
    ...overrides,
  });

  it("interpolates numeric partition values", () => {
    const result = interpolateSwellPartition(
      partition({ s1PeriodS: 10, s1HeightFt: 2, windMph: 8 }),
      partition({ s1PeriodS: 16, s1HeightFt: 5, windMph: 20 }),
      0.5
    );

    expect(result.s1PeriodS).toBe(13);
    expect(result.s1HeightFt).toBe(3.5);
    expect(result.windMph).toBe(14);
  });

  it("uses the shortest compass arc for directions", () => {
    const result = interpolateSwellPartition(
      partition({ s1Dir: 350, windDir: 10 }),
      partition({ s1Dir: 10, windDir: 350 }),
      0.5
    );

    expect(result.s1Dir).toBeCloseTo(0, 6);
    expect(result.windDir).toBeCloseTo(0, 6);
  });

  it("falls back to the available side when one row is sparse", () => {
    const result = interpolateSwellPartition(
      partition({ s2Dir: null, s2HeightFt: null }),
      partition({ s2Dir: 220, s2HeightFt: 2.5 }),
      0.5
    );

    expect(result.s2Dir).toBe(220);
    expect(result.s2HeightFt).toBe(2.5);
  });

  it("interpolates Open-Meteo swell direction across timeline samples", () => {
    const result = interpolateSwellPartition(
      partition({ swellDirOm: 350 }),
      partition({ swellDirOm: 10 }),
      0.5
    );

    expect(result.swellDirOm).toBeCloseTo(0, 6);
  });
});

describe("partitionToPoint", () => {
  const partition = (overrides: Partial<SwellPartition> = {}): SwellPartition => ({
    s1Dir: 270,
    s1PeriodS: 12,
    s1HeightFt: 2,
    s2Dir: 180,
    s2PeriodS: 8,
    s2HeightFt: 1,
    windDir: 300,
    windMph: 10,
    ...overrides,
  });

  it.each(["s1", "combined"] as const)(
    "uses s1Dir before Open-Meteo swell direction for %s",
    (layerId) => {
      const point = partitionToPoint(
        -117.2,
        32.7,
        partition({ swellDirOm: 215, s1Dir: 270 }),
        layerId
      );

      expect(point?.dir).toBe(270);
    }
  );

  it.each([
    ["null", null],
    ["undefined", undefined],
  ] as const)(
    "falls back to s1Dir for s1/combined when swellDirOm is %s",
    (_label, swellDirOm) => {
      for (const layerId of ["s1", "combined"] as const) {
        const point = partitionToPoint(
          -117.2,
          32.7,
          partition({ swellDirOm, s1Dir: 270 }),
          layerId
        );

        expect(point?.dir).toBe(270);
      }
    }
  );
});

describe("buildFlowField", () => {
  const pt = (
    lon: number,
    lat: number,
    dir: number,
    periodS: number,
    heightFt: number
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
    expect(centerRowMid?.lon).toBeCloseTo(-117.2, 6);
    expect(centerRowMid?.lat).toBeCloseTo(32.7, 6);
    expect(Math.abs(centerRowMid?.vx ?? 0)).toBeLessThan(0.2);
  });

  it("speed scales with period and alpha with height^2", () => {
    const slowSmall = buildFlowField(
      [pt(-117.2, 32.7, 270, 6, 1)],
      { west: -117.3, south: 32.6, east: -117.1, north: 32.8 },
      2
    ).cells[0];
    const fastBig = buildFlowField(
      [pt(-117.2, 32.7, 270, 18, 6)],
      { west: -117.3, south: 32.6, east: -117.1, north: 32.8 },
      2
    ).cells[0];
    expect(fastBig.speed).toBeGreaterThan(slowSmall.speed);
    expect(fastBig.alpha).toBeGreaterThan(slowSmall.alpha);
  });

  it("empty sources yields empty cells", () => {
    const field = buildFlowField([], { west: -1, south: -1, east: 1, north: 1 }, 4);
    expect(field.cells).toHaveLength(0);
  });

  it("cells beyond the influence radius from every beach are dead (speed/alpha 0)", () => {
    // One beach near the SW corner; the far NE corner is ~2.8deg away (well beyond
    // the 1.0deg influence radius), so it stays dead.
    const field = buildFlowField(
      [pt(-118.0, 32.0, 270, 14, 4)],
      { west: -118.0, south: 32.0, east: -116.0, north: 34.0 },
      3
    );
    const sw = field.cells.find(
      (c) => Math.abs(c.lon - -118.0) < 1e-6 && Math.abs(c.lat - 32.0) < 1e-6
    );
    const ne = field.cells.find(
      (c) => Math.abs(c.lon - -116.0) < 1e-6 && Math.abs(c.lat - 34.0) < 1e-6
    );
    // Near the beach: populated.
    expect(sw?.speed).toBeGreaterThan(0);
    expect(sw?.alpha).toBeGreaterThan(0);
    // Far off-coast: dead so empty areas stay clean.
    expect(ne?.speed).toBe(0);
    expect(ne?.alpha).toBe(0);
    expect(ne?.vx).toBe(0);
    expect(ne?.vy).toBe(0);
  });

  it("lifts emitted alpha so the populated band reads clearly (still clamped <= 1)", () => {
    const cell = buildFlowField(
      [pt(-117.2, 32.7, 270, 14, 3)],
      { west: -117.3, south: 32.6, east: -117.1, north: 32.8 },
      2
    ).cells[0];
    // A 3ft swell would emit alphaFromHeight = 0.09 raw; the gain lifts it well above.
    expect(cell.alpha).toBeGreaterThan(0.12);
    expect(cell.alpha).toBeLessThanOrEqual(1);
  });
});

describe("resolveWindParticleCount", () => {
  it("makes light wind visibly sparser than strong wind", () => {
    const lightWind: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 0.18, alpha: 0.1 }],
    };
    const strongWind: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 1.1, alpha: 0.8 }],
    };

    expect(resolveWindParticleCount(450, lightWind)).toBeLessThan(225);
    expect(resolveWindParticleCount(450, strongWind)).toBe(450);
  });

  it("keeps an empty wind field from falling back to full density", () => {
    expect(
      resolveWindParticleCount(450, { cols: 0, rows: 0, cells: [] })
    ).toBe(1);
  });
});

describe("computeCoastalBounds", () => {
  it("returns null when no point has finite lat/lon", () => {
    expect(computeCoastalBounds([])).toBeNull();
    expect(
      computeCoastalBounds([
        { lat: null, lon: -117.2 },
        { lat: 32.7, lon: undefined },
        { lat: NaN, lon: NaN },
      ])
    ).toBeNull();
  });

  it("pads the footprint bbox: generous along-coast (lat), tighter cross-shore (lon)", () => {
    // A north/south spread of beaches along the coast.
    const bounds = computeCoastalBounds([
      { lat: 32.6, lon: -117.2 },
      { lat: 33.4, lon: -117.4 },
    ]);
    expect(bounds).not.toBeNull();
    expect(bounds?.south).toBeCloseTo(32.6 - COASTAL_CORRIDOR_LAT_PAD, 6);
    expect(bounds?.north).toBeCloseTo(33.4 + COASTAL_CORRIDOR_LAT_PAD, 6);
    expect(bounds?.west).toBeCloseTo(-117.4 - COASTAL_CORRIDOR_LON_PAD, 6);
    expect(bounds?.east).toBeCloseTo(-117.2 + COASTAL_CORRIDOR_LON_PAD, 6);
    // Along-coast padding is more generous than cross-shore (chaining travel).
    expect(COASTAL_CORRIDOR_LAT_PAD).toBeGreaterThan(COASTAL_CORRIDOR_LON_PAD);
  });

  it("floors a degenerate single-beach bbox to a navigable minimum span", () => {
    const bounds = computeCoastalBounds([{ lat: 32.7, lon: -117.2 }]);
    expect(bounds).not.toBeNull();
    const latSpan = (bounds as NonNullable<typeof bounds>).north - (bounds as NonNullable<typeof bounds>).south;
    const lonSpan = (bounds as NonNullable<typeof bounds>).east - (bounds as NonNullable<typeof bounds>).west;
    // Minimum span + both sides of padding.
    expect(latSpan).toBeCloseTo(COASTAL_CORRIDOR_MIN_SPAN + 2 * COASTAL_CORRIDOR_LAT_PAD, 6);
    expect(lonSpan).toBeCloseTo(COASTAL_CORRIDOR_MIN_SPAN + 2 * COASTAL_CORRIDOR_LON_PAD, 6);
  });

  it("skips non-finite points but uses the finite ones", () => {
    const bounds = computeCoastalBounds([
      { lat: 32.6, lon: -117.2 },
      { lat: null, lon: null },
      { lat: 33.0, lon: -117.5 },
    ]);
    expect(bounds?.south).toBeCloseTo(32.6 - COASTAL_CORRIDOR_LAT_PAD, 6);
    expect(bounds?.west).toBeCloseTo(-117.5 - COASTAL_CORRIDOR_LON_PAD, 6);
  });
});

describe("detectWaterLayerIds", () => {
  it("matches water/ocean/bathymetry ids, case-insensitively", () => {
    const ids = detectWaterLayerIds([
      { id: "background" },
      { id: "water" },
      { id: "Water-Shadow" },
      { id: "ocean-pattern" },
      { id: "bathymetry-deep" },
      { id: "landuse" },
      { id: "road" },
    ]);
    expect(ids).toEqual(["water", "Water-Shadow", "ocean-pattern", "bathymetry-deep"]);
  });

  it("returns an empty array when no water layers exist", () => {
    expect(detectWaterLayerIds([{ id: "land" }, { id: "road" }])).toEqual([]);
    expect(detectWaterLayerIds([])).toEqual([]);
  });
});

describe("waterMaskableFlowComponents", () => {
  it("excludes wind, matching native's viewport-wide wind advection", () => {
    expect(waterMaskableFlowComponents(["wind"])).toEqual([]);
    expect(waterMaskableFlowComponents(["s1", "s2", "wind"])).toEqual([
      "s1",
      "s2",
    ]);
  });
});

describe("maskFieldToWater", () => {
  const makeField = (): FlowField => ({
    cols: 2,
    rows: 1,
    cells: [
      { lon: -117.3, lat: 32.7, vx: 1, vy: 0, speed: 0.5, alpha: 0.6 }, // will project on-screen
      { lon: -117.1, lat: 32.7, vx: 1, vy: 0, speed: 0.5, alpha: 0.6 }, // will project on-screen
    ],
  });

  it("zeroes in-viewport cells with no water feature (land), leaves water cells", () => {
    const field = makeField();
    const map: WaterMaskMap = {
      // both cells project on-screen
      project: ([lon]) => ({ x: lon === -117.3 ? 100 : 300, y: 200 }),
      // the first cell (x=100) is water, the second (x=300) is land
      queryRenderedFeatures: ([x]) => (x === 100 ? [{}] : []),
    };
    maskFieldToWater(field, map, { width: 800, height: 600, waterLayerIds: ["water"] });
    expect(field.cells[0].speed).toBe(0.5); // water → untouched
    expect(field.cells[1].speed).toBe(0); // land → zeroed
    expect(field.cells[1].alpha).toBe(0);
    expect(field.cells[1].vx).toBe(0);
  });

  it("never zeroes a cell whose projected point is outside the viewport", () => {
    const field = makeField();
    const map: WaterMaskMap = {
      project: () => ({ x: -50, y: -50 }), // off-screen
      queryRenderedFeatures: () => [], // would say "land" if asked
    };
    maskFieldToWater(field, map, { width: 800, height: 600, waterLayerIds: ["water"] });
    expect(field.cells[0].speed).toBe(0.5); // left alone, not blanked
    expect(field.cells[1].speed).toBe(0.5);
  });

  it("treats a thrown projection/query error as water (leaves the cell)", () => {
    const field = makeField();
    const map: WaterMaskMap = {
      project: () => {
        throw new Error("not ready");
      },
      queryRenderedFeatures: () => [],
    };
    maskFieldToWater(field, map, { width: 800, height: 600, waterLayerIds: ["water"] });
    expect(field.cells[0].speed).toBe(0.5);
    expect(field.cells[1].speed).toBe(0.5);
  });

  it("no-ops when there are no water layer ids (errs toward not blanking)", () => {
    const field = makeField();
    let queried = false;
    const map: WaterMaskMap = {
      project: () => ({ x: 100, y: 100 }),
      queryRenderedFeatures: () => {
        queried = true;
        return [];
      },
    };
    maskFieldToWater(field, map, { width: 800, height: 600, waterLayerIds: [] });
    expect(queried).toBe(false);
    expect(field.cells[0].speed).toBe(0.5);
  });

  it("does not destructively mask before rendered map tiles are ready", () => {
    const field = makeField();
    let queried = false;
    const map: WaterMaskMap = {
      areTilesLoaded: () => false,
      project: () => ({ x: 100, y: 100 }),
      queryRenderedFeatures: () => {
        queried = true;
        return [];
      },
    };

    maskFieldToWater(field, map, {
      width: 800,
      height: 600,
      waterLayerIds: ["water"],
    });

    expect(queried).toBe(false);
    expect(field.cells[0].speed).toBe(0.5);
    expect(field.cells[1].speed).toBe(0.5);
  });

  it("keeps the field intact when the rendered-style query has no water hits", () => {
    const field = makeField();
    const map: WaterMaskMap = {
      areTilesLoaded: () => true,
      project: () => ({ x: 100, y: 100 }),
      queryRenderedFeatures: () => [],
    };

    maskFieldToWater(field, map, {
      width: 800,
      height: 600,
      waterLayerIds: ["water"],
    });

    expect(field.cells[0].speed).toBe(0.5);
    expect(field.cells[1].speed).toBe(0.5);
  });

  it("keeps a large field intact when only a partial tile reports water", () => {
    const field: FlowField = {
      cols: 20,
      rows: 1,
      cells: Array.from({ length: 20 }, (_, index) => ({
        lon: -117.3 + index * 0.01,
        lat: 32.7,
        vx: 1,
        vy: 0,
        speed: 0.5,
        alpha: 0.6,
      })),
    };
    const map: WaterMaskMap = {
      areTilesLoaded: () => true,
      project: ([lon]) => ({ x: Math.round((lon + 117.3) * 1000), y: 100 }),
      queryRenderedFeatures: ([x]) => (x === 0 ? [{}] : []),
    };

    maskFieldToWater(field, map, {
      width: 800,
      height: 600,
      waterLayerIds: ["water"],
    });

    expect(field.cells.every((cell) => cell.speed === 0.5)).toBe(true);
  });

  it("skips already-dead cells", () => {
    const field: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: -117.2, lat: 32.7, vx: 0, vy: 0, speed: 0, alpha: 0 }],
    };
    let queried = false;
    const map: WaterMaskMap = {
      project: () => ({ x: 100, y: 100 }),
      queryRenderedFeatures: () => {
        queried = true;
        return [];
      },
    };
    maskFieldToWater(field, map, { width: 800, height: 600, waterLayerIds: ["water"] });
    expect(queried).toBe(false);
  });

  it("reuses camera-scoped water verdicts for rebuilt fields", () => {
    const cache = new Map<string, boolean>();
    let queryCount = 0;
    const map: WaterMaskMap = {
      project: () => ({ x: 100, y: 100 }),
      queryRenderedFeatures: () => {
        queryCount += 1;
        return [{}];
      },
    };

    maskFieldToWater(makeField(), map, {
      width: 800,
      height: 600,
      waterLayerIds: ["water"],
      waterMaskCache: cache,
    });
    maskFieldToWater(makeField(), map, {
      width: 800,
      height: 600,
      waterLayerIds: ["water"],
      waterMaskCache: cache,
    });

    expect(queryCount).toBe(2);
  });

  it("still zeroes land when every water verdict is cache-served (playback rebuild)", () => {
    // During playback the idle remask re-queries only the LIVE (water) cells and
    // caches them as water. The next tick rebuilds the field with land cells alive
    // again; those are the only cells that reach queryRenderedFeatures, so the
    // fresh pass sees zero water hits. Cached water verdicts must count toward the
    // trust threshold, or the guard aborts and land stays animated for a frame.
    const cache = new Map<string, boolean>();
    const water = Array.from({ length: 65 }, (_, index) => ({
      lon: -117.5 + index * 0.001,
      lat: 32.7,
      vx: 1,
      vy: 0,
      speed: 0.5,
      alpha: 0.6,
    }));
    const land = Array.from({ length: 56 }, (_, index) => ({
      lon: -117.1 + index * 0.001,
      lat: 32.7,
      vx: 1,
      vy: 0,
      speed: 0.5,
      alpha: 0.6,
    }));
    for (const cell of water) cache.set(`${cell.lon}:${cell.lat}`, true);
    const field: FlowField = { cols: 121, rows: 1, cells: [...water, ...land] };
    const queried: number[] = [];
    const map: WaterMaskMap = {
      areTilesLoaded: () => true,
      project: ([lon]) => ({ x: lon < -117.3 ? 100 : 500, y: 100 }),
      queryRenderedFeatures: ([x]) => {
        queried.push(x);
        return x === 100 ? [{}] : [];
      },
    };

    maskFieldToWater(field, map, {
      width: 800,
      height: 600,
      waterLayerIds: ["water"],
      waterMaskCache: cache,
    });

    expect(queried.every((x) => x === 500)).toBe(true); // only land reached the map
    expect(water.every((cell) => cell.speed === 0.5)).toBe(true);
    expect(land.every((cell) => cell.speed === 0 && cell.alpha === 0)).toBe(true);
  });
});
