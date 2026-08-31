/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/surf/call/route";

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

jest.mock("@/lib/utils/dev-force-verdict", () => ({
  applyForceVerdict: jest.fn((result) => result),
}));

const mockCheckBoardFit = jest.fn((..._args: unknown[]) => ({
  penalty: 0,
  bonus: 0,
  note: "in the sweet spot for your longboard",
}));
jest.mock("@/lib/domains/scoring/discovery-adapter", () => {
  const actual = jest.requireActual("@/lib/domains/scoring/discovery-adapter");
  return {
    ...actual,
    checkBoardFit: (...args: unknown[]) => mockCheckBoardFit(...args),
  };
});

const mockResolveCanonicalSessionDecisionContext = jest.fn();
jest.mock("@/lib/recommendations/canonical-decision", () => ({
  resolveCanonicalSessionDecisionContext: (...args: unknown[]) =>
    mockResolveCanonicalSessionDecisionContext(...args),
}));

const mockGetProfileExperienceLevel = jest.fn();
jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: (...args: unknown[]) =>
    mockGetProfileExperienceLevel(...args),
}));

function mockBeachQuery(
  beach: Record<string, unknown>,
  forecastRows: Array<{ forecast_at: string }> = [],
) {
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
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "user_entitlements") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({ data: null, error: null })),
          })),
        })),
      };
    }
    if (table === "enhanced_forecasts") {
      const forecastQuery = {
        select: jest.fn(),
        eq: jest.fn(),
        gte: jest.fn(),
        lte: jest.fn(),
        order: jest.fn().mockResolvedValue({
          data: forecastRows,
          error: null,
        }),
      };
      forecastQuery.select.mockReturnValue(forecastQuery);
      forecastQuery.eq.mockReturnValue(forecastQuery);
      forecastQuery.gte.mockReturnValue(forecastQuery);
      forecastQuery.lte.mockReturnValue(forecastQuery);
      return forecastQuery;
    }
    return query;
  });
  return query;
}

let canonicalContext: {
  decision: Record<string, unknown>;
  discovery: {
    recommendations: Array<Record<string, unknown>>;
    includedRecommendations: Array<Record<string, unknown>>;
    recommendationAvailability: Record<string, unknown>;
  };
};

