/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/surf/call/route";
import { withRateLimit } from "@/lib/middleware/api-wrappers";
import { memoizedWaterQualityRead } from "@/lib/recommendations/major-event-hold/read-scope";
import { featureAccessOff, featureAccessOn } from "@/__tests__/setup/founding-access";
import fixture from "@/__tests__/fixtures/surf-call-skill-default-v1.json";

const mockSupabase = {
  from: jest.fn(),
};
const mockEqCalls: Array<[string, unknown]> = [];
const mockUser = {
  id: "native-user-123",
};
let mockRequestUser: typeof mockUser | null = mockUser;
let mockInvalidCredentials = false;
const mockRateLimitInvocations: string[] = [];

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  const withRateLimit = jest.fn(
    (
      handler: (request: NextRequest, context?: unknown) => Promise<Response>,
      key: string,
    ) =>
      (request: NextRequest, context?: unknown) => {
        mockRateLimitInvocations.push(key);
        return handler(request, context);
      },
  );
  return {
    withAuth:
      (handler: (request: NextRequest, context: { user: typeof mockUser | null; supabase: typeof mockSupabase }) => Promise<Response>, options?: { rejectInvalidCredentials?: boolean }) =>
      (request: NextRequest) => {
        if (options?.rejectInvalidCredentials && mockInvalidCredentials) {
          return actual.createAuthError();
        }
        return handler(request, { user: mockRequestUser, supabase: mockSupabase });
      },
    withRateLimit,
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
  note: "Good longboard size at 2–3 ft.",
}));
jest.mock("@/lib/domains/scoring/discovery-adapter", () => {
  const actual = jest.requireActual("@/lib/domains/scoring/discovery-adapter");
  return {
    ...actual,
    checkBoardFit: (...args: unknown[]) => mockCheckBoardFit(...args),
  };
});

const mockResolveCanonicalSessionDecisionContext = jest.fn();
const mockResolveWaterQualityHolds = jest.fn();
jest.mock("@/lib/recommendations/major-event-hold/water-quality", () => ({
  resolveWaterQualityHolds: (...args: unknown[]) => mockResolveWaterQualityHolds(...args),
}));
jest.mock("@/lib/recommendations/canonical-decision", () => ({
  resolveCanonicalSessionDecisionContext: (...args: unknown[]) =>
    mockResolveCanonicalSessionDecisionContext(...args),
}));

const mockResolveFeatureAccess = jest.fn(featureAccessOff);
jest.mock("@/lib/flags/founding-access", () => ({
  resolveFeatureAccess: (...args: Parameters<typeof featureAccessOff>) => mockResolveFeatureAccess(...args),
}));

const mockDiscoverSurfSpots = jest.fn();
jest.mock("@/lib/services/surf-discovery-service", () => ({
  discoverSurfSpots: (...args: unknown[]) => mockDiscoverSurfSpots(...args),
}));

describe("surf-call rate limiting", () => {
  it("uses the dedicated surf-call bucket", () => {
    expect(withRateLimit).toHaveBeenCalledWith(
      expect.any(Function),
      "surf-call",
    );
  });
});

jest.mock("@/lib/services/discovery/major-event-hold", () => ({
  sanitizeSurfDiscoveryForSerializationMajorEventHold: jest.fn(
    async (discovery: unknown) => discovery,
  ),
}));

const mockGetProfileExperienceLevel = jest.fn();
const mockReadProfileSkill = jest.fn();
jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: (...args: unknown[]) =>
    mockGetProfileExperienceLevel(...args),
  readProfileSkill: (...args: unknown[]) => mockReadProfileSkill(...args),
}));

let mockEntitlementResult: { data: unknown; error: { code: string; message: string } | null } = {
  data: null,
  error: null,
};

function mockBeachQuery(
  beach: Record<string, unknown> | null,
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
  query.eq.mockImplementation((column: string, value: unknown) => {
    mockEqCalls.push([column, value]);
    return query;
  });
  query.is.mockReturnValue(query);
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "user_entitlements") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => mockEntitlementResult),
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
    daylightAvailability?: Record<string, unknown>;
  };
};

