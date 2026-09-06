import { drawWaterMask } from "@/components/map/swell-field/water-mask";
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
