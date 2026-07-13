import {
  boundsFromBeaches,
  createCameraCommand,
} from "@/components/map/map-camera-command";
import type { Beach } from "@/types/database";

describe("map camera commands", () => {
  it("increments command ids and frames valid beaches", () => {
    const first = createCameraCommand(null, {
      source: "gps",
      center: { lat: 32.77, lon: -117.25 },
    });
    const second = createCameraCommand(first, {
      source: "region",
      bounds: [[-160.3, 18.8], [-154.7, 22.4]],
    });

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(boundsFromBeaches([
      { id: "north", lat: 21.67, lon: -158.05 } as Beach,
      { id: "bowls", lat: 21.28, lon: -157.85 } as Beach,
      { id: "bad", lat: null, lon: null } as Beach,
    ])).toEqual([[-158.05, 21.28], [-157.85, 21.67]]);
  });

  it("rejects invalid or zero-area beach bounds", () => {
    expect(boundsFromBeaches([
      { id: "bad-lat", lat: Number.NaN, lon: -117.25 } as Beach,
      { id: "bad-lon", lat: 32.77, lon: Number.POSITIVE_INFINITY } as Beach,
    ])).toBeNull();

    expect(boundsFromBeaches([
      { id: "same-a", lat: 32.77, lon: -117.25 } as Beach,
      { id: "same-b", lat: 32.77, lon: -117.25 } as Beach,
    ])).toBeNull();
  });
});
