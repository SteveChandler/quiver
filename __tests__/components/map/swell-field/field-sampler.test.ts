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
});
