/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET } from "@/app/api/cron/water-quality-alerts/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { processWaterQualityAlerts } from "@/lib/services/water-quality/water-quality-alerts-service";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

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

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/services/water-quality/water-quality-alerts-service", () => ({
  processWaterQualityAlerts: jest.fn(),
}));

describe("water quality alerts cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/water-quality-alerts/route.ts",
    "utf8"
  );

  const supabase = { from: jest.fn() };
  const alertResult = {
    beachesWithChanges: 2,
    notificationsSent: 3,
    notificationsSkipped: 1,
    errors: [],
  };

  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (processWaterQualityAlerts as jest.Mock).mockResolvedValue(alertResult);
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

  it("rejects unauthorized cron requests before creating a Supabase client", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/water-quality-alerts")
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
    expect(processWaterQualityAlerts).not.toHaveBeenCalled();
  });

  it("processes water quality alerts and returns the service result", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/water-quality-alerts")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(createSupabaseServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(processWaterQualityAlerts).toHaveBeenCalledWith(supabase);
    expect(data).toEqual({
      success: true,
      data: { result: alertResult },
      timestamp: "2026-05-26T00:00:00.000Z",
    });
  });
});
