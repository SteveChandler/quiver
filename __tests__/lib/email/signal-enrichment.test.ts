import {
  enrichBeachSignals,
  type BeachSignalEnrichment,
} from "@/lib/email/signal-enrichment";

// Mock the heavy surf-domain engines so the test stays focused on this
// helper's query orchestration + graceful-degradation contract, not on the
// physics math (which is covered by the wave-frequency / scoring suites).
const mockCalculateRideableWaves = jest.fn();
jest.mock("@/lib/domains/wave-frequency", () => ({
  calculateRideableWaves: (...args: unknown[]) =>
    mockCalculateRideableWaves(...args),
}));

const mockGetConditionCharacter = jest.fn();
const mockBeachToSpotProfile = jest.fn((..._args: unknown[]) => ({
  profile: true,
}));
const mockForecastToSnapshot = jest.fn((..._args: unknown[]) => ({
  snapshot: true,
}));
const mockEngineScore = jest.fn((..._args: unknown[]) => ({ composite: true }));
jest.mock("@/lib/domains/scoring", () => ({
  getConditionCharacter: (...args: unknown[]) =>
    mockGetConditionCharacter(...args),
  beachToSpotProfile: (...args: unknown[]) => mockBeachToSpotProfile(...args),
  forecastToSnapshot: (...args: unknown[]) => mockForecastToSnapshot(...args),
  createDiscoveryScoringEngine: () => ({ score: mockEngineScore }),
}));

const BEACH_ID = "11111111-1111-1111-1111-111111111111";
const LOCAL_DATE = "2026-06-13";
// 2026-06-13 noon in America/Los_Angeles is 19:00 UTC.
const FORECAST_AT_UTC = "2026-06-13T19:00:00.000Z";

interface SourceConfig {
  data?: unknown;
  error?: { message: string } | null;
  throws?: Error | null;
}

/**
 * Builds a Supabase mock that routes by table name. Each table's behaviour is
 * configured independently so a single source can be made to return data,
 * return null/empty, error, or throw without affecting the others.
 */
function createEnrichmentSupabaseMock(config: {
  beaches?: SourceConfig;
  rip_current_risks?: SourceConfig;
  enhanced_forecasts?: SourceConfig;
  beach_water_quality?: SourceConfig;
}) {
  const fromMock = jest.fn((table: string) => {
    const source = config[table as keyof typeof config];

    const resolve = () => {
      if (source?.throws) {
        return Promise.reject(source.throws);
      }
      return Promise.resolve({
        data: source?.data ?? null,
        error: source?.error ?? null,
      });
    };

    // A thenable builder so every fluent chain (.eq/.gte/.lt/.order/.maybeSingle)
    // returns the same object and finally resolves to the configured result.
    const builder: Record<string, unknown> = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      gte: jest.fn(() => builder),
      lt: jest.fn(() => builder),
      order: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      maybeSingle: jest.fn(resolve),
      single: jest.fn(resolve),
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => resolve().then(onFulfilled, onRejected),
    };

    return builder;
  });

  return { supabase: { from: fromMock }, fromMock };
}

function beachRow() {
  return {
    id: BEACH_ID,
    timezone: "America/Los_Angeles",
    break_type: "beach",
  };
}

function forecastRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "forecast-1",
    beach_id: BEACH_ID,
    forecast_at: FORECAST_AT_UTC,
    wave_height: "3-4 ft",
    confidence_score: 82,
    ...overrides,
  };
}

