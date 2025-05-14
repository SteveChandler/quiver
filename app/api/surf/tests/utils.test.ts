import { resolveBeach } from "../utils";

describe("resolveBeach function", () => {
  test("resolves exact beach name", () => {
    const result = resolveBeach("ocean beach");
    expect(result.name).toBe("ocean beach");
    expect(result.lat).toBe(32.7507);
    expect(result.lng).toBe(-117.254);
  });

  test("normalizes beach name (uppercase, extra spaces)", () => {
    const result = resolveBeach("  OCEAN BEACH  ");
    expect(result.name).toBe("ocean beach");
  });

  test("resolves partial beach name", () => {
    const result = resolveBeach("la jolla");
    expect(result.name).toBe("la jolla shores");
  });

  test("finds nearest beach based on coordinates", () => {
    // Coordinates near Mission Beach
    const result = resolveBeach({ lat: 32.778, lng: -117.254 });
    expect(result.name).toBe("mission beach");
  });

  test("throws error for unknown beach name", () => {
    expect(() => resolveBeach("nonexistent beach")).toThrow(
      'Beach "nonexistent beach" not found'
    );
  });
});