describe("GET /api/surf/call", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveFeatureAccess.mockImplementation(featureAccessOff);
    mockRateLimitInvocations.length = 0;
    mockEqCalls.length = 0;
    mockRequestUser = mockUser;
    mockInvalidCredentials = false;
    mockGetProfileExperienceLevel.mockResolvedValue("intermediate");
    mockEntitlementResult = { data: null, error: null };
    mockResolveWaterQualityHolds.mockResolvedValue({ state: "resolved", heldBeachIds: [], waterQualityStatusByBeachId: {}, epoch: "empty" });
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

  it.each([
    ["site advisory", "advisory", { source: "county", countyKind: "site", checkedAt: "2026-10-14T20:00:43Z" }],
    ["closure", "closure", { source: "county", countyKind: "site", checkedAt: "2026-10-14T20:00:43Z" }],
    ["owner hold", undefined, { source: "hold" }],
  ])("exposes a held %s independent of the forecast candidate", async (_label, status, evidence) => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    canonicalContext.discovery.recommendations = [];
    canonicalContext.decision.selection = null;
    mockResolveWaterQualityHolds.mockResolvedValueOnce({
      state: "resolved", heldBeachIds: [beachId],
      waterQualityStatusByBeachId: status ? { [beachId]: status } : {},
      waterQualityEvidenceByBeachId: { [beachId]: evidence }, epoch: "held",
    });
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier", lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles", deleted_at: null });
    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    expect(response.status).toBe(200);
    expect((await response.json()).data.waterQuality).toEqual({ status: status ?? "hold", ...evidence });
    expect(mockResolveWaterQualityHolds).toHaveBeenCalledTimes(1);
  });

  it("adds rain timing only to County general hold evidence", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    const rainAdvisory = { startedAt: "2026-10-12T18:00:00Z", lastRainAt: null,
      expiresAt: "2026-10-15T18:00:00Z" };
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier",
      lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles", deleted_at: null });
    mockResolveWaterQualityHolds.mockResolvedValueOnce({ state: "resolved", heldBeachIds: [beachId],
      waterQualityStatusByBeachId: { [beachId]: "advisory" }, epoch: "rain",
      waterQualityEvidenceByBeachId: { [beachId]: { source: "county", countyKind: "general", rainAdvisory } } });
    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    expect((await response.json()).data.waterQuality).toMatchObject({ source: "county", countyKind: "general", rainAdvisory });
  });

  it.each([
    ["gauge rain", { source: "rain", rainAdvisory: { startedAt: "2026-10-22T12:00:00Z",
      lastRainAt: "2026-10-22T11:00:00Z", expiresAt: "2026-10-25T11:00:00Z" } }],
    ["County general rain", { source: "county", countyKind: "general", checkedAt: "2026-10-22T13:00:43Z",
      rainAdvisory: { startedAt: "2026-10-22T12:00:00Z", lastRainAt: null, expiresAt: "2026-10-25T11:00:00Z" } }],
  ])("exposes a %s notice on an unheld beach as an advisory", async (_label, notice) => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier",
      lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles", deleted_at: null });
    mockResolveWaterQualityHolds.mockResolvedValueOnce({ state: "resolved", heldBeachIds: [],
      waterQualityStatusByBeachId: {}, waterQualityNoticeByBeachId: { [beachId]: notice }, epoch: "rain" });
    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    expect((await response.json()).data.waterQuality).toEqual({ status: "advisory", ...notice });
  });

  it("keeps a rain notice when the hold read is unresolved, without claiming a hold", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    const rain = { source: "rain", rainAdvisory: { startedAt: "2026-10-22T12:00:00Z",
      lastRainAt: "2026-10-22T11:00:00Z", expiresAt: "2026-10-25T11:00:00Z" } };
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier",
      lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles", deleted_at: null });
    mockResolveWaterQualityHolds.mockResolvedValueOnce({ state: "unresolved", heldBeachIds: [],
      waterQualityStatusByBeachId: {}, waterQualityNoticeByBeachId: { [beachId]: rain }, epoch: "unknown" });
    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    expect((await response.json()).data.waterQuality).toEqual({ status: "advisory", ...rain });
  });

  it("returns null for an unheld or unresolved beach", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier", lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles", deleted_at: null });
    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    expect((await response.json()).data.waterQuality).toBeNull();
    expect(mockResolveWaterQualityHolds).toHaveBeenCalledTimes(1);
  });

  it("returns the live County closure for an owner-held beach", async () => {
    const beachId = "9e94759c-d531-4e5c-9bc2-d022acea9dcd";
    const checkedAt = "2026-10-15T20:00:00Z";
    canonicalContext.discovery.recommendations = [];
    canonicalContext.decision.selection = null;
    mockResolveWaterQualityHolds.mockResolvedValueOnce({
      state: "resolved", heldBeachIds: [beachId],
      waterQualityStatusByBeachId: { [beachId]: "closure" },
      waterQualityEvidenceByBeachId: { [beachId]: { source: "county", countyKind: "site", checkedAt } },
      epoch: "owner-held-county-closure",
    });
    mockBeachQuery({ id: beachId, name: "Imperial Beach", slug: "imperial-beach", lat: 32.58, lon: -117.13,
      timezone: "America/Los_Angeles", deleted_at: null });

    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));

    expect(response.status).toBe(200);
    expect((await response.json()).data.waterQuality).toEqual({
      status: "closure", source: "county", countyKind: "site", checkedAt,
    });
    expect(mockResolveWaterQualityHolds).toHaveBeenCalledTimes(1);
  });

  it("reads the requested beach when no forecast candidate produced a hold resolution", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    canonicalContext.discovery.recommendations = [];
    canonicalContext.decision.selection = null;
    mockResolveWaterQualityHolds.mockResolvedValueOnce({ state: "resolved", heldBeachIds: [beachId],
      waterQualityStatusByBeachId: { [beachId]: "closure" },
      waterQualityEvidenceByBeachId: { [beachId]: { source: "county", countyKind: "site", checkedAt: "2026-10-14T20:00:43Z" } }, epoch: "held" });
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier", lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles", deleted_at: null });
    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    expect(response.status).toBe(200);
    expect((await response.json()).data.waterQuality).toEqual({ status: "closure", source: "county", countyKind: "site", checkedAt: "2026-10-14T20:00:43Z" });
    expect(mockResolveWaterQualityHolds).toHaveBeenCalledTimes(1);
  });

  it("still names a hold an unresolved read already knows, because the call is no longer withheld", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockResolveWaterQualityHolds.mockResolvedValueOnce({ state: "unresolved", heldBeachIds: [beachId], waterQualityStatusByBeachId: {}, epoch: "unknown" });
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier", lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles", deleted_at: null });
    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    expect((await response.json()).data.waterQuality).toEqual({ status: "hold", source: "hold" });
  });

  it("returns null for an unresolved read that knows no hold", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockResolveWaterQualityHolds.mockResolvedValueOnce({ state: "unresolved", heldBeachIds: [], waterQualityStatusByBeachId: {}, epoch: "unknown" });
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier", lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles", deleted_at: null });
    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    expect((await response.json()).data.waterQuality).toBeNull();
  });

  it("looks up an uppercase beachId in normalized hold evidence", async () => {
    const beachId = "9e94759c-d531-4e5c-9bc2-d022acea9dcd";
    const checkedAt = "2026-10-15T20:00:00Z";
    mockResolveWaterQualityHolds.mockResolvedValueOnce({ state: "resolved", heldBeachIds: [beachId],
      waterQualityStatusByBeachId: { [beachId]: "closure" },
      waterQualityEvidenceByBeachId: { [beachId]: { source: "county", countyKind: "site", checkedAt } }, epoch: "held" });
    mockBeachQuery({ id: beachId, name: "Imperial Beach", slug: "imperial-beach", lat: 32.58, lon: -117.13,
      timezone: "America/Los_Angeles", deleted_at: null });

    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId.toUpperCase()}`));

    expect(response.status).toBe(200);
    expect((await response.json()).data.waterQuality).toEqual({ status: "closure", source: "county", countyKind: "site", checkedAt });
  });

  it("starts the direct hold read before the canonical decision finishes", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    let finishCanonical!: (value: typeof canonicalContext) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const canonical = new Promise<typeof canonicalContext>((resolve) => { finishCanonical = resolve; });
    mockResolveCanonicalSessionDecisionContext.mockImplementationOnce(() => {
      markStarted();
      return canonical;
    });
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier", lat: 32.75, lon: -117.25,
      timezone: "America/Los_Angeles", deleted_at: null });

    const responsePromise = GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    await started;
    const directReadCount = mockResolveWaterQualityHolds.mock.calls.length;
    finishCanonical(canonicalContext);
    const response = await responsePromise;

    expect(directReadCount).toBe(1);
    expect(response.status).toBe(200);
  });

  it("handles a late hold rejection after the canonical decision fails", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    let rejectHold!: (error: Error) => void;
    const hold = new Promise<never>((_resolve, reject) => { rejectHold = reject; });
    const holdError = new Error("late hold failure");
    mockResolveWaterQualityHolds.mockReturnValueOnce(hold);
    mockResolveCanonicalSessionDecisionContext.mockRejectedValueOnce(new Error("canonical failure"));
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier", lat: 32.75, lon: -117.25,
      timezone: "America/Los_Angeles", deleted_at: null });

    try {
      const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
      rejectHold(holdError);
      await hold.catch(() => undefined);
      expect(response.status).toBe(503);
      expect(consoleError).toHaveBeenCalledWith("[surf-call:water-quality-error]", holdError);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps the surf call successful when the hold read throws", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockResolveWaterQualityHolds.mockRejectedValueOnce(new Error("hold read failed"));
    mockBeachQuery({ id: beachId, name: "Ocean Beach Pier", slug: "ocean-beach-pier", lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles", deleted_at: null });
    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    expect(response.status).toBe(200);
    expect((await response.json()).data.waterQuality).toBeNull();
    consoleError.mockRestore();
  });

  it("returns the general surf call to anonymous viewers without entitlements", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockRequestUser = null;
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
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&boardClass=longboard`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.report.skillSource).toBeNull();
    expect(body.data.report.userTier).toBeNull();
    expect(body.data.report.verdict).toMatch(/^(YES|MAYBE|NO)$/);
    expect(body.data.report.whySentence).toEqual(expect.any(String));
    expect(body.data.forecastContext.conditionDrivers).toEqual(expect.any(Object));
    expect(mockGetProfileExperienceLevel).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalledWith("user_entitlements");
    expect(mockResolveCanonicalSessionDecisionContext).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        profileExperience: null,
        discoveryOptions: expect.objectContaining({ isPro: false }),
      }),
    );
    expect(mockRateLimitInvocations).toEqual(["public-default"]);
    expect(mockEqCalls).not.toContainEqual(["user_id", expect.anything()]);
    expect(mockSupabase.from).not.toHaveBeenCalledWith("boards");
    expect(mockSupabase.from).not.toHaveBeenCalledWith("favorite_beaches");
    expect(mockSupabase.from).not.toHaveBeenCalledWith("user_surf_preferences");
  });

  it.each([
    ["ON", featureAccessOn, true],
    ["OFF", featureAccessOff, false],
  ])("founding access %s decides paid discovery for a signed-in free user", async (_name, access, paid) => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockResolveFeatureAccess.mockImplementation(access);
    mockDiscoverSurfSpots.mockResolvedValue({
      recommendations: [],
      includedRecommendations: [],
      recommendationAvailability: { state: "available", holdEpoch: "now-test" },
      searchCriteria: { maxResults: 1 },
      metadata: { outcome: "success", generated_at: new Date().toISOString() },
    });
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
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&includeNow=1`),
    );

    expect(response.status).toBe(200);
    expect(mockResolveFeatureAccess).toHaveBeenCalledWith(mockUser.id, false, { billingIssue: false });
    expect(mockResolveCanonicalSessionDecisionContext).toHaveBeenCalledWith(
      expect.objectContaining({ discoveryOptions: expect.objectContaining({ isPro: paid }) }),
    );
    expect(mockDiscoverSurfSpots).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ discoveryMode: "now", isPro: paid }),
    );
  });

  it("anonymous viewers never get founding access", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockRequestUser = null;
    mockResolveFeatureAccess.mockImplementation(featureAccessOn);
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      timezone: "America/Los_Angeles",
      deleted_at: null,
    });

    await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));

    expect(mockResolveFeatureAccess).toHaveBeenCalledWith(null, false, { billingIssue: false });
    expect(mockResolveCanonicalSessionDecisionContext).toHaveBeenCalledWith(
      expect.objectContaining({ discoveryOptions: expect.objectContaining({ isPro: false }) }),
    );
  });

  it("returns 401 for an invalid bearer token", async () => {
    mockInvalidCredentials = true;

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/surf/call?beachId=11111111-1111-4111-8111-111111111111",
        { headers: { Authorization: "Bearer not-a-real-token" } },
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: "Authentication required",
    });
  });

  it("returns 404 for an unknown beach for authenticated and anonymous viewers", async () => {
    const beachQuery = mockBeachQuery(null);

    for (const user of [mockUser, null]) {
      mockRequestUser = user;
      const response = await GET(
        new NextRequest(
          "http://localhost:3000/api/surf/call?beachId=11111111-1111-4111-8111-111111111111",
        ),
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        success: false,
        error: "Beach not found",
      });
    }

    expect(beachQuery.single).toHaveBeenCalledTimes(2);
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
    expect(mockRateLimitInvocations).toEqual(["surf-call"]);
  });

  describe("rating fields describe one session", () => {
    const beachId = "11111111-1111-4111-8111-111111111111";

    function seedBlownOutMaybe(timezone: string) {
      const rec = canonicalContext.discovery.recommendations[0] as {
        window: Record<string, unknown>;
        forecast: Record<string, unknown>;
      };
      rec.window = { ...rec.window, timezone, waveHeight: "2-3 ft", score: 31 };
      rec.forecast = {
        ...rec.forecast,
        wave_height: "2-3 ft",
        wind_speed: "24",
        wind_direction: "W",
        wind_direction_deg: 270,
      };
      const decision = canonicalContext.decision as Record<string, any>;
      decision.conditionLabel = "FAIR";
      decision.selection = {
        ...decision.selection,
        timezone,
        evidence: { ...decision.selection.evidence, conditionScore: 49 },
      };
      mockBeachQuery({
        id: beachId,
        name: "Ocean Beach Pier",
        slug: "ocean-beach-pier",
        lat: 32.75,
        lon: -117.25,
        timezone,
        wind_offshore_deg: 90,
        deleted_at: null,
      });
    }

    async function getData() {
      const response = await GET(
        new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
      );
      return (await response.json()).data;
    }

    it("explains a wind-blown-out MAYBE with the wind and passes the decision's label through", async () => {
      seedBlownOutMaybe("America/Los_Angeles");
      (canonicalContext.decision as Record<string, any>).conditionLabel = "MEH";
      const data = await getData();

      expect(data.report.verdict).toBe("MAYBE");
      expect(data.report.character.category).toBe("skip");
      expect(data.conditionLabel).toBe("MEH");
      expect(data.sessionDecision.conditionLabel).toBe("MEH");
      expect(data.report.whySentence).not.toMatch(/not favorable/i);
      expect(data.report.whySentence).toMatch(/wind/i);
    });

    it("keeps report.score (decision) and forecastContext.score (window row) as separate fields", async () => {
      seedBlownOutMaybe("America/Los_Angeles");
      const data = await getData();

      expect(data.report.score).toBe(49);
      expect(data.forecastContext.score).toBe(31);
    });

    it("derives the tiers from the decision verdict, with trail times in the beach timezone", async () => {
      seedBlownOutMaybe("America/Los_Angeles");
      const data = await getData();

      expect(data.report.tiers.intermediate.verdict).toBe("MAYBE");
      // Window starts 22:30Z, which is 3:30 PM in Los Angeles.
      expect(data.report.tiers.intermediate.trail).toBe("TRY AT 3:30 PM");
    });

    it("formats the trail in Hawaii time for a Hawaii beach", async () => {
      seedBlownOutMaybe("Pacific/Honolulu");
      const data = await getData();

      expect(data.report.tiers.intermediate.trail).toBe("TRY AT 12:30 PM");
    });

    it("keeps the decision's label when the wind is not blowing the row out", async () => {
      const decision = canonicalContext.decision as Record<string, any>;
      decision.conditionLabel = "FAIR";
      mockBeachQuery({
        id: beachId,
        name: "Ocean Beach Pier",
        slug: "ocean-beach-pier",
        lat: 32.75,
        lon: -117.25,
        timezone: "America/Los_Angeles",
        wind_offshore_deg: 90,
        deleted_at: null,
      });
      const data = await getData();

      expect(data.report.character.category).not.toBe("skip");
      expect(data.conditionLabel).toBe("FAIR");
    });
  });

  it("keeps direct forecast visibility but never promotes a recommendation-ineligible beach", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    (canonicalContext.decision as Record<string, unknown>).conditionLabel = "GOOD";
    mockBeachQuery({
      id: beachId,
      name: "College Cove",
      slug: "college-cove-ca",
      lat: 41.067,
      lon: -124.1517,
      timezone: "America/Los_Angeles",
      recommendation_eligible: false,
      preference_model: {
        eligibility_reason:
          "Promotion disabled because the official access trail is closed for erosion.",
      },
      deleted_at: null,
    });

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.report).toMatchObject({
      verdict: "NO",
      bestWindowStart: null,
      bestWindowEnd: null,
      score: null,
      whySentence:
        "Promotion disabled because the official access trail is closed for erosion.",
      recommendationAvailability: {
        state: "available",
        holdEpoch: `recommendation-ineligible:${beachId}`,
      },
    });
    expect(body.data.report.waveHeight).toBe("2.7 ft");
    expect(body.data.forecastContext).toBeNull();
    expect(body.data.sessionDecision).toMatchObject({
      verdict: "no",
      decisionBasis: "safety_override",
      decisionBasisV2: "safety_override",
      reasonCode: "invalid_candidate",
      selection: null,
    });
    expect(body.data.conditionLabel).toBe("MEH");
    expect(body.data.sessionDecision.conditionLabel).toBe("MEH");
  });

  it("still makes the call with free access when the entitlement read fails twice", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    // The switch is on, so a fallback through founding access would open paid discovery.
    mockResolveFeatureAccess.mockImplementation(featureAccessOn);
    mockDiscoverSurfSpots.mockResolvedValue({
      recommendations: [],
      includedRecommendations: [],
      recommendationAvailability: { state: "available", holdEpoch: "now-test" },
      searchCriteria: { maxResults: 1 },
      metadata: { outcome: "success", generated_at: new Date().toISOString() },
    });
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      timezone: "America/Los_Angeles",
      deleted_at: null,
    });
    mockEntitlementResult = {
      data: null,
      error: { code: "08006", message: "connection failure" },
    };
    const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&includeNow=1`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.report.verdict).toEqual(expect.any(String));
    expect(body.data.planStatus).toBe("unknown");
    expect(mockSupabase.from.mock.calls.filter(([table]: [string]) => table === "user_entitlements")).toHaveLength(2);
    expect(mockResolveFeatureAccess).not.toHaveBeenCalled();
    expect(mockResolveCanonicalSessionDecisionContext).toHaveBeenCalledWith(
      expect.objectContaining({ discoveryOptions: expect.objectContaining({ isPro: false }) }),
    );
    expect(mockDiscoverSurfSpots).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ discoveryMode: "now", isPro: false }),
    );
    consoleWarn.mockRestore();
  });

  it("omits planStatus when the entitlement read succeeds", async () => {
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

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).not.toHaveProperty("planStatus");
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
    const retryAfter = Number(response.headers.get("Retry-After"));
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(3);
    expect(retryAfter).toBeLessThanOrEqual(6);
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
    expect(body.data.forecastContext).toMatchObject({
      selectedRowTime: forecastAt,
      selectedWindowStart: "2026-05-08T22:30:00.000Z",
      selectedWindowEnd: "2026-05-09T01:30:00.000Z",
    });
    expect(body.data.sessionDecision.selection.forecastRef.forecastAt).toBe(forecastAt);
    expect(body.data.report.score).toBe(72);
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
    expect(body.data.forecastContext.selectedRowTime).toBe("2026-05-08T22:00:00.000Z");
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

  describe("with the hourly bridge", () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    // 3-hourly stored rows; 22:00Z is a bridged hour between them.
    const storedRows = [
      { id: "row-21", beach_id: beachId, forecast_at: "2026-05-08T21:00:00.000Z" },
      { id: "row-00", beach_id: beachId, forecast_at: "2026-05-09T00:00:00.000Z" },
    ];
    const forecastAt = "2026-05-08T22:00:00.000Z";
    const beachRow = {
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      timezone: "America/Los_Angeles",
      deleted_at: null,
    };

    afterEach(() => {
      delete process.env.HOURLY_BRIDGE_ENABLED;
    });

    it("reports a bridged scoped hour as an exact match, as discovery scored it", async () => {
      process.env.HOURLY_BRIDGE_ENABLED = "true";
      const recommendation = canonicalContext.discovery.recommendations[0];
      recommendation.recommendationId = `beach:${beachId}:${forecastAt}`;
      recommendation.forecast = { ...(recommendation.forecast as object), id: "row-21:h+1", forecast_at: forecastAt };
      const selection = canonicalContext.decision.selection as Record<string, unknown>;
      selection.candidateId = `beach:${beachId}:${forecastAt}`;
      selection.forecastRef = { forecastId: "row-21:h+1", beachId, forecastAt };
      mockBeachQuery(beachRow, storedRows);

      const response = await GET(
        new NextRequest(
          `http://localhost:3000/api/surf/call?beachId=${beachId}&forecastAt=${encodeURIComponent(forecastAt)}`,
        ),
      );
      const body = await response.json();

      expect(body.data.forecastAlignment).toEqual({
        requestedForecastAt: forecastAt,
        matchedForecastAt: forecastAt,
        matchType: "exact",
        deltaMinutes: 0,
      });
      expect(body.data.forecastContext.selectedRowTime).toBe(forecastAt);
      expect(body.data.sessionDecision.selection.forecastRef.forecastAt).toBe(forecastAt);
      expect(body.data.report.score).toBe(72);
    });

    it("keeps the stored-row alignment with the flag off", async () => {
      mockBeachQuery(beachRow, storedRows);

      const response = await GET(
        new NextRequest(
          `http://localhost:3000/api/surf/call?beachId=${beachId}&forecastAt=${encodeURIComponent(forecastAt)}`,
        ),
      );
      const body = await response.json();

      expect(body.data.forecastAlignment).toEqual({
        requestedForecastAt: forecastAt,
        matchedForecastAt: "2026-05-08T21:00:00.000Z",
        matchType: "nearest",
        deltaMinutes: 60,
      });
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
      "No personalized forecast window was available for Ocean Beach Pier.",
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

  it.each(["2026-05-08T22:00:00.000Z", "2026-05-08T23:00:00.000Z"])(
    "uses only in-window objective measurements from %s", async (sampleTime) => {
    const recommendation = canonicalContext.discovery.recommendations[0];
    recommendation.forecast = { ...(recommendation.forecast as Record<string, unknown>), forecast_at: sampleTime };
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
      selectedRowTime: "2026-05-08T23:00:00.000Z",
      waveHeight: "2.7 ft",
      windSpeed: sampleTime === "2026-05-08T23:00:00.000Z" ? "5 mph" : null,
      windDirection: sampleTime === "2026-05-08T23:00:00.000Z" ? "W" : null,
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
      candidateRejection: { gate: 'water_quality_hold', observed: { status: 'closure' }, allowed: { status: 'open' } },
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
      whySentence: "Water quality is closed at Ocean Beach Pier; an open status is required.",
    });
    expect(body.data.sessionDecision).toMatchObject({
      verdict: "no",
      decisionBasis: "safety_override",
      reasonCode: "water_quality_closure",
      selection: null,
    });
  });

  it('explains candidate loss without presenting the public window as a personal selection', async () => {
    const beachId = '11111111-1111-4111-8111-111111111111';
    canonicalContext.decision = {
      ...canonicalContext.decision,
      verdict: 'no',
      decisionBasis: 'safety_override',
      reasonCode: 'no_candidates',
      candidateRejection: { gate: 'daylight', observed: { count: 2 } },
      selection: null,
    };
    mockBeachQuery({ id: beachId, name: 'Ocean Beach Pier', slug: 'ocean-beach-pier', lat: 32.75, lon: -117.25, timezone: 'America/Los_Angeles', deleted_at: null });

    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.sessionDecision.candidateRejection).toEqual({ gate: 'daylight', observed: { count: 2 } });
    expect(body.data.candidateRejection).toEqual({ gate: 'daylight', observed: { count: 2 } });
    expect(body.data.report).toMatchObject({ verdict: 'NO', bestWindowStart: null, bestWindowEnd: null, score: null });
    expect(body.data.report.whySentence).toContain('No forecast hours for Ocean Beach Pier fall in daylight');
    expect(body.data.report.whySentence).not.toMatch(/unsafe|safe surf window|8:00|8:30/i);
    expect(body.data.objectiveWindow).toEqual({ start: '2026-05-08T22:30:00.000Z', end: '2026-05-09T01:30:00.000Z' });
  });

  it.each(['no_candidates', 'water_quality_closure'])('names an advisory for %s without calling the beach closed', async (reasonCode) => {
    const beachId = '11111111-1111-4111-8111-111111111111';
    canonicalContext.decision = {
      ...canonicalContext.decision,
      verdict: 'no', decisionBasis: 'safety_override', reasonCode,
      candidateRejection: { gate: 'water_quality_hold', observed: { status: 'advisory' }, allowed: { status: 'open' } },
      selection: null,
    };
    mockBeachQuery({ id: beachId, name: 'Ocean Beach Pier', slug: 'ocean-beach-pier', lat: 32.75, lon: -117.25, timezone: 'America/Los_Angeles', deleted_at: null });

    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.report.whySentence).toBe('Water quality is under an advisory at Ocean Beach Pier; an open status is required.');
    expect(body.data.report.whySentence).not.toContain('closed');
    expect(body.data.sessionDecision.reasonCode).toBe(reasonCode);
  });

  it('states the observed wave height and the profile skill range', async () => {
    const beachId = '11111111-1111-4111-8111-111111111111';
    canonicalContext.decision = {
      ...canonicalContext.decision,
      verdict: 'no',
      decisionBasis: 'safety_override',
      reasonCode: 'wave_height_exceeds_skill',
      candidateRejection: { gate: 'skill_gate', observed: { waveHeightFt: 7.2 }, allowed: { skill: 'intermediate', minimumWaveHeightFt: 1, maximumWaveHeightFt: 6 } },
      selection: null,
    };
    mockBeachQuery({ id: beachId, name: 'Ocean Beach Pier', slug: 'ocean-beach-pier', lat: 32.75, lon: -117.25, timezone: 'America/Los_Angeles', deleted_at: null });

    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.report.whySentence).toBe('Forecast 7.2 ft exceeds the intermediate safety range of 1-6 ft.');
    expect(body.data.report.bestWindowStart).toBeNull();
  });

  it('names the beginner safety range applied for unknown skill', async () => {
    const beachId = '11111111-1111-4111-8111-111111111111';
    canonicalContext.decision = {
      ...canonicalContext.decision,
      verdict: 'no', decisionBasis: 'safety_override', reasonCode: 'wave_height_exceeds_skill',
      skillEligibility: { skill: 'unknown', state: 'insufficient_safety_data', reasonCodes: ['unknown_skill'] },
      candidateRejection: { gate: 'skill_gate', observed: { waveHeightFt: 6 }, allowed: { skill: 'beginner', minimumWaveHeightFt: 0.5, maximumWaveHeightFt: 4 } },
      selection: null,
    };
    mockBeachQuery({ id: beachId, name: 'Ocean Beach Pier', slug: 'ocean-beach-pier', lat: 32.75, lon: -117.25, timezone: 'America/Los_Angeles', deleted_at: null });

    const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.report.whySentence).toBe('Forecast 6 ft exceeds the beginner safety range of 0.5-4 ft applied when skill is unknown.');
    expect(body.data.report.whySentence).not.toContain('your beginner');
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
      "Board fit: good longboard size at 2–3 ft.",
    );
    // The note is a whole sentence; the board line keeps one full stop.
    expect(body.data.report.whySentence).not.toContain("ft..");
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

  it("shares hold reads within one request but not across requests", async () => {
    const beachId = "11111111-1111-4111-8111-111111111111";
    mockBeachQuery({
      id: beachId,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      lat: 32.75,
      lon: -117.25,
      deleted_at: null,
    });
    const holdClient = {};
    const load = jest.fn(async () => ({ data: [], error: null }));
    mockResolveWaterQualityHolds.mockImplementation(async () => {
      await memoizedWaterQualityRead(holdClient, "held", load);
      return { state: "resolved", heldBeachIds: [], waterQualityStatusByBeachId: {}, epoch: "empty" };
    });
    mockResolveCanonicalSessionDecisionContext.mockImplementation(async () => {
      // Discovery and the canonical decision each read the hold tables.
      await memoizedWaterQualityRead(holdClient, "held", load);
      await memoizedWaterQualityRead(holdClient, "held", load);
      return canonicalContext;
    });
    const request = () =>
      GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`));

    expect((await request()).status).toBe(200);
    expect(load).toHaveBeenCalledTimes(1);
    expect((await request()).status).toBe(200);
    expect(load).toHaveBeenCalledTimes(2);
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

    it("preserves after-dark guidance on an empty scoped surf call", async () => {
      canonicalContext.discovery = {
        recommendations: [],
        includedRecommendations: [],
        recommendationAvailability: {
          state: "available",
          holdEpoch: "no-candidates",
        },
        daylightAvailability: {
          reasonCode: "after_dark",
          nextWindowStart: "2026-09-23T13:07:00.000Z",
          timezone: "America/Los_Angeles",
          beachId,
        },
      };
      mockScopedBeach();

      const response = await GET(
        new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.daylightAvailability).toEqual({
        reasonCode: "after_dark",
        nextWindowStart: "2026-09-23T13:07:00.000Z",
        timezone: "America/Los_Angeles",
        beachId,
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

  describe("skill default (flag on)", () => {
    const savedEnabled = process.env.SKILL_AWARE_GO_CHECKS_ENABLED;
    const savedAllowlist = process.env.SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST;
    type FlagEnv = { enabled?: string; allow?: string };
    type SkillRead = { ok: true; level: string | null; blank: boolean } | { ok: false };
    const BEACH_ID = "11111111-1111-4111-8111-111111111111";
    const ON: FlagEnv = { enabled: "true", allow: "native-user-123" };
    const UNSET: SkillRead = { ok: true, level: null, blank: true };

    afterEach(() => {
      // The includeNow block below has no beforeEach and reads this mock as left here.
      mockResolveCanonicalSessionDecisionContext.mockResolvedValue(canonicalContext);
      if (savedEnabled === undefined) delete process.env.SKILL_AWARE_GO_CHECKS_ENABLED;
      else process.env.SKILL_AWARE_GO_CHECKS_ENABLED = savedEnabled;
      if (savedAllowlist === undefined) delete process.env.SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST;
      else process.env.SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST = savedAllowlist;
    });

    function setFlag(env: FlagEnv) {
      if (env.enabled === undefined) delete process.env.SKILL_AWARE_GO_CHECKS_ENABLED;
      else process.env.SKILL_AWARE_GO_CHECKS_ENABLED = env.enabled;
      if (env.allow === undefined) delete process.env.SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST;
      else process.env.SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST = env.allow;
    }

    function setRead(read: SkillRead) {
      mockReadProfileSkill.mockResolvedValue(read);
    }

    // Each helper gives the mock a fresh decision, so the shared canned context stays as beforeEach built it.
    function withDecision(changes: Record<string, unknown>) {
      mockResolveCanonicalSessionDecisionContext.mockResolvedValue({
        ...canonicalContext,
        decision: { ...canonicalContext.decision, ...changes },
      });
    }

    function decisionSkill(skill: string) {
      withDecision({ skillEligibility: { skill, state: "eligible", reasonCodes: [] } });
    }

    function vetoDecision(reasonCode: string, candidateRejection: Record<string, unknown>) {
      withDecision({
        verdict: "no",
        decisionBasis: "safety_override",
        reasonCode,
        candidateRejection,
        selection: null,
        skillEligibility: { skill: "beginner", state: "eligible", reasonCodes: [] },
      });
    }

    async function callRoute() {
      mockBeachQuery({ id: BEACH_ID, name: "Ocean Beach Pier", slug: "ocean-beach-pier", lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles", deleted_at: null });
      const response = await GET(new NextRequest(`http://localhost:3000/api/surf/call?beachId=${BEACH_ID}`));
      return response.json();
    }

    it("sets skillDefaultApplied for an allowlisted user with no skill and keeps the audience fields null", async () => {
      setFlag(ON);
      setRead(UNSET);
      withDecision({ skillEligibility: fixture.skillEligibility });

      const body = await callRoute();

      expect(body.data.report).toMatchObject(fixture.report);
      expect(body.data.sessionDecision.skillEligibility).toEqual(fixture.skillEligibility);
      expect(mockResolveCanonicalSessionDecisionContext).toHaveBeenCalledWith(
        expect.objectContaining({ profileExperience: "beginner" }),
      );
    });

    it("does not read the skill twice with the flag off", async () => {
      setFlag({});

      await callRoute();

      expect(mockReadProfileSkill).not.toHaveBeenCalled();
      expect(mockGetProfileExperienceLevel).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["flag off", {}, UNSET],
      ["not allowlisted", { enabled: "true", allow: "someone-else" }, UNSET],
      ["known skill", ON, { ok: true, level: "intermediate", blank: false }],
      ["garbage skill", ON, { ok: true, level: null, blank: false }],
      ["failed read", ON, { ok: false }],
    ] as const)("omits skillDefaultApplied when %s", async (_label, env: FlagEnv, read: SkillRead) => {
      setFlag(env);
      setRead(read);
      mockGetProfileExperienceLevel.mockResolvedValue(read.ok ? read.level : null);
      decisionSkill(read.ok && read.level ? read.level : "beginner");

      const body = await callRoute();

      expect(body.data.report).not.toHaveProperty("skillDefaultApplied");
    });

    it("omits skillDefaultApplied for an anonymous viewer", async () => {
      setFlag({ enabled: "true", allow: "" });
      mockRequestUser = null;

      const body = await callRoute();

      expect(body.data.report).not.toHaveProperty("skillDefaultApplied");
      expect(mockReadProfileSkill).not.toHaveBeenCalled();
    });

    it("never says 'your profile is beginner' for an allowlisted user with no skill", async () => {
      setFlag(ON);
      setRead(UNSET);
      vetoDecision("beach_skill_exceeds_user", { observed: { skill: "intermediate" }, allowed: { skill: "beginner" } });

      const body = await callRoute();

      expect(body.data.report.whySentence).not.toMatch(/your profile is/i);
      expect(body.data.report.whySentence).toContain("You haven't set a level");
    });

    it("keeps 'your profile is beginner' for a user who set beginner (control)", async () => {
      setFlag(ON);
      setRead({ ok: true, level: "beginner", blank: false });
      vetoDecision("beach_skill_exceeds_user", { observed: { skill: "intermediate" }, allowed: { skill: "beginner" } });

      const body = await callRoute();

      expect(body.data.report.whySentence).toMatch(/your profile is beginner/);
    });

    it("keeps the 'applied when skill is unknown' wave text for a defaulted skill", async () => {
      setFlag(ON);
      setRead(UNSET);
      vetoDecision("wave_height_exceeds_skill", { observed: { waveHeightFt: 5 }, allowed: { skill: "beginner", minimumWaveHeightFt: 1, maximumWaveHeightFt: 4 } });

      const body = await callRoute();

      expect(body.data.report.whySentence).toMatch(/applied when skill is unknown/);
    });
  });
});

