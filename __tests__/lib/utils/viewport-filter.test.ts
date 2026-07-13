import { filterBeachesByViewport, type ViewportBounds } from "@/lib/utils/viewport-filter";

type TestBeach = {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
};

type Beach = TestBeach;

/**
 * Helper to create a minimal Beach object for testing.
 * All Beach fields have defaults except id, name, lat, lon which can be overridden.
 */
function makeBeach(overrides: Partial<TestBeach> & { id: string; name: string }): TestBeach {
  return {
    // id and name always come from overrides (required in type signature)
    lat: 0,
    lon: 0,
    // Apply overrides
    ...overrides,
  };
}

describe("filterBeachesByViewport", () => {
  describe("when bounds is null", () => {
    it("returns all beaches unchanged", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "Beach 1", lat: 32.8, lon: -117.2 }),
        makeBeach({ id: "2", name: "Beach 2", lat: 33.0, lon: -117.0 }),
        makeBeach({ id: "3", name: "Beach 3", lat: 33.2, lon: -116.8 }),
      ];

      const result = filterBeachesByViewport(beaches, null);

      expect(result).toEqual(beaches);
      expect(result).toHaveLength(3);
    });

    it("returns empty array when beaches array is empty", () => {
      const result = filterBeachesByViewport([], null);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("when bounds is provided", () => {
    const sanDiegoBounds: ViewportBounds = {
      west: -117.3,
      south: 32.7,
      east: -117.0,
      north: 33.1,
    };

    it("filters beaches within viewport bounds correctly", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "Inside Beach", lat: 32.8, lon: -117.2 }),
        makeBeach({ id: "2", name: "Outside Beach North", lat: 33.5, lon: -117.2 }),
        makeBeach({ id: "3", name: "Outside Beach South", lat: 32.5, lon: -117.2 }),
        makeBeach({ id: "4", name: "Outside Beach East", lat: 32.8, lon: -116.8 }),
        makeBeach({ id: "5", name: "Outside Beach West", lat: 32.8, lon: -117.5 }),
        makeBeach({ id: "6", name: "Inside Beach 2", lat: 33.0, lon: -117.1 }),
      ];

      const result = filterBeachesByViewport(beaches, sanDiegoBounds);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Inside Beach");
      expect(result[1].name).toBe("Inside Beach 2");
    });

    it("excludes beaches with null latitude", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "Valid Beach", lat: 32.8, lon: -117.2 }),
        makeBeach({ id: "2", name: "Null Lat Beach", lat: null as any, lon: -117.2 }),
      ];

      const result = filterBeachesByViewport(beaches, sanDiegoBounds);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Valid Beach");
    });

    it("excludes beaches with null longitude", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "Valid Beach", lat: 32.8, lon: -117.2 }),
        makeBeach({ id: "2", name: "Null Lon Beach", lat: 32.8, lon: null as any }),
      ];

      const result = filterBeachesByViewport(beaches, sanDiegoBounds);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Valid Beach");
    });

    it("excludes beaches with both null coordinates", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "Valid Beach", lat: 32.8, lon: -117.2 }),
        makeBeach({ id: "2", name: "Null Coords Beach", lat: null as any, lon: null as any }),
      ];

      const result = filterBeachesByViewport(beaches, sanDiegoBounds);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Valid Beach");
    });

    it("returns empty array when no beaches match bounds", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "Far North", lat: 40.0, lon: -117.2 }),
        makeBeach({ id: "2", name: "Far South", lat: 25.0, lon: -117.2 }),
        makeBeach({ id: "3", name: "Far East", lat: 32.8, lon: -100.0 }),
        makeBeach({ id: "4", name: "Far West", lat: 32.8, lon: -130.0 }),
      ];

      const result = filterBeachesByViewport(beaches, sanDiegoBounds);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("returns empty array when beaches array is empty", () => {
      const result = filterBeachesByViewport([], sanDiegoBounds);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("edge cases: beaches on boundary", () => {
    const bounds: ViewportBounds = {
      west: -117.3,
      south: 32.7,
      east: -117.0,
      north: 33.1,
    };

    it("includes beach exactly on north boundary", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "On North Edge", lat: 33.1, lon: -117.15 }),
      ];

      const result = filterBeachesByViewport(beaches, bounds);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("On North Edge");
    });

    it("includes beach exactly on south boundary", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "On South Edge", lat: 32.7, lon: -117.15 }),
      ];

      const result = filterBeachesByViewport(beaches, bounds);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("On South Edge");
    });

    it("includes beach exactly on west boundary", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "On West Edge", lat: 32.9, lon: -117.3 }),
      ];

      const result = filterBeachesByViewport(beaches, bounds);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("On West Edge");
    });

    it("includes beach exactly on east boundary", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "On East Edge", lat: 32.9, lon: -117.0 }),
      ];

      const result = filterBeachesByViewport(beaches, bounds);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("On East Edge");
    });

    it("includes beach at corner (all boundaries)", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "NW Corner", lat: 33.1, lon: -117.3 }),
        makeBeach({ id: "2", name: "NE Corner", lat: 33.1, lon: -117.0 }),
        makeBeach({ id: "3", name: "SW Corner", lat: 32.7, lon: -117.3 }),
        makeBeach({ id: "4", name: "SE Corner", lat: 32.7, lon: -117.0 }),
      ];

      const result = filterBeachesByViewport(beaches, bounds);

      expect(result).toHaveLength(4);
      expect(result.map(b => b.name).sort()).toEqual([
        "NE Corner",
        "NW Corner",
        "SE Corner",
        "SW Corner",
      ]);
    });

    it("excludes beach just outside north boundary", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "Just Outside North", lat: 33.10001, lon: -117.15 }),
      ];

      const result = filterBeachesByViewport(beaches, bounds);

      expect(result).toHaveLength(0);
    });

    it("excludes beach just outside south boundary", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "Just Outside South", lat: 32.69999, lon: -117.15 }),
      ];

      const result = filterBeachesByViewport(beaches, bounds);

      expect(result).toHaveLength(0);
    });
  });

  describe("real-world scenarios", () => {
    it("filters San Diego beaches from larger California dataset", () => {
      const beaches: Beach[] = [
        // San Diego beaches (should be included)
        makeBeach({ id: "1", name: "Blacks Beach", lat: 32.889, lon: -117.252 }),
        makeBeach({ id: "2", name: "La Jolla Shores", lat: 32.857, lon: -117.257 }),
        makeBeach({ id: "3", name: "Pacific Beach", lat: 32.796, lon: -117.229 }),

        // Los Angeles beaches (outside viewport)
        makeBeach({ id: "4", name: "Venice Beach", lat: 33.984, lon: -118.473 }),
        makeBeach({ id: "5", name: "Santa Monica", lat: 34.010, lon: -118.496 }),

        // Orange County beaches (outside viewport)
        makeBeach({ id: "6", name: "Huntington Beach", lat: 33.660, lon: -117.999 }),
      ];

      const sanDiegoBounds: ViewportBounds = {
        west: -117.3,
        south: 32.7,
        east: -117.0,
        north: 33.1,
      };

      const result = filterBeachesByViewport(beaches, sanDiegoBounds);

      expect(result).toHaveLength(3);
      expect(result.map(b => b.name).sort()).toEqual([
        "Blacks Beach",
        "La Jolla Shores",
        "Pacific Beach",
      ]);
    });

    it("handles very small viewport (zoomed in)", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "Center Beach", lat: 32.857, lon: -117.257 }),
        makeBeach({ id: "2", name: "Nearby Beach", lat: 32.858, lon: -117.256 }),
        makeBeach({ id: "3", name: "Far Beach", lat: 32.900, lon: -117.200 }),
      ];

      const tinyBounds: ViewportBounds = {
        west: -117.26,
        south: 32.85,
        east: -117.25,
        north: 32.86,
      };

      const result = filterBeachesByViewport(beaches, tinyBounds);

      expect(result).toHaveLength(2);
      expect(result.map(b => b.name).sort()).toEqual([
        "Center Beach",
        "Nearby Beach",
      ]);
    });

    it("handles very large viewport (zoomed out)", () => {
      const beaches: Beach[] = [
        makeBeach({ id: "1", name: "California Beach", lat: 34.0, lon: -118.0 }),
        makeBeach({ id: "2", name: "Oregon Beach", lat: 43.0, lon: -124.0 }),
        makeBeach({ id: "3", name: "Washington Beach", lat: 47.6, lon: -122.3 }),
        makeBeach({ id: "4", name: "Hawaii Beach", lat: 21.3, lon: -157.8 }),
      ];

      const westCoastBounds: ViewportBounds = {
        west: -130.0,
        south: 30.0,
        east: -110.0,
        north: 50.0,
      };

      const result = filterBeachesByViewport(beaches, westCoastBounds);

      expect(result).toHaveLength(3);
      expect(result.map(b => b.name).sort()).toEqual([
        "California Beach",
        "Oregon Beach",
        "Washington Beach",
      ]);
    });
  });

  describe("performance considerations", () => {
    it("handles large datasets efficiently", () => {
      // Create 1000 beaches
      const beaches: Beach[] = Array.from({ length: 1000 }, (_, i) =>
        makeBeach({
          id: `beach-${i}`,
          name: `Beach ${i}`,
          lat: 32.7 + (i % 100) * 0.01, // Spread across latitude range
          lon: -117.3 + (i % 50) * 0.01, // Spread across longitude range
        })
      );

      const bounds: ViewportBounds = {
        west: -117.3,
        south: 32.7,
        east: -117.0,
        north: 33.1,
      };

      const startTime = Date.now();
      const result = filterBeachesByViewport(beaches, bounds);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 100ms for 1000 items)
      expect(duration).toBeLessThan(100);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThan(beaches.length);
    });
  });
});
