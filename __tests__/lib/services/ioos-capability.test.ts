/**
 * @jest-environment node
 */
import { IOOSService, buildVariableMap } from "@/lib/services/ioos";
import { CanonicalVar } from "@/lib/constants/ioos-config";

describe("buildVariableMap", () => {
  it("should map available ERDDAP variables to canonical names", () => {
    const availableVars = [
      "time",
      "latitude",
      "longitude",
      "sea_surface_wave_significant_height",
      "sea_surface_wave_mean_period",
      "sea_surface_wave_from_direction",
      "sea_surface_temperature",
    ];

    const result = buildVariableMap(availableVars);

    expect(result.wave_height).toBe("sea_surface_wave_significant_height");
    expect(result.wave_period).toBe("sea_surface_wave_mean_period");
    expect(result.wave_direction).toBe("sea_surface_wave_from_direction");
    expect(result.water_temp).toBe("sea_surface_temperature");
    expect(result.wind_speed).toBeUndefined();
    expect(result.wind_direction).toBeUndefined();
  });

  it("should prefer earlier aliases (peak period over mean period)", () => {
    const availableVars = [
      "time",
      "sea_surface_wave_significant_height",
      "sea_surface_wave_period_at_variance_spectral_density_maximum",
      "sea_surface_wave_mean_period",
    ];

    const result = buildVariableMap(availableVars);

    // Should pick the peak period (first in alias list) over mean
    expect(result.wave_period).toBe(
      "sea_surface_wave_period_at_variance_spectral_density_maximum"
    );
  });

  it("should return empty object when no wave variables available", () => {
    const availableVars = ["time", "latitude", "longitude", "air_temperature"];

    const result = buildVariableMap(availableVars);

    expect(Object.keys(result)).toHaveLength(0);
  });
});

// Integration tests that hit real ERDDAP API
// These tests require network access
describe("IOOSService.fetchStationVariables", () => {
  it("should fetch and parse variables from ERDDAP /info endpoint", async () => {
    const service = new IOOSService();

    // Use a known CDIP station
    const result = await service.fetchStationVariables("edu_ucsd_cdip_073");

    // In case of network issues, allow graceful skip
    if (result === null) {
      console.warn("Network request returned null - skipping assertions (network may be unavailable in test environment)");
      return;
    }

    expect(result.availableVariables).toContain("time");
    expect(result.availableVariables).toContain("sea_surface_wave_significant_height");
    expect(result.variableMap.wave_height).toBe("sea_surface_wave_significant_height");
  }, 30000);

  it("should return null for non-existent station", async () => {
    const service = new IOOSService();

    const result = await service.fetchStationVariables("nonexistent_station_xyz");

    expect(result).toBeNull();
  }, 30000);
});

describe("buildDynamicObservationUrl", () => {
  // Import dynamically to avoid circular imports
  let buildDynamicObservationUrl: typeof import("@/lib/services/ioos").buildDynamicObservationUrl;

  beforeAll(async () => {
    // eslint-disable-next-line @next/next/no-assign-module-variable -- dynamic import binding, not reassigning global `module`
    const module = await import("@/lib/services/ioos");
    buildDynamicObservationUrl = module.buildDynamicObservationUrl;
  });

  const now = new Date("2026-01-22T12:00:00Z");

  it("should build URL with only available variables", () => {
    const variableMap = {
      wave_height: "sea_surface_wave_significant_height",
      wave_period: "sea_surface_wave_mean_period",
    };

    const url = buildDynamicObservationUrl("test_station", variableMap, now);

    expect(url).not.toBeNull();
    expect(url).toContain("test_station.json");
    expect(url).toContain("time");
    expect(url).toContain("sea_surface_wave_significant_height");
    expect(url).toContain("sea_surface_wave_mean_period");
    expect(url).not.toContain("water_temp");
  });

  it("should include proper time constraints with URL encoding", () => {
    const variableMap = {
      wave_height: "sea_surface_wave_significant_height",
    };

    const url = buildDynamicObservationUrl("test_station", variableMap, now);

    // Should have encoded time>= constraint (12 hours back from now)
    expect(url).toContain(encodeURIComponent("time>=2026-01-22T00:00:00Z"));
    // Should have encoded orderByMax
    expect(url).toContain(encodeURIComponent('orderByMax("time")'));
  });

  it("should return null when no wave variables available", () => {
    const variableMap = {}; // No wave height

    const url = buildDynamicObservationUrl("test_station", variableMap, now);

    expect(url).toBeNull();
  });
});

describe("parseObservationRow", () => {
  let parseObservationRow: typeof import("@/lib/services/ioos").parseObservationRow;

  beforeAll(async () => {
    // eslint-disable-next-line @next/next/no-assign-module-variable -- dynamic import binding, not reassigning global `module`
    const module = await import("@/lib/services/ioos");
    parseObservationRow = module.parseObservationRow;
  });

  it("should parse ERDDAP row into canonical observation", () => {
    const row = {
      time: "2026-01-22T10:30:00Z",
      sea_surface_wave_significant_height: 1.5,
      sea_surface_wave_mean_period: 8.2,
      sea_surface_wave_from_direction: 270,
      sea_surface_temperature: 15.5,
    };
    const variableMap = {
      wave_height: "sea_surface_wave_significant_height",
      wave_period: "sea_surface_wave_mean_period",
      wave_direction: "sea_surface_wave_from_direction",
      water_temp: "sea_surface_temperature",
    };

    const result = parseObservationRow(row, variableMap);

    expect(result).not.toBeNull();
    expect(result!.observedAt).toBe("2026-01-22T10:30:00Z");
    expect(result!.waveHeightM).toBe(1.5);
    expect(result!.wavePeriodS).toBe(8.2);
    expect(result!.waveDirectionDeg).toBe(270);
    expect(result!.waterTempC).toBe(15.5);
    expect(result!.windSpeedMS).toBeNull();
    expect(result!.windDirectionDeg).toBeNull();
  });

  it("should handle null/missing values gracefully", () => {
    const row = {
      time: "2026-01-22T10:30:00Z",
      sea_surface_wave_significant_height: 1.5,
      sea_surface_wave_mean_period: null,
    };
    const variableMap = {
      wave_height: "sea_surface_wave_significant_height",
      wave_period: "sea_surface_wave_mean_period",
    };

    const result = parseObservationRow(row, variableMap);

    expect(result!.waveHeightM).toBe(1.5);
    expect(result!.wavePeriodS).toBeNull();
  });

  it("should return null if time is missing", () => {
    const row = { sea_surface_wave_significant_height: 1.5 };
    const variableMap = { wave_height: "sea_surface_wave_significant_height" };

    const result = parseObservationRow(row, variableMap);

    expect(result).toBeNull();
  });
});
