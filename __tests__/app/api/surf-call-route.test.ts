/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/surf/call/route";
import { getSpotSurfReport } from "@/actions/spot/spot-surf-report-actions";

const mockSupabase = {
  from: jest.fn(),
};

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    withAuth:
      (handler: (request: NextRequest, context: { supabase: typeof mockSupabase }) => Promise<Response>) =>
      (request: NextRequest) =>
        handler(request, { supabase: mockSupabase }),
    withRateLimit:
      (handler: (request: NextRequest) => Promise<Response>) =>
      (request: NextRequest) =>
        handler(request),
    createSuccessResponse: actual.createSuccessResponse,
    validateOrError: actual.validateOrError,
  };
});

jest.mock("@/actions/spot/spot-surf-report-actions", () => ({
  getSpotSurfReport: jest.fn(),
}));

jest.mock("@/lib/utils/dev-force-verdict", () => ({
  applyForceVerdict: jest.fn((result) => result),
}));

function mockBeachQuery(beach: Record<string, unknown>) {
  const query: {
    select: jest.Mock;
    eq: jest.Mock;
    is: jest.Mock;
    single: jest.Mock;
  } = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    single: jest.fn().mockResolvedValue({ data: beach, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  mockSupabase.from.mockReturnValue(query);
  return query;
}

describe("GET /api/surf/call", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns forecastContext while preserving the existing report payload", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    const report = {
      verdict: "YES",
      whySentence: "Clean best-window surf.",
      waveHeight: "2.7 ft",
      windSpeed: "5 mph",
      windCompass: "W",
      score: 72,
      forecastConfidence: 80,
      lowForecastConfidence: false,
      rideableWavesPerHour: 25,
    };
    const forecastContext = {
      beachId,
      localDate: "2026-05-08",
      recommendationType: "best_window",
      contextType: "best_window",
      startTime: "2026-05-08T22:30:00.000Z",
      endTime: "2026-05-09T01:30:00.000Z",
      selectedWindowStart: "2026-05-08T22:30:00.000Z",
      selectedWindowEnd: "2026-05-09T01:30:00.000Z",
      displayWindowStart: "2026-05-08T22:45:00.000Z",
      displayWindowEnd: "2026-05-09T01:15:00.000Z",
      displayTimeLabel: "Best window: 3:30-6:30 PM",
      selectedRowTime: "2026-05-08T23:00:00.000Z",
      waveHeight: "2.7 ft",
      waveHeightFt: 2.7,
      waveHeightRangeLabel: "2-3 ft",
      swellPeriod: "13s",
      periodSec: 13,
      swellDirection: "SW",
      windSpeed: "5 mph",
      windDirection: "W",
      score: 72,
      confidence: 80,
      resolverUsed: "surf-call",
      source: "looking_ahead",
      timezone: "America/Los_Angeles",
      conditionDrivers: {
        wave: "2-3 ft",
        energy: "13s SW energy",
        wind: "5 mph W clean",
        tide: "3.1 ft rising",
      },
    };

    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      deleted_at: null,
    });
    (getSpotSurfReport as jest.Mock).mockResolvedValue({
      report,
      isTomorrow: false,
      forecastContext,
    });

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.report).toEqual(report);
    expect(body.data.forecastContext).toEqual(forecastContext);
  });
});
