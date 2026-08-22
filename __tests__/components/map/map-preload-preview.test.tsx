import {
  projectMapPreviewCoordinate,
} from "@/components/map/map-preload-preview";

describe("projectMapPreviewCoordinate", () => {
  const center: [number, number] = [32.75, -117.25];

  it("places the camera center at the preview center", () => {
    expect(
      projectMapPreviewCoordinate({
        latitude: center[0],
        longitude: center[1],
        center,
        zoom: 13,
      }),
    ).toEqual({ x: 0, y: 0 });
  });

  it("projects cardinal directions with the correct signs", () => {
    const east = projectMapPreviewCoordinate({
      latitude: center[0],
      longitude: center[1] + 0.01,
      center,
      zoom: 13,
    });
    const north = projectMapPreviewCoordinate({
      latitude: center[0] + 0.01,
      longitude: center[1],
      center,
      zoom: 13,
    });

    expect(east?.x).toBeGreaterThan(0);
    expect(east?.y).toBeCloseTo(0);
    expect(north?.x).toBeCloseTo(0);
    expect(north?.y).toBeLessThan(0);
  });

  it("wraps longitude offsets across the antimeridian", () => {
    const offset = projectMapPreviewCoordinate({
      latitude: 0,
      longitude: -179.9,
      center: [0, 179.9],
      zoom: 2,
    });

    expect(offset?.x).toBeGreaterThan(0);
    expect(offset?.x).toBeLessThan(10);
  });

  it("rejects invalid coordinates and clamps polar latitude", () => {
    expect(
      projectMapPreviewCoordinate({
        latitude: Number.NaN,
        longitude: 0,
        center: [0, 0],
        zoom: 10,
      }),
    ).toBeNull();

    const polar = projectMapPreviewCoordinate({
      latitude: 90,
      longitude: 0,
      center: [0, 0],
      zoom: 10,
    });
    expect(Number.isFinite(polar?.y)).toBe(true);
  });
});
