import { drawWaterMask, isStreetWaterColor, waterMaskFromPixels } from "@/components/map/swell-field/water-mask";
import { PARTICLE_FRAGMENT_SHADER } from "@/components/map/swell-field/swell-particle-layer";
import type mapboxgl from "mapbox-gl";

it("clips to water polygons with island holes instead of interpolated forecast cells", () => {
  const ctx = { scale: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), closePath: jest.fn(), fill: jest.fn(), fillStyle: "" };
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  const map = {
    getCanvas: () => ({ width: 800, height: 600, clientWidth: 400, clientHeight: 300 }),
    getStyle: () => ({ layers: [{ id: "water", type: "fill" }, { id: "water-label", type: "symbol" }] }),
    queryRenderedFeatures: jest.fn(() => [{ geometry: { type: "Polygon", coordinates: [[[0,0],[4,0],[4,4],[0,0]], [[1,1],[2,1],[2,2],[1,1]]] } }]),
    project: ([x,y]: number[]) => ({ x, y }),
  };
  drawWaterMask(map as unknown as mapboxgl.Map, canvas);
  expect(map.queryRenderedFeatures).toHaveBeenCalledWith({ layers: ["water"] });
  expect(ctx.moveTo).toHaveBeenCalledTimes(2);
  expect(ctx.fill).toHaveBeenCalledWith("evenodd");
  expect(ctx.scale).toHaveBeenCalledWith(2, 2);
  expect(PARTICLE_FRAGMENT_SHADER).toContain("discard");
  map.getStyle = () => ({ layers: [] });
  ctx.fill.mockClear();
  drawWaterMask(map as unknown as mapboxgl.Map, canvas);
  expect(ctx.fill).not.toHaveBeenCalled();
});

describe("waterMaskFromPixels", () => {
  const WATER = [117, 207, 240, 255];
  const LAND = [240, 237, 229, 255];

  function image(width: number, height: number, pixel: (x: number, y: number) => number[]) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      rgba.set(pixel(x, y), (y * width + x) * 4);
    }
    return rgba;
  }

  it("marks the water side of a coastline", () => {
    const rgba = image(20, 10, (x) => (x < 10 ? WATER : LAND));
    const mask = waterMaskFromPixels(rgba, 20, 10, 20, 10, 4, 2);

    expect(Array.from(mask.cells)).toEqual([1, 1, 0, 0, 1, 1, 0, 0]);
  });

  it("keeps a label over water from punching a hole", () => {
    const rgba = image(9, 9, (x, y) => (x === 4 && y === 4 ? [30, 30, 30, 255] : WATER));
    expect(Array.from(waterMaskFromPixels(rgba, 9, 9, 9, 9, 3, 3).cells)).toEqual(Array(9).fill(1));
  });

  it("follows the centred cover crop of a wider image", () => {
    // Water only in the outer quarters, which a square frame crops away.
    const rgba = image(40, 10, (x) => (x < 10 || x >= 30 ? WATER : LAND));
    expect(Array.from(waterMaskFromPixels(rgba, 40, 10, 10, 10, 2, 2).cells)).toEqual([0, 0, 0, 0]);
  });

  it("returns an empty mask for unusable input", () => {
    expect(waterMaskFromPixels(new Uint8ClampedArray(4), 10, 10, 10, 10, 2, 2).cells).toHaveLength(0);
    expect(waterMaskFromPixels(new Uint8ClampedArray(400), 10, 10, 0, 10, 2, 2).cells).toHaveLength(0);
  });

  it("only accepts opaque streets-v11 water", () => {
    expect(isStreetWaterColor(117, 207, 240)).toBe(true);
    expect(isStreetWaterColor(117, 207, 240, 128)).toBe(false);
    expect(isStreetWaterColor(170, 211, 223)).toBe(false);
  });
});