describe("enrichBeachSignals", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCalculateRideableWaves.mockReturnValue({
      rideableWavesPerHour: 14,
      confidence: "high",
      swellTrains: 2,
      dominantBeatIntervalS: 180,
    });
    mockGetConditionCharacter.mockReturnValue({
      category: "medium-clean",
      label: "Dialed — everything's lining up",
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns every signal when all sources have data", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { data: { risk_level: "moderate" } },
      enhanced_forecasts: { data: [forecastRow()] },
      beach_water_quality: { data: { status: "advisory" } },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    const expected: BeachSignalEnrichment = {
      ripRisk: "moderate",
      rideableWavesPerHour: 14,
      setIntervalSeconds: 180,
      waveFrequencyConfidence: "high",
      forecastConfidence: 82,
      conditionCharacter: "Dialed — everything's lining up",
      waterQuality: "advisory",
    };
    expect(result).toEqual(expected);
  });

  it("queries the rip-current table by beach id and local date", async () => {
    const { supabase, fromMock } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { data: { risk_level: "high" } },
      enhanced_forecasts: { data: [forecastRow()] },
    });

    await enrichBeachSignals(supabase as never, BEACH_ID, LOCAL_DATE);

    expect(fromMock).toHaveBeenCalledWith("rip_current_risks");
  });

  it("returns null rip risk when the rip-current source has no row", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { data: null },
      enhanced_forecasts: { data: [forecastRow()] },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result.ripRisk).toBeNull();
    // Other signals still resolve.
    expect(result.rideableWavesPerHour).toBe(14);
    expect(result.forecastConfidence).toBe(82);
  });

  it("returns null rip risk (no throw) when the rip-current source errors", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { error: { message: "permission denied" } },
      enhanced_forecasts: { data: [forecastRow()] },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result.ripRisk).toBeNull();
    expect(result.conditionCharacter).toBe("Dialed — everything's lining up");
  });

  it("ignores rip-current values outside the known risk levels", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { data: { risk_level: "extreme" } },
      enhanced_forecasts: { data: [forecastRow()] },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result.ripRisk).toBeNull();
  });

  it.each(["good", "advisory", "closure", "unknown"] as const)(
    "surfaces water-quality status %s when the source has a row",
    async (status) => {
      const { supabase, fromMock } = createEnrichmentSupabaseMock({
        beaches: { data: beachRow() },
        rip_current_risks: { data: { risk_level: "low" } },
        enhanced_forecasts: { data: [forecastRow()] },
        beach_water_quality: { data: { status } },
      });

      const result = await enrichBeachSignals(
        supabase as never,
        BEACH_ID,
        LOCAL_DATE
      );

      expect(fromMock).toHaveBeenCalledWith("beach_water_quality");
      expect(result.waterQuality).toBe(status);
    }
  );

  it("returns null water quality when the source has no row", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { data: { risk_level: "low" } },
      enhanced_forecasts: { data: [forecastRow()] },
      beach_water_quality: { data: null },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result.waterQuality).toBeNull();
    // Other signals still resolve.
    expect(result.rideableWavesPerHour).toBe(14);
  });

  it("returns null water quality (no throw) when the source errors", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { data: { risk_level: "low" } },
      enhanced_forecasts: { data: [forecastRow()] },
      beach_water_quality: { error: { message: "permission denied" } },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result.waterQuality).toBeNull();
    // Independent sources still resolve.
    expect(result.ripRisk).toBe("low");
    expect(result.conditionCharacter).toBe("Dialed — everything's lining up");
  });

  it("ignores water-quality values outside the known status set", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { data: { risk_level: "low" } },
      enhanced_forecasts: { data: [forecastRow()] },
      beach_water_quality: { data: { status: "contaminated" } },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result.waterQuality).toBeNull();
  });

  it("nulls wave-frequency, confidence, and character when no forecast rows match the local date", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { data: { risk_level: "low" } },
      enhanced_forecasts: { data: [] },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result.ripRisk).toBe("low");
    expect(result.rideableWavesPerHour).toBeNull();
    expect(result.setIntervalSeconds).toBeNull();
    expect(result.waveFrequencyConfidence).toBeNull();
    expect(result.forecastConfidence).toBeNull();
    expect(result.conditionCharacter).toBeNull();
  });

  it("nulls wave + character signals when the forecast source errors, but keeps rip risk", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { data: { risk_level: "moderate" } },
      enhanced_forecasts: { error: { message: "boom" } },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result.ripRisk).toBe("moderate");
    expect(result.rideableWavesPerHour).toBeNull();
    expect(result.forecastConfidence).toBeNull();
    expect(result.conditionCharacter).toBeNull();
  });

  it("does not throw when a source rejects (network failure)", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { throws: new Error("network down") },
      rip_current_risks: { throws: new Error("network down") },
      enhanced_forecasts: { throws: new Error("network down") },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result).toEqual({
      ripRisk: null,
      rideableWavesPerHour: null,
      setIntervalSeconds: null,
      waveFrequencyConfidence: null,
      forecastConfidence: null,
      conditionCharacter: null,
      waterQuality: null,
    });
  });

  it("nulls only the character when the scoring engine throws", async () => {
    mockGetConditionCharacter.mockImplementation(() => {
      throw new Error("scoring blew up");
    });
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: beachRow() },
      rip_current_risks: { data: { risk_level: "low" } },
      enhanced_forecasts: { data: [forecastRow()] },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result.conditionCharacter).toBeNull();
    // Wave-frequency + confidence are independent and still resolve.
    expect(result.rideableWavesPerHour).toBe(14);
    expect(result.forecastConfidence).toBe(82);
  });

  it("nulls wave + character signals when the beach row is missing, but keeps rip + confidence", async () => {
    const { supabase } = createEnrichmentSupabaseMock({
      beaches: { data: null },
      rip_current_risks: { data: { risk_level: "high" } },
      enhanced_forecasts: { data: [forecastRow()] },
    });

    const result = await enrichBeachSignals(
      supabase as never,
      BEACH_ID,
      LOCAL_DATE
    );

    expect(result.ripRisk).toBe("high");
    // No Beach object → wave-frequency + character can't run.
    expect(result.rideableWavesPerHour).toBeNull();
    expect(result.setIntervalSeconds).toBeNull();
    expect(result.waveFrequencyConfidence).toBeNull();
    expect(result.conditionCharacter).toBeNull();
    // confidence_score lives on the forecast row, not the beach, so it survives.
    expect(result.forecastConfidence).toBe(82);
  });
});
