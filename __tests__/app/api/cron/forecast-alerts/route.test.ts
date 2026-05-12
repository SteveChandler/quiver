/**
 * Tests for forecast alerts cron route
 */

// Use lightweight NextRequest/NextResponse mock to avoid constructor issues
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

jest.mock("@/lib/api-utils", () => {
  const actual = jest.requireActual<typeof import("@/lib/api-utils")>(
    "@/lib/api-utils"
  );
  return {
    ...actual,
    validateCronRequest: jest.fn(() => true),
  };
});

jest.mock("@/lib/services/forecast-alerts", () => ({
  runForecastThresholdAlerts: jest.fn(async () => ({
    eligibleUsers: 1,
    eligibleBeachesProcessed: 1,
    sent: 1,
    durationMs: 123,
    skipped: {
      pushDisabled: 0,
      alertsDisabled: 0,
      mockUser: 0,
      noEligibleBeaches: 0,
      missingBeachSlug: 0,
      staleForecast: 0,
      missingForecast: 0,
      noGoodForecasts: 0,
      duplicateDailySummary: 0,
      dailyDigestDisabled: 0,
      noMatch: 0,
      sendFailed: 0,
      quietHours: 0,
    },
  })),
}));

describe("GET /api/cron/forecast-alerts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a success response with summary", async () => {
    const { GET } = await import("@/app/api/cron/forecast-alerts/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/forecast-alerts"));
    const json = await (res as Response).json();

    expect(json.success).toBe(true);
    expect(json.data.summary.sent).toBe(1);
  });
});
