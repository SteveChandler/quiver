/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET } from "@/app/api/cron/water-quality-sync/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  evaluateWaterQuality,
  syncWQSamples,
  syncWQStations,
} from "@/lib/services/water-quality";

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: async () => ({
      success: true,
      data,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: async () => ({
      success: false,
      error,
      details,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  handleApiError: jest.fn((error) => ({
    json: async () => ({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn((_options: unknown, handler) => handler()),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/services/water-quality", () => ({
  syncWQStations: jest.fn(),
  syncWQSamples: jest.fn(),
  evaluateWaterQuality: jest.fn(),
}));

describe("water quality sync cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/water-quality-sync/route.ts",
    "utf8"
  );

  const supabase = { from: jest.fn() };
  const stationResult = {
    statesFetched: 2,
    stationsParsed: 10,
    stationsMatched: 8,
    stationsUpserted: 8,
    errors: [],
    duration_ms: 123,
  };
  const sampleResult = {
    statesFetched: 2,
    samplesParsed: 20,
    samplesMatched: 18,
    samplesUpserted: 18,
    futureSamplesRejected: 0,
    errors: [],
    duration_ms: 234,
  };
  const evaluationResult = {
    beachesEvaluated: 4,
    statusCounts: { good: 3, advisory: 1, closure: 0, unknown: 0 },
    statusChanges: 1,
    errors: [],
    duration_ms: 345,
  };

  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (syncWQStations as jest.Mock).mockResolvedValue(stationResult);
    (syncWQSamples as jest.Mock).mockResolvedValue(sampleResult);
    (evaluateWaterQuality as jest.Mock).mockResolvedValue(evaluationResult);
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
    expect(routeSource).toContain("withCronOutcome");
    expect(routeSource).toContain('unit: "stations_synced"');
    expect(routeSource).toContain('unit: "samples_stored"');
    expect(routeSource).toContain('unit: "beaches_evaluated"');
  });

  it("rejects unauthorized cron requests before creating a Supabase client", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/water-quality-sync?phase=stations")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      success: false,
      error: "Unauthorized",
      details: "Invalid cron authentication",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(syncWQStations).not.toHaveBeenCalled();
    expect(syncWQSamples).not.toHaveBeenCalled();
    expect(evaluateWaterQuality).not.toHaveBeenCalled();
  });

  it("rejects missing or invalid phases before creating a Supabase client", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/water-quality-sync")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: "Invalid phase",
      details: 'Query param "phase" must be "stations", "samples", or "evaluate"',
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
  });

  it("runs the stations phase and returns the station sync result", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/water-quality-sync?phase=stations")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(createSupabaseServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(syncWQStations).toHaveBeenCalledWith(supabase);
    expect(syncWQSamples).not.toHaveBeenCalled();
    expect(evaluateWaterQuality).not.toHaveBeenCalled();
    expect(data).toEqual({
      success: true,
      data: { phase: "stations", result: stationResult },
      timestamp: "2026-05-26T00:00:00.000Z",
    });
  });

  it("runs the samples phase and returns the sample sync result", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/water-quality-sync?phase=samples")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(syncWQSamples).toHaveBeenCalledWith(supabase);
    expect(syncWQStations).not.toHaveBeenCalled();
    expect(evaluateWaterQuality).not.toHaveBeenCalled();
    expect(data.data).toEqual({ phase: "samples", result: sampleResult });
  });

  it("runs the evaluate phase and returns the evaluation result", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/water-quality-sync?phase=evaluate")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(evaluateWaterQuality).toHaveBeenCalledWith(supabase);
    expect(syncWQStations).not.toHaveBeenCalled();
    expect(syncWQSamples).not.toHaveBeenCalled();
    expect(data.data).toEqual({
      phase: "evaluate",
      result: evaluationResult,
    });
  });
});
