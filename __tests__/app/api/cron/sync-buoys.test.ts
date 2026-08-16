/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET } from "@/app/api/cron/sync-buoys/route";
import { NOAABuoySync } from "@/lib/services/noaa-sync";

const mockSyncBuoysForExistingBeaches = jest.fn();

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

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) =>
    handler()
  ),
}));

jest.mock("@/lib/services/noaa-sync", () => ({
  NOAABuoySync: jest.fn(() => ({
    syncBuoysForExistingBeaches: mockSyncBuoysForExistingBeaches,
  })),
}));

describe("sync buoys cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/sync-buoys/route.ts",
    "utf8"
  );

  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );
    mockSyncBuoysForExistingBeaches.mockResolvedValue({
      success: true,
      buoysAdded: 3,
      stationsAdded: 4,
    });
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
  });

  it("rejects unauthorized cron requests before creating the NOAA sync service", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/sync-buoys")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      success: false,
      error: "Unauthorized",
      details: "Invalid cron authentication",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(NOAABuoySync).not.toHaveBeenCalled();
    expect(mockSyncBuoysForExistingBeaches).not.toHaveBeenCalled();
  });

  it("runs the NOAA sync with the default max distance and returns the summary", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/sync-buoys")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(NOAABuoySync).toHaveBeenCalledTimes(1);
    expect(mockSyncBuoysForExistingBeaches).toHaveBeenCalledWith(250);
    expect(data).toEqual({
      success: true,
      data: {
        summary: {
          buoysAdded: 3,
          stationsAdded: 4,
          maxDistanceKm: 250,
        },
        message: "Synced 3 buoys from NOAA",
      },
      timestamp: "2026-05-26T00:00:00.000Z",
    });
  });

  it("passes the requested max distance through to the NOAA sync service", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/sync-buoys?maxDistanceKm=125")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockSyncBuoysForExistingBeaches).toHaveBeenCalledWith(125);
    expect(data.data.summary.maxDistanceKm).toBe(125);
  });

  it("returns the sync failure as a 500 response", async () => {
    mockSyncBuoysForExistingBeaches.mockResolvedValue({
      success: false,
      buoysAdded: 0,
      stationsAdded: 0,
      error: "NOAA unavailable",
    });

    const response = await GET(
      new Request("http://localhost/api/cron/sync-buoys")
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: "Sync failed",
      details: "NOAA unavailable",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
  });
});
