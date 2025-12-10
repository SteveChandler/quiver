/**
 * Tests for Beach to SurfSpot Transformer
 *
 * CRITICAL: This transformer handles coordinate mapping from database format (lon)
 * to SurfSpot format (lng). Errors here would cause map markers to display
 * in wrong locations.
 *
 * Priority 1 test coverage for San Diego page redesign.
 */

import {
  transformBeachToSurfSpot,
  transformBeachesToSurfSpots,
  validateBeachCoordinates,
} from "@/lib/utils/beach-to-surfspot-transformer";
import type { BeachWithMetrics } from "@/types/location";
import {
  mockBeachComplete,
  mockBeachBeginner,
  mockBeachLongboard,
  mockBeachAdvanced,
  mockBeachExpert,
  mockBeachMinimal,
  mockBeachInvalidCoords,
  mockBeachOrangeCounty,
  mockBeachLightCrowd,
  mockBeachCollection,
  mockBeachCollectionEmpty,
} from "@/__tests__/fixtures/beach-data";

describe("Beach to SurfSpot Transformer", () => {
  describe("transformBeachToSurfSpot", () => {
    describe("Coordinate Transformation (CRITICAL)", () => {
      it("should map database lat to coordinates.lat correctly", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);

        expect(result.coordinates.lat).toBe(mockBeachComplete.lat);
        expect(result.coordinates.lat).toBe(32.7198);
      });

      it("should map database lon to coordinates.lng (lon→lng mapping)", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);

        // CRITICAL: lon from database should become lng in SurfSpot
        expect(result.coordinates.lng).toBe(mockBeachComplete.lon);
        expect(result.coordinates.lng).toBe(-117.2557);
      });

      it("should NOT access beach.lng property (does not exist)", () => {
        // Verify the beach fixture doesn't have a lng property
        expect((mockBeachComplete as Record<string, unknown>).lng).toBeUndefined();

        const result = transformBeachToSurfSpot(mockBeachComplete);

        // The transformer should use lon, not lng
        expect(result.coordinates.lng).toBe(mockBeachComplete.lon);
      });

      it("should use San Diego default coordinates when lat is null", () => {
        const result = transformBeachToSurfSpot(mockBeachMinimal);

        // Default San Diego center
        expect(result.coordinates.lat).toBe(32.7157);
        expect(result.coordinates.lng).toBe(-117.1611);
      });

      it("should use San Diego default coordinates when lon is null", () => {
        const beachWithNullLon: BeachWithMetrics = {
          ...mockBeachComplete,
          lat: 32.8,
          lon: null as unknown as number,
        };

        const result = transformBeachToSurfSpot(beachWithNullLon);

        expect(result.coordinates.lat).toBe(32.8); // Uses provided lat
        expect(result.coordinates.lng).toBe(-117.1611); // Uses default lon
      });

      it("should preserve coordinate precision", () => {
        const beachWithPrecision: BeachWithMetrics = {
          ...mockBeachComplete,
          lat: 32.71984567,
          lon: -117.25571234,
        };

        const result = transformBeachToSurfSpot(beachWithPrecision);

        expect(result.coordinates.lat).toBe(32.71984567);
        expect(result.coordinates.lng).toBe(-117.25571234);
      });

      it("should handle negative latitude (southern hemisphere)", () => {
        const beachSouthern: BeachWithMetrics = {
          ...mockBeachComplete,
          lat: -33.9258,
          lon: 151.2543,
        };

        const result = transformBeachToSurfSpot(beachSouthern);

        expect(result.coordinates.lat).toBe(-33.9258);
        expect(result.coordinates.lng).toBe(151.2543);
      });

      it("should handle coordinate edge cases near international date line", () => {
        const beachNearDateLine: BeachWithMetrics = {
          ...mockBeachComplete,
          lat: 21.3069,
          lon: -157.8583, // Hawaii
        };

        const result = transformBeachToSurfSpot(beachNearDateLine);

        expect(result.coordinates.lat).toBe(21.3069);
        expect(result.coordinates.lng).toBe(-157.8583);
      });
    });

    describe("Skill Level Mapping", () => {
      it("should map Beginner to 'Beginner friendly'", () => {
        const result = transformBeachToSurfSpot(mockBeachBeginner);
        expect(result.skillLevel).toBe("Beginner friendly");
      });

      it("should map Longboard to 'Longboard friendly'", () => {
        const result = transformBeachToSurfSpot(mockBeachLongboard);
        expect(result.skillLevel).toBe("Longboard friendly");
      });

      it("should map Advanced to 'Advanced'", () => {
        const result = transformBeachToSurfSpot(mockBeachAdvanced);
        expect(result.skillLevel).toBe("Advanced");
      });

      it("should map Expert to 'Intermediate to expert'", () => {
        const result = transformBeachToSurfSpot(mockBeachExpert);
        expect(result.skillLevel).toBe("Intermediate to expert");
      });

      it("should map Intermediate to 'Intermediate'", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.skillLevel).toBe("Intermediate");
      });

      it("should default to 'Intermediate' for null skill_level", () => {
        const result = transformBeachToSurfSpot(mockBeachMinimal);
        expect(result.skillLevel).toBe("Intermediate");
      });

      it("should handle case-insensitive skill levels", () => {
        const beachUpperCase: BeachWithMetrics = {
          ...mockBeachComplete,
          skill_level: "BEGINNER",
        };

        const result = transformBeachToSurfSpot(beachUpperCase);
        expect(result.skillLevel).toBe("Beginner friendly");
      });

      it("should handle partial matches in skill level", () => {
        const beachPartial: BeachWithMetrics = {
          ...mockBeachComplete,
          skill_level: "Beginner to Intermediate",
        };

        const result = transformBeachToSurfSpot(beachPartial);
        expect(result.skillLevel).toBe("Beginner friendly"); // Contains "beginner"
      });
    });

    describe("Crowd Factor Mapping", () => {
      it("should map Light crowd to 'Light'", () => {
        const result = transformBeachToSurfSpot(mockBeachLightCrowd);
        expect(result.crowdFactor).toBe("Light");
      });

      it("should map Low crowd to 'Light'", () => {
        const beachLow: BeachWithMetrics = {
          ...mockBeachComplete,
          crowd_level: "Low",
        };

        const result = transformBeachToSurfSpot(beachLow);
        expect(result.crowdFactor).toBe("Light");
      });

      it("should map Heavy crowd to 'Heavy'", () => {
        const result = transformBeachToSurfSpot(mockBeachBeginner);
        expect(result.crowdFactor).toBe("Heavy");
      });

      it("should map High crowd to 'Heavy'", () => {
        const beachHigh: BeachWithMetrics = {
          ...mockBeachComplete,
          crowd_level: "High",
        };

        const result = transformBeachToSurfSpot(beachHigh);
        expect(result.crowdFactor).toBe("Heavy");
      });

      it("should map Moderate crowd to 'Moderate'", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.crowdFactor).toBe("Moderate");
      });

      it("should default to 'Moderate' for null crowd_level", () => {
        const result = transformBeachToSurfSpot(mockBeachMinimal);
        expect(result.crowdFactor).toBe("Moderate");
      });

      it("should handle case-insensitive crowd levels", () => {
        const beachUpperCase: BeachWithMetrics = {
          ...mockBeachComplete,
          crowd_level: "HEAVY",
        };

        const result = transformBeachToSurfSpot(beachUpperCase);
        expect(result.crowdFactor).toBe("Heavy");
      });
    });

    describe("City Slug Derivation", () => {
      it("should derive 'orange-county' for Orange County cities", () => {
        const result = transformBeachToSurfSpot(mockBeachOrangeCounty);
        expect(result.citySlug).toBe("orange-county");
      });

      it("should derive 'san-diego' for San Diego", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.citySlug).toBe("san-diego");
      });

      it("should derive 'san-diego' for La Jolla", () => {
        const result = transformBeachToSurfSpot(mockBeachBeginner);
        expect(result.citySlug).toBe("san-diego");
      });

      it("should derive 'san-diego' for Pacific Beach", () => {
        const result = transformBeachToSurfSpot(mockBeachLongboard);
        expect(result.citySlug).toBe("san-diego");
      });

      it("should derive 'san-diego' for Coronado", () => {
        const beachCoronado: BeachWithMetrics = {
          ...mockBeachComplete,
          city: "Coronado",
        };

        const result = transformBeachToSurfSpot(beachCoronado);
        expect(result.citySlug).toBe("san-diego");
      });

      it("should derive 'san-diego' for Encinitas", () => {
        const beachEncinitas: BeachWithMetrics = {
          ...mockBeachComplete,
          city: "Encinitas",
        };

        const result = transformBeachToSurfSpot(beachEncinitas);
        expect(result.citySlug).toBe("san-diego");
      });

      it("should derive 'san-diego' for Del Mar", () => {
        const beachDelMar: BeachWithMetrics = {
          ...mockBeachComplete,
          city: "Del Mar",
        };

        const result = transformBeachToSurfSpot(beachDelMar);
        expect(result.citySlug).toBe("san-diego");
      });

      it("should default to 'san-diego' for null city", () => {
        const result = transformBeachToSurfSpot(mockBeachMinimal);
        expect(result.citySlug).toBe("san-diego");
      });

      it("should default to 'san-diego' for unknown city", () => {
        const beachUnknown: BeachWithMetrics = {
          ...mockBeachComplete,
          city: "Unknown City",
        };

        const result = transformBeachToSurfSpot(beachUnknown);
        expect(result.citySlug).toBe("san-diego");
      });

      it("should handle case-insensitive city matching", () => {
        const beachLowerCase: BeachWithMetrics = {
          ...mockBeachComplete,
          city: "la jolla",
        };

        const result = transformBeachToSurfSpot(beachLowerCase);
        expect(result.citySlug).toBe("san-diego");
      });
    });

    describe("Intent Tags Generation", () => {
      it("should include 'beginner' tag for beginner skill level", () => {
        const result = transformBeachToSurfSpot(mockBeachBeginner);
        expect(result.intentTags).toContain("beginner");
      });

      it("should include 'beginner' tag for longboard skill level", () => {
        const result = transformBeachToSurfSpot(mockBeachLongboard);
        expect(result.intentTags).toContain("beginner");
      });

      it("should include 'least-crowded' tag for light crowd", () => {
        const result = transformBeachToSurfSpot(mockBeachLightCrowd);
        expect(result.intentTags).toContain("least-crowded");
      });

      it("should include 'least-crowded' tag for low crowd", () => {
        const beachLow: BeachWithMetrics = {
          ...mockBeachComplete,
          crowd_level: "Low",
        };

        const result = transformBeachToSurfSpot(beachLow);
        expect(result.intentTags).toContain("least-crowded");
      });

      it("should always include 'tide' tag", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.intentTags).toContain("tide");
      });

      it("should always include 'water-temp' tag", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.intentTags).toContain("water-temp");
      });

      it("should NOT include 'beginner' tag for intermediate level", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.intentTags).not.toContain("beginner");
      });

      it("should NOT include 'least-crowded' tag for moderate crowd", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.intentTags).not.toContain("least-crowded");
      });

      it("should return array with correct length for beginner light-crowd beach", () => {
        const beachBeginnerLight: BeachWithMetrics = {
          ...mockBeachBeginner,
          crowd_level: "Light",
        };

        const result = transformBeachToSurfSpot(beachBeginnerLight);
        // beginner + least-crowded + tide + water-temp = 4
        expect(result.intentTags).toHaveLength(4);
      });

      it("should return array with minimum 2 tags", () => {
        const result = transformBeachToSurfSpot(mockBeachAdvanced);
        // tide + water-temp = 2 (no beginner, no least-crowded)
        expect(result.intentTags.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe("Basic Field Mapping", () => {
      it("should preserve slug", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.slug).toBe(mockBeachComplete.slug);
      });

      it("should preserve name", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.name).toBe(mockBeachComplete.name);
      });

      it("should map region from beach.region", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.region).toBe(mockBeachComplete.region);
      });

      it("should fallback to city/state for region when beach.region is null", () => {
        const beachNoRegion: BeachWithMetrics = {
          ...mockBeachComplete,
          region: null as unknown as string,
        };

        const result = transformBeachToSurfSpot(beachNoRegion);
        expect(result.region).toBe("San Diego, CA");
      });

      it("should map description to overview", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.overview).toBe(mockBeachComplete.description);
      });

      it("should fallback to default overview when description is null", () => {
        const result = transformBeachToSurfSpot(mockBeachMinimal);
        expect(result.overview).toBe("No description available.");
      });

      it("should map best_conditions_prose to conditions", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.conditions).toBe(mockBeachComplete.best_conditions_prose);
      });

      it("should map wave_tips to swellAdvice", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.swellAdvice).toBe(mockBeachComplete.wave_tips);
      });

      it("should map hazards array", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.hazards).toEqual(mockBeachComplete.hazards);
      });

      it("should handle null hazards", () => {
        const result = transformBeachToSurfSpot(mockBeachMinimal);
        // Should be null or empty, not throw
        expect(result.hazards).toBeDefined();
      });

      it("should map best_months to bestSeason", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.bestSeason).toBe(mockBeachComplete.best_months);
      });

      it("should map parking_tips to parking", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.parking).toBe(mockBeachComplete.parking_tips);
      });

      it("should fallback to access_tips for parking when parking_tips is null", () => {
        const beachNoParking: BeachWithMetrics = {
          ...mockBeachComplete,
          parking_tips: null as unknown as string,
        };

        const result = transformBeachToSurfSpot(beachNoParking);
        expect(result.parking).toBe(mockBeachComplete.access_tips);
      });

      it("should map features to amenities", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.amenities).toEqual(mockBeachComplete.features);
      });
    });

    describe("Beginner Notes", () => {
      it("should add beginnerNotes for beginner skill level", () => {
        const result = transformBeachToSurfSpot(mockBeachBeginner);
        expect(result.beginnerNotes).toBe("This spot is suitable for beginners.");
      });

      it("should NOT add beginnerNotes for intermediate skill level", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.beginnerNotes).toBeUndefined();
      });

      it("should NOT add beginnerNotes for advanced skill level", () => {
        const result = transformBeachToSurfSpot(mockBeachAdvanced);
        expect(result.beginnerNotes).toBeUndefined();
      });
    });

    describe("Speakable Summary", () => {
      it("should use description for speakableSummary", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.speakableSummary).toBe(mockBeachComplete.description);
      });

      it("should generate fallback speakableSummary when description is null", () => {
        const result = transformBeachToSurfSpot(mockBeachMinimal);
        expect(result.speakableSummary).toContain(mockBeachMinimal.name);
        expect(result.speakableSummary).toContain("surf spot");
      });
    });

    describe("Default/Empty Field Values", () => {
      it("should set history to empty string", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.history).toBe("");
      });

      it("should set tideAdvice to empty string", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.tideAdvice).toBe("");
      });

      it("should set windAdvice to empty string", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.windAdvice).toBe("");
      });

      it("should set waterTemp to empty string", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.waterTemp).toBe("");
      });

      it("should set nearby to empty array", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.nearby).toEqual([]);
      });

      it("should set faq to empty array", () => {
        const result = transformBeachToSurfSpot(mockBeachComplete);
        expect(result.faq).toEqual([]);
      });
    });
  });

  describe("transformBeachesToSurfSpots (Batch)", () => {
    it("should transform an array of beaches correctly", () => {
      const results = transformBeachesToSurfSpots(mockBeachCollection);

      expect(results).toHaveLength(mockBeachCollection.length);
      expect(results[0].name).toBe(mockBeachCollection[0].name);
      expect(results[5].name).toBe(mockBeachCollection[5].name);
    });

    it("should preserve order of beaches", () => {
      const results = transformBeachesToSurfSpots(mockBeachCollection);

      mockBeachCollection.forEach((beach, index) => {
        expect(results[index].slug).toBe(beach.slug);
      });
    });

    it("should handle empty array", () => {
      const results = transformBeachesToSurfSpots(mockBeachCollectionEmpty);

      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });

    it("should handle single beach array", () => {
      const results = transformBeachesToSurfSpots([mockBeachComplete]);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe(mockBeachComplete.name);
    });

    it("should map all coordinates correctly in batch", () => {
      const results = transformBeachesToSurfSpots(mockBeachCollection);

      results.forEach((result, index) => {
        const original = mockBeachCollection[index];
        expect(result.coordinates.lat).toBe(original.lat);
        expect(result.coordinates.lng).toBe(original.lon);
      });
    });
  });

  describe("validateBeachCoordinates", () => {
    it("should return true for valid coordinates", () => {
      const result = validateBeachCoordinates(mockBeachComplete, "test");
      expect(result).toBe(true);
    });

    it("should return false for null lat", () => {
      const result = validateBeachCoordinates(mockBeachMinimal, "test");
      expect(result).toBe(false);
    });

    it("should return false for null lon", () => {
      const beachNullLon: BeachWithMetrics = {
        ...mockBeachComplete,
        lon: null as unknown as number,
      };

      const result = validateBeachCoordinates(beachNullLon, "test");
      expect(result).toBe(false);
    });

    it("should return false for lat > 90", () => {
      const result = validateBeachCoordinates(mockBeachInvalidCoords, "test");
      expect(result).toBe(false);
    });

    it("should return false for lat < -90", () => {
      const beachInvalid: BeachWithMetrics = {
        ...mockBeachComplete,
        lat: -100,
      };

      const result = validateBeachCoordinates(beachInvalid, "test");
      expect(result).toBe(false);
    });

    it("should return false for lon > 180", () => {
      const beachInvalid: BeachWithMetrics = {
        ...mockBeachComplete,
        lon: 200,
      };

      const result = validateBeachCoordinates(beachInvalid, "test");
      expect(result).toBe(false);
    });

    it("should return false for lon < -180", () => {
      const result = validateBeachCoordinates(mockBeachInvalidCoords, "test");
      expect(result).toBe(false);
    });

    it("should return false for NaN lat", () => {
      const beachNaN: BeachWithMetrics = {
        ...mockBeachComplete,
        lat: NaN,
      };

      const result = validateBeachCoordinates(beachNaN, "test");
      expect(result).toBe(false);
    });

    it("should return false for NaN lon", () => {
      const beachNaN: BeachWithMetrics = {
        ...mockBeachComplete,
        lon: NaN,
      };

      const result = validateBeachCoordinates(beachNaN, "test");
      expect(result).toBe(false);
    });

    it("should return true for edge case: exactly 90 lat", () => {
      const beachEdge: BeachWithMetrics = {
        ...mockBeachComplete,
        lat: 90,
        lon: 0,
      };

      const result = validateBeachCoordinates(beachEdge, "test");
      expect(result).toBe(true);
    });

    it("should return true for edge case: exactly -90 lat", () => {
      const beachEdge: BeachWithMetrics = {
        ...mockBeachComplete,
        lat: -90,
        lon: 0,
      };

      const result = validateBeachCoordinates(beachEdge, "test");
      expect(result).toBe(true);
    });

    it("should return true for edge case: exactly 180 lon", () => {
      const beachEdge: BeachWithMetrics = {
        ...mockBeachComplete,
        lat: 0,
        lon: 180,
      };

      const result = validateBeachCoordinates(beachEdge, "test");
      expect(result).toBe(true);
    });

    it("should return true for edge case: exactly -180 lon", () => {
      const beachEdge: BeachWithMetrics = {
        ...mockBeachComplete,
        lat: 0,
        lon: -180,
      };

      const result = validateBeachCoordinates(beachEdge, "test");
      expect(result).toBe(true);
    });

    it("should log warning in development for invalid coordinates", () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      validateBeachCoordinates(mockBeachInvalidCoords, "test-context");

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain("Invalid coordinates");
      expect(consoleSpy.mock.calls[0][0]).toContain("test-context");

      consoleSpy.mockRestore();
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("Type Safety", () => {
    it("should return object with all required SurfSpot fields", () => {
      const result = transformBeachToSurfSpot(mockBeachComplete);

      // Required fields
      expect(result).toHaveProperty("slug");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("citySlug");
      expect(result).toHaveProperty("region");
      expect(result).toHaveProperty("coordinates");
      expect(result).toHaveProperty("coordinates.lat");
      expect(result).toHaveProperty("coordinates.lng");
      expect(result).toHaveProperty("overview");
      expect(result).toHaveProperty("history");
      expect(result).toHaveProperty("conditions");
      expect(result).toHaveProperty("tideAdvice");
      expect(result).toHaveProperty("swellAdvice");
      expect(result).toHaveProperty("windAdvice");
      expect(result).toHaveProperty("waterTemp");
      expect(result).toHaveProperty("hazards");
      expect(result).toHaveProperty("skillLevel");
      expect(result).toHaveProperty("bestSeason");
      expect(result).toHaveProperty("crowdFactor");
      expect(result).toHaveProperty("parking");
      expect(result).toHaveProperty("amenities");
      expect(result).toHaveProperty("nearby");
      expect(result).toHaveProperty("faq");
      expect(result).toHaveProperty("speakableSummary");
      expect(result).toHaveProperty("intentTags");
    });

    it("should have correct types for coordinate values", () => {
      const result = transformBeachToSurfSpot(mockBeachComplete);

      expect(typeof result.coordinates.lat).toBe("number");
      expect(typeof result.coordinates.lng).toBe("number");
    });

    it("should have intentTags as array of strings", () => {
      const result = transformBeachToSurfSpot(mockBeachComplete);

      expect(Array.isArray(result.intentTags)).toBe(true);
      result.intentTags.forEach((tag) => {
        expect(typeof tag).toBe("string");
      });
    });
  });
});
