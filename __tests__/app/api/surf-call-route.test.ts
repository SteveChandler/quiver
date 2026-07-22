/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/surf/call/route";
import { getSpotSurfReport } from "@/actions/spot/spot-surf-report-actions";

const mockSupabase = {
  from: jest.fn(),
};
const mockUser = {
  id: "native-user-123",
};

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    withAuth:
      (handler: (request: NextRequest, context: { user: typeof mockUser; supabase: typeof mockSupabase }) => Promise<Response>) =>
      (request: NextRequest) =>
        handler(request, { user: mockUser, supabase: mockSupabase }),
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

function mockSurfReportResult(beachId: string) {
  (getSpotSurfReport as jest.Mock).mockResolvedValue({
    report: {
      verdict: "YES",
      whySentence: "Clean best-window surf.",
      waveHeight: "2.7 ft",
      windSpeed: "5 mph",
      windCompass: "W",
      score: 72,
      forecastConfidence: 80,
      lowForecastConfidence: false,
      rideableWavesPerHour: 25,
    },
    isTomorrow: false,
    forecastContext: {
      beachId,
      localDate: "2026-05-08",
      recommendationType: "best_window",
      contextType: "best_window",
    },
  });
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

  it("passes a valid boardClass and auth context to getSpotSurfReport", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      deleted_at: null,
    });
    mockSurfReportResult(beachId);

    await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&boardClass=longboard`),
    );

    expect(getSpotSurfReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: beachId }),
      "longboard",
      { user: mockUser, supabase: mockSupabase }
    );
  });

  it("passes null for invalid boardClass values", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      deleted_at: null,
    });
    mockSurfReportResult(beachId);

    await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&boardClass=banana`),
    );

    expect(getSpotSurfReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: beachId }),
      null,
      { user: mockUser, supabase: mockSupabase }
    );
  });

  it("returns the exact private no-store cache policy", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      deleted_at: null,
    });
    mockSurfReportResult(beachId);

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
    );

    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, no-cache, must-revalidate",
    );
  });

  it("applies the exact no-store policy to validation errors", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/surf/call?beachId=invalid"),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, no-cache, must-revalidate",
    );
  });
});