describe("GET /api/surf/call", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfileExperienceLevel.mockResolvedValue("intermediate");
    const decision = {
      schemaVersion: "canonical-session-decision.v1",
      engineVersion: "rules.v1",
      decisionId: "d".repeat(64),
      verdict: "maybe",
      decisionBasis: "physical_fallback",
      reasonCode: "selected_maybe",
      selection: {
        candidateId: "candidate-surf-call",
        beachId: "11111111-1111-4111-8111-111111111111",
        beachName: "Ocean Beach Pier",
        windowStart: "2026-05-08T22:30:00.000Z",
        windowEnd: "2026-05-09T01:30:00.000Z",
        timezone: "America/Los_Angeles",
        forecastRef: {
          forecastId: "forecast-1",
          beachId: "11111111-1111-4111-8111-111111111111",
          forecastAt: "2026-05-08T22:00:00.000Z",
        },
        skillEligibility: {
          skill: "intermediate",
          state: "eligible",
          reasonCodes: [],
        },
        evidence: {
          conditionScore: 72,
          recommendationLabel: "Maybe",
          personalMatch: null,
        },
      },
    };
    canonicalContext = {
      decision,
      discovery: {
        recommendations: [
          {
            recommendationId: "candidate-surf-call",
            beach: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Ocean Beach Pier",
            },
            window: {
              start: new Date("2026-05-08T22:30:00.000Z"),
              end: new Date("2026-05-09T01:30:00.000Z"),
              peakTime: new Date("2026-05-08T23:00:00.000Z"),
              timezone: "America/Los_Angeles",
              tide: "3.1 ft rising",
              wind: "5 mph W",
              waveHeight: "2.7 ft",
              wavePeriod: "13s",
              confidence: 80,
              score: 72,
            },
            forecast: {
              id: "forecast-1",
              beach_id: "11111111-1111-4111-8111-111111111111",
              forecast_at: "2026-05-08T22:00:00.000Z",
              wave_height: "2.7 ft",
              wave_period: "13s",
              wind_speed: "5 mph",
              wind_direction: "W",
              tide_height: "3.1",
              tide_status: "rising",
            },
            score: 72,
          },
        ],
        includedRecommendations: [],
        recommendationAvailability: {
          state: "available",
          holdEpoch: "surf-call-test",
        },
      },
    };
    mockResolveCanonicalSessionDecisionContext.mockResolvedValue(
      canonicalContext,
    );
  });

  it("uses the canonical decision as the Surf Call verdict authority", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    const beachQuery = mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      timezone: "America/Los_Angeles",
      deleted_at: null,
    });
    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
    );
    const body = await response.json();

    expect(mockResolveCanonicalSessionDecisionContext).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateBeachIds: [beachId],
        discoveryOptions: expect.objectContaining({
          candidatePoolLimit: 1,
          throwOnFailure: true,
        }),
      }),
    );
    expect(beachQuery.select).toHaveBeenCalledWith(
      expect.stringContaining(
        "max_wind_onshore_mph, max_wind_any_mph, swell_window_min_deg, swell_window_max_deg",
      ),
    );
    expect(beachQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("shoaling_factors"),
    );
    expect(body.data.sessionDecision).toMatchObject({
      decisionId: "d".repeat(64),
      verdict: "maybe",
      selection: { beachId },
    });
    expect(body.data.report.verdict).toBe("MAYBE");
  });

  it("returns a retryable error when canonical discovery fails operationally", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      timezone: "America/Los_Angeles",
      deleted_at: null,
    });
    mockResolveCanonicalSessionDecisionContext.mockRejectedValueOnce(
      Object.assign(new Error("Forecast service unavailable"), {
        code: "forecast_unavailable",
      }),
    );

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      retryable: true,
      code: "forecast_unavailable",
    });
  });

  it("scores a validated forecastAt through the canonical discovery path", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    const forecastAt = "2026-05-08T22:00:00.000Z";
    mockBeachQuery(
      {
        id: beachId,
        name: "Ocean Beach Pier",
        slug: "ocean-beach-pier",
        lat: 32.75,
        lon: -117.25,
        timezone: "America/Los_Angeles",
        deleted_at: null,
      },
      [{ forecast_at: forecastAt }],
    );

    const response = await GET(
      new NextRequest(
        `http://localhost:3000/api/surf/call?beachId=${beachId}&forecastAt=${encodeURIComponent(forecastAt)}`,
      ),
    );
    const body = await response.json();

    expect(mockResolveCanonicalSessionDecisionContext).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateBeachIds: [beachId],
        discoveryOptions: expect.objectContaining({ forecastAt }),
        scope: expect.objectContaining({
          windowStart: "2026-05-08T20:30:00.000Z",
        }),
      }),
    );
    expect(body.data.forecastAlignment).toEqual({
      requestedForecastAt: forecastAt,
      matchedForecastAt: forecastAt,
      matchType: "exact",
      deltaMinutes: 0,
    });
  });

  it("reports a nearest canonical forecast match within 90 minutes", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    const forecastAt = "2026-05-08T22:45:00.000Z";
    mockBeachQuery(
      {
        id: beachId,
        name: "Ocean Beach Pier",
        slug: "ocean-beach-pier",
        lat: 32.75,
        lon: -117.25,
        timezone: "America/Los_Angeles",
        deleted_at: null,
      },
      [{ forecast_at: "2026-05-08T22:00:00.000Z" }],
    );

    const response = await GET(
      new NextRequest(
        `http://localhost:3000/api/surf/call?beachId=${beachId}&forecastAt=${encodeURIComponent(forecastAt)}`,
      ),
    );
    const body = await response.json();

    expect(body.data.forecastAlignment).toEqual({
      requestedForecastAt: forecastAt,
      matchedForecastAt: "2026-05-08T22:00:00.000Z",
      matchType: "nearest",
      deltaMinutes: 45,
    });
  });

  it("reports no alignment instead of binding to an unrelated canonical row", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    const forecastAt = "2026-05-09T03:00:00.000Z";
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      timezone: "America/Los_Angeles",
      deleted_at: null,
    });

    const response = await GET(
      new NextRequest(
        `http://localhost:3000/api/surf/call?beachId=${beachId}&forecastAt=${encodeURIComponent(forecastAt)}`,
      ),
    );
    const body = await response.json();

    expect(body.data.forecastAlignment).toEqual({
      requestedForecastAt: forecastAt,
      matchedForecastAt: null,
      matchType: "none",
      deltaMinutes: null,
    });
  });

  it("reports an exact row even when safety rejects the recommendation", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    const forecastAt = "2026-05-08T22:00:00.000Z";
    canonicalContext = {
      decision: {
        ...canonicalContext.decision,
        verdict: "no",
        decisionBasis: "safety_override",
        reasonCode: "no_candidates",
        selection: null,
      },
      discovery: {
        ...canonicalContext.discovery,
        recommendations: [],
      },
    };
    mockResolveCanonicalSessionDecisionContext.mockResolvedValue(
      canonicalContext,
    );
    mockBeachQuery(
      {
        id: beachId,
        name: "Ocean Beach Pier",
        slug: "ocean-beach-pier",
        lat: 32.75,
        lon: -117.25,
        timezone: "America/Los_Angeles",
        deleted_at: null,
      },
      [{ forecast_at: forecastAt }],
    );

    const response = await GET(
      new NextRequest(
        `http://localhost:3000/api/surf/call?beachId=${beachId}&forecastAt=${encodeURIComponent(forecastAt)}`,
      ),
    );
    const body = await response.json();

    expect(body.data.report.verdict).toBe("NO");
    expect(body.data.report.score).toBeNull();
    expect(body.data.report.whySentence).toBe(
      "No personalized surf candidate was available for this call.",
    );
    expect(body.data.forecastAlignment).toEqual({
      requestedForecastAt: forecastAt,
      matchedForecastAt: forecastAt,
      matchType: "exact",
      deltaMinutes: 0,
    });
  });

  it("rejects an invalid forecastAt before canonical discovery", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";

    const response = await GET(
      new NextRequest(
        `http://localhost:3000/api/surf/call?beachId=${beachId}&forecastAt=not-a-timestamp`,
      ),
    );

    expect(response.status).toBe(400);
    expect(mockResolveCanonicalSessionDecisionContext).not.toHaveBeenCalled();
  });

  it("uses objective metrics from the exact canonical window", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      deleted_at: null,
    });
    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.report).toMatchObject({
      verdict: "MAYBE",
      bestWindowStart: "2026-05-08T22:30:00.000Z",
      bestWindowEnd: "2026-05-09T01:30:00.000Z",
      score: 72,
    });
    expect(body.data.forecastContext).toMatchObject({
      beachId,
      selectedWindowStart: "2026-05-08T22:30:00.000Z",
      selectedWindowEnd: "2026-05-09T01:30:00.000Z",
      selectedRowTime: "2026-05-08T22:00:00.000Z",
      waveHeight: "2.7 ft",
      windSpeed: "5 mph",
      windDirection: "W",
      score: 72,
      confidence: 80,
    });
  });

  it("keeps the exact objective window for a learned canonical NO", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    canonicalContext.decision = {
      ...canonicalContext.decision,
      verdict: "no",
      decisionBasis: "personal_match",
      reasonCode: "selected_no",
      selection: {
        ...(canonicalContext.decision.selection as Record<string, unknown>),
        evidence: {
          conditionScore: 72,
          recommendationLabel: "Maybe",
          personalMatch: {
            score: 3.4,
            label: "MEH",
            confidence: "high",
            sessionCount: 14,
            reasons: ["You usually pass on sessions like this."],
          },
        },
      },
    };
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      timezone: "America/Los_Angeles",
      deleted_at: null,
    });

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
    );
    const body = await response.json();

    expect(body.data.report).toMatchObject({
      verdict: "NO",
      bestWindowStart: "2026-05-08T22:30:00.000Z",
      bestWindowEnd: "2026-05-09T01:30:00.000Z",
      score: 72,
      whySentence: "You usually pass on sessions like this.",
    });
    expect(body.data.forecastContext).toMatchObject({
      startTime: "2026-05-08T22:30:00.000Z",
      endTime: "2026-05-09T01:30:00.000Z",
      score: 72,
    });
  });

  it("returns an explained NO and no selected window for a safety override", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    canonicalContext.decision = {
      ...canonicalContext.decision,
      verdict: "no",
      decisionBasis: "safety_override",
      reasonCode: "water_quality_closure",
      selection: null,
    };
    canonicalContext.discovery.recommendationAvailability = {
      state: "available",
      holdEpoch: "water-quality-test",
    };
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      timezone: "America/Los_Angeles",
      deleted_at: null,
    });

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
    );
    const body = await response.json();

    expect(body.data.report).toMatchObject({
      verdict: "NO",
      bestWindowStart: null,
      bestWindowEnd: null,
      whySentence: "Water quality is closed at this spot.",
    });
    expect(body.data.sessionDecision).toMatchObject({
      verdict: "no",
      decisionBasis: "safety_override",
      reasonCode: "water_quality_closure",
      selection: null,
    });
  });

  it("uses a valid boardClass as exact-window explanation context", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      deleted_at: null,
    });
    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&boardClass=longboard`),
    );
    const body = await response.json();

    expect(mockCheckBoardFit).toHaveBeenCalledWith(
      2.7,
      "intermediate",
      "longboard",
    );
    expect(body.data.report.whySentence).toContain(
      "Board fit: in the sweet spot for your longboard.",
    );
  });

  it("ignores invalid boardClass values", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      deleted_at: null,
    });
    await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&boardClass=banana`),
    );

    expect(mockCheckBoardFit).not.toHaveBeenCalled();
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

  describe("recommendation availability serialization", () => {
    const beachId = "11111111-1111-4111-8111-111111111111";

    function mockScopedBeach(): void {
      mockBeachQuery({
        id: beachId,
        name: "Ocean Beach Pier",
        slug: "ocean-beach-pier",
        lat: 32.75,
        lon: -117.25,
        timezone: "America/Los_Angeles",
        deleted_at: null,
      });
    }

    it("treats a successful empty scoped discovery as no_candidates, not an unresolved hold", async () => {
      // A single-beach call whose scoped discovery legitimately produced no
      // candidate is a real answer, not a failure to evaluate the safety hold.
      canonicalContext.discovery = {
        recommendations: [],
        includedRecommendations: [],
        recommendationAvailability:
          undefined as unknown as Record<string, unknown>,
      };
      mockScopedBeach();

      const response = await GET(
        new NextRequest(
          `http://localhost:3000/api/surf/call?beachId=${beachId}`,
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.report.recommendationAvailability).toEqual({
        state: "available",
        holdEpoch: "no-candidates",
      });
    });

    it("preserves an explicit major-event hold as a successful response", async () => {
      canonicalContext.discovery = {
        recommendations: [],
        includedRecommendations: [],
        recommendationAvailability: {
          state: "none",
          reasonCode: "major_event_hold",
          holdEpoch: "major-event-epoch",
        },
      };
      mockScopedBeach();

      const response = await GET(
        new NextRequest(
          `http://localhost:3000/api/surf/call?beachId=${beachId}`,
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.report.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "major_event_hold",
        holdEpoch: "major-event-epoch",
      });
    });
  });
});
