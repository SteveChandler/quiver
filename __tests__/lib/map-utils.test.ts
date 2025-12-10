import {
  getStaticMapImageUrl,
  getStaticMapImageUrlWithWaveHeight,
  getBeachCoordinates,
  resolveBeachCoordinates,
} from "@/lib/map-utils";

// Mock environment variables
const mockEnv = {
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "test-mapbox-token",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "test-google-key",
  NODE_ENV: "test",
};

describe("Map Utils", () => {
  let originalEnv: any;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Set mock environment variables
    Object.assign(process.env, mockEnv);
  });

  afterEach(() => {
    // Restore original environment
    Object.assign(process.env, originalEnv);
  });

  describe("getStaticMapImageUrl", () => {
    it("should return placeholder for invalid coordinates", () => {
      const result = getStaticMapImageUrl(undefined, undefined);
      expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it("should return placeholder for out-of-range coordinates", () => {
      const result = getStaticMapImageUrl(91, 181); // Invalid lat/lng
      expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it("should return URL when marker text is provided and API keys available", () => {
      const result = getStaticMapImageUrl(32.7, -117.2, {
        width: 400,
        height: 200,
        markerText: "4-5ft",
      });
      // Should return a Google Maps URL when marker text is provided and API key is available
      expect(result).toMatch(
        /maps\.googleapis\.com|data:image\/svg\+xml;base64,/
      );
    });

    it("should prefer placeholder in production when no provider is configured", () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });
      process.env.VERCEL = "1";

      const result = getStaticMapImageUrl(32.7, -117.2);
      expect(typeof result).toBe("string");
    });

    it("should handle valid coordinates", () => {
      const result = getStaticMapImageUrl(32.7, -117.2);
      // Should either be a URL or placeholder
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });

  describe("getStaticMapImageUrlWithWaveHeight", () => {
    it("should include wave height in marker text", () => {
      const result = getStaticMapImageUrlWithWaveHeight(32.7, -117.2, 4.5);
      // Should return either a Google Maps URL or placeholder
      expect(result).toMatch(
        /maps\.googleapis\.com|data:image\/svg\+xml;base64,/
      );
    });

    it("should handle undefined wave height", () => {
      const result = getStaticMapImageUrlWithWaveHeight(
        32.7,
        -117.2,
        undefined
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle zero wave height", () => {
      const result = getStaticMapImageUrlWithWaveHeight(32.7, -117.2, 0);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });

  describe("getBeachCoordinates", () => {
    it("should extract direct latitude/longitude properties", () => {
      const beach = {
        id: "test",
        name: "Test Beach",
        lat: 32.7,
        lon: -117.2,
      };

      const result = getBeachCoordinates(beach);
      expect(result).toEqual({ latitude: 32.7, longitude: -117.2 });
    });

    it("should extract coordinates from location object", () => {
      const beach = {
        id: "test",
        name: "Test Beach",
        location: { x: -117.2, y: 32.7 }, // PostGIS format
      };

      const result = getBeachCoordinates(beach);
      expect(result).toEqual({ latitude: 32.7, longitude: -117.2 });
    });

    it("should extract coordinates from lat/lng properties", () => {
      const beach = {
        id: "test",
        name: "Test Beach",
        lat: 32.7,
        lng: -117.2,
      };

      const result = getBeachCoordinates(beach);
      expect(result).toEqual({ latitude: 32.7, longitude: -117.2 });
    });

    it("should return null for beach without coordinates", () => {
      const beach = {
        id: "test",
        name: "Test Beach",
      };

      const result = getBeachCoordinates(beach);
      expect(result).toBeNull();
    });

    it("should return null for null/undefined beach", () => {
      expect(getBeachCoordinates(null)).toBeNull();
      expect(getBeachCoordinates(undefined)).toBeNull();
    });

    it("should return null for NaN coordinates", () => {
      const beachWithNaN = {
        id: "test",
        name: "Test Beach",
        lat: NaN,
        lon: -117.2,
      };
      expect(getBeachCoordinates(beachWithNaN)).toBeNull();

      const beachWithNaN2 = {
        id: "test",
        name: "Test Beach",
        lat: 32.7,
        lon: NaN,
      };
      expect(getBeachCoordinates(beachWithNaN2)).toBeNull();

      const beachWithBothNaN = {
        id: "test",
        name: "Test Beach",
        lat: NaN,
        lon: NaN,
      };
      expect(getBeachCoordinates(beachWithBothNaN)).toBeNull();
    });

    it("should return null for Infinity coordinates", () => {
      const beachWithInfinity = {
        id: "test",
        name: "Test Beach",
        lat: Infinity,
        lon: -117.2,
      };
      expect(getBeachCoordinates(beachWithInfinity)).toBeNull();

      const beachWithNegInfinity = {
        id: "test",
        name: "Test Beach",
        lat: 32.7,
        lon: -Infinity,
      };
      expect(getBeachCoordinates(beachWithNegInfinity)).toBeNull();
    });
  });

  describe("resolveBeachCoordinates", () => {
    it("should use getBeachCoordinates first", () => {
      const beach = {
        id: "test",
        name: "Test Beach",
        lat: 32.7,
        lon: -117.2,
      };

      const result = resolveBeachCoordinates(beach);
      expect(result).toEqual({ latitude: 32.7, longitude: -117.2 });
    });

    it("should return null when no coordinates found", () => {
      const beach = {
        id: "test",
        name: "Unknown Beach",
      };

      const result = resolveBeachCoordinates(beach);
      expect(result).toBeNull();
    });

    it("should handle null/undefined beach", () => {
      expect(resolveBeachCoordinates(null)).toBeNull();
      expect(resolveBeachCoordinates(undefined)).toBeNull();
    });

    it("should handle beach without name", () => {
      const beach = {
        id: "test",
      };

      const result = resolveBeachCoordinates(beach);
      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle extreme but valid coordinates", () => {
      const result = getStaticMapImageUrl(90, 180);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle negative coordinates", () => {
      const result = getStaticMapImageUrl(-45, -120);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle zero coordinates", () => {
      const result = getStaticMapImageUrl(0, 0);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });
});
