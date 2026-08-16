import { applyBeachCoordinateCorrection } from "@/lib/beach-coordinate-corrections";
import type { Beach } from "@/types/database";

function beach(overrides: Partial<Beach>): Beach {
  return {
    id: "beach-id",
    name: "Test Beach",
    slug: "test-beach",
    lat: 0,
    lon: 0,
    ...overrides,
  } as Beach;
}

describe("applyBeachCoordinateCorrection", () => {
  it.each([
    ["La Jolla Shores", "la-jolla-shores", 32.8567, -117.2575],
    ["Tourmaline Beach", "tourmaline-beach", 32.805149, -117.262364],
    ["Birdrock", "birdrock", 32.815031, -117.273505],
  ])("corrects %s before the beach reaches the map", (name, slug, lat, lon) => {
    expect(applyBeachCoordinateCorrection(beach({ name, slug }))).toMatchObject({
      lat,
      lon,
    });
  });

  it("supports catalog ids while cached names and slugs overlap", () => {
    expect(applyBeachCoordinateCorrection(beach({
      id: "17628f35-9ed1-4257-aad6-070c4bd73bb8",
    }))).toMatchObject({
      lat: 32.805149,
      lon: -117.262364,
    });
  });

  it("preserves beaches outside the audited correction set", () => {
    const original = beach({ lat: 33.1, lon: -118.2 });
    expect(applyBeachCoordinateCorrection(original)).toBe(original);
  });
});