describe("GET /api/surf/call includeNow", () => {
  const beachId = "11111111-1111-4111-8111-111111111111";

  function nowDiscovery(overrides: {
    start?: Date;
    end?: Date;
    availabilityState?: "available" | "none";
    daylightAvailability?: Record<string, unknown>;
    empty?: boolean;
  } = {}) {
    const now = Date.now();
    const start = overrides.start ?? new Date(now - 30 * 60 * 1000);
    const end = overrides.end ?? new Date(now + 2 * 60 * 60 * 1000);
    return {
      recommendations: overrides.empty ? [] : [
        {
          recommendationId: `beach:${beachId}:now`,
          beach: { id: beachId, name: "Ocean Beach Pier", lat: 32.75, lon: -117.25 },
          window: {
            start,
            end,
            peakTime: start,
            timezone: "America/Los_Angeles",
            tide: "rising",
            wind: "5 mph N",
            waveHeight: "5-6 ft",
            wavePeriod: "12s",
            confidence: 80,
            score: 62,
          },
          forecast: { wave_height: "5-6 ft", wind_speed: "5 mph" },
          score: 62,
          recommendationLabel: "Maybe",
          reasons: [],
        },
      ],
      includedRecommendations: [],
      recommendationAvailability: {
        state: overrides.availabilityState ?? "available",
        holdEpoch: "now-test",
        ...(overrides.availabilityState === "none"
          ? { reasonCode: "major_event_hold" }
          : {}),
      },
      searchCriteria: { maxResults: 1 },
      metadata: { outcome: "success", generated_at: new Date().toISOString() },
      ...(overrides.daylightAvailability
        ? { daylightAvailability: overrides.daylightAvailability }
        : {}),
    };
  }

  function mockEligibleBeach() {
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

  it("does not run now-mode discovery unless asked", async () => {
    mockEligibleBeach();

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}`),
    );
    const body = await response.json();

    expect(mockDiscoverSurfSpots).not.toHaveBeenCalled();
    expect(body.data).not.toHaveProperty("nowRecommendation");
  });

  it("returns the beach's now-mode recommendation from the same discovery Home runs", async () => {
    mockEligibleBeach();
    mockDiscoverSurfSpots.mockResolvedValue(nowDiscovery());

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&includeNow=1`),
    );
    const body = await response.json();

    expect(mockDiscoverSurfSpots).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({
        discoveryMode: "now",
        includeBeachIds: [beachId],
        candidatePoolLimit: 1,
        userLocation: { lat: 32.75, lon: -117.25 },
      }),
    );
    expect(body.data.nowRecommendation).toMatchObject({
      beach: { id: beachId },
      score: 62,
      recommendationLabel: "Maybe",
    });
    // The surf call itself is untouched.
    expect(body.data.report.verdict).toBe("MAYBE");
  });

  it("returns null when the now window has closed or the discovery is held", async () => {
    mockEligibleBeach();
    mockDiscoverSurfSpots.mockResolvedValueOnce(
      nowDiscovery({
        start: new Date(Date.now() - 4 * 60 * 60 * 1000),
        end: new Date(Date.now() - 60 * 60 * 1000),
      }),
    );
    let response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&includeNow=1`),
    );
    expect((await response.json()).data.nowRecommendation).toBeNull();

    mockDiscoverSurfSpots.mockResolvedValueOnce(nowDiscovery({ availabilityState: "none" }));
    response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&includeNow=1`),
    );
    expect((await response.json()).data.nowRecommendation).toBeNull();
  });

  it("returns after-dark guidance with an empty now recommendation", async () => {
    mockEligibleBeach();
    mockDiscoverSurfSpots.mockResolvedValueOnce(
      nowDiscovery({
        empty: true,
        daylightAvailability: {
          reasonCode: "after_dark",
          nextWindowStart: "2026-09-23T13:07:00.000Z",
          timezone: "America/Los_Angeles",
          beachId,
        },
      }),
    );

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&includeNow=1`),
    );
    const body = await response.json();

    expect(body.data.nowRecommendation).toBeNull();
    expect(body.data.daylightAvailability).toMatchObject({
      reasonCode: "after_dark",
      nextWindowStart: "2026-09-23T13:07:00.000Z",
      beachId,
    });
  });

  it("keeps a scoped call's availability on its own hour, not now-mode's after dark", async () => {
    mockEligibleBeach();
    mockDiscoverSurfSpots.mockResolvedValueOnce(
      nowDiscovery({
        empty: true,
        daylightAvailability: {
          reasonCode: "after_dark",
          nextWindowStart: "2026-09-24T13:10:00.000Z",
          timezone: "America/Los_Angeles",
          beachId,
        },
      }),
    );

    const response = await GET(
      new NextRequest(
        `http://localhost:3000/api/surf/call?beachId=${beachId}&forecastAt=2026-09-24T19:00:00.000Z&includeNow=1`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.nowRecommendation).toBeNull();
    expect(body.data).not.toHaveProperty("daylightAvailability");
  });

  it("never fails the surf call because the now-mode discovery failed", async () => {
    mockEligibleBeach();
    mockDiscoverSurfSpots.mockRejectedValue(
      Object.assign(new Error("Forecast service unavailable"), { code: "forecast_unavailable" }),
    );

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&includeNow=1`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.nowRecommendation).toBeNull();
    expect(body.data.report.verdict).toBe("MAYBE");
  });

  it("withholds the now recommendation for a recommendation-ineligible beach", async () => {
    mockBeachQuery({
      id: beachId,
      name: "College Cove",
      slug: "college-cove-ca",
      lat: 41.067,
      lon: -124.1517,
      timezone: "America/Los_Angeles",
      recommendation_eligible: false,
      preference_model: { eligibility_reason: "Trail closed." },
      deleted_at: null,
    });
    mockDiscoverSurfSpots.mockResolvedValue(nowDiscovery());

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/call?beachId=${beachId}&includeNow=1`),
    );
    const body = await response.json();

    expect(body.data.nowRecommendation).toBeNull();
    expect(body.data.report.verdict).toBe("NO");
  });
});
