import {
  degToVector,
  buildFlowField,
  computeCoastalBounds,
  COASTAL_CORRIDOR_LAT_PAD,
  COASTAL_CORRIDOR_LON_PAD,
  COASTAL_CORRIDOR_MIN_SPAN,
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
    // One beach near the SW corner; the far NE corner is >0.6deg away in both axes.
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
