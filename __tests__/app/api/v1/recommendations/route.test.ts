/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
const mockServiceFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { GET } from "@/app/api/v1/recommendations/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  createMockRequest,
  createMockSupabaseClient,
  expectErrorResponse,
  expectSuccessResponse,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

const mockSupabaseClient = createMockSupabaseClient();
const mockEvaluateMajorEventHoldCandidates = jest.fn();
const mockGetProfileExperienceLevel = jest.fn();
const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const BEACH_IDS = [
  BEACH_ID,
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
] as const;
const QUERY_TIME = "2026-07-19T18:00:00.000Z";
const NO_STORE = "private, no-store, no-cache, must-revalidate";

function normalizeSelect(select: string): string {
  return select
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/api-utils"),
  withRateLimit: (handler: any) => handler,
  withNoStore: jest.requireActual("@/lib/middleware/api-wrappers/cache-wrappers")
    .withNoStore,
}));

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: (...args: unknown[]) =>
    mockGetProfileExperienceLevel(...args),
  getVerifiedProfileExperience: async (supabase: any) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) return { userId: null, profileExperience: null };
      return {
        userId: user.id,
        profileExperience: await mockGetProfileExperienceLevel(supabase, user.id),
      };
    } catch {
      return { userId: null, profileExperience: null };
    }
  },
}));

jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (input: unknown) =>
    mockEvaluateMajorEventHoldCandidates(input),
}));

function allowDecision(candidateId: string) {
  return {
    candidateId,
    evaluation: {
      outcome: "allow",
      holdIds: [],
      holdEpoch: "ordinary-epoch",
    },
    recommendationAvailability: {
      state: "available",
      holdEpoch: "ordinary-epoch",
    },
  };
}

function blockedDecision(candidateId: string) {
  return {
    candidateId,
    evaluation: {
      outcome: "explicit_none",
      reasonCode: "major_event_hold",
      holdIds: ["internal-hold-id"],
      expiresAt: "2026-07-20T00:00:00.000Z",
      holdEpoch: "ordinary-epoch",
    },
    recommendationAvailability: {
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: "2026-07-20T00:00:00.000Z",
      holdEpoch: "ordinary-epoch",
    },
  };
}

function setupCompleteRecommendationQuery(
  beachIds: readonly string[] = [BEACH_ID],
): void {
  mockSupabaseClient.rpc.mockResolvedValueOnce({
    data: beachIds.map((id, index) => ({
      id,
      name: index === 0 ? "Bound Beach" : `Bound Beach ${index + 1}`,
      distance_meters: 1200,
      is_private: false,
    })),
    error: null,
  });

  const beachChain = mockSupabaseClient.from();
  beachChain.limit.mockResolvedValueOnce({
    data: beachIds.map((id, index) => ({
      id,
      name: index === 0 ? "Bound Beach" : `Bound Beach ${index + 1}`,
      is_private: false,
      skill_level: "intermediate",
      preferred_tide_ft_min: null,
      preferred_tide_ft_max: null,
      swell_window_min_deg: null,
      swell_window_max_deg: null,
      wind_offshore_deg: null,
      wind_offshore_tol_deg: null,
      wind_cross_shore_ok_kt: null,
      wind_onshore_bad_kt: null,
    })),
    error: null,
  });

  const marineChain: any = {};
  marineChain.select = jest.fn(() => marineChain);
  marineChain.in = jest.fn(() => marineChain);
  marineChain.gte = jest.fn(() => marineChain);
  marineChain.lte = jest.fn(() => marineChain);
  marineChain.order = jest
    .fn()
    .mockReturnValueOnce(marineChain)
    .mockResolvedValueOnce({
      data: beachIds.map((beachId) => ({
        beach_id: beachId,
        ts: QUERY_TIME,
        created_at: QUERY_TIME,
        source: "test",
        wave_height_m: 1,
        wave_period_s: 12,
        wave_direction_deg: 270,
        wind_speed_ms: 2,
        wind_direction_deg: 90,
      })),
      error: null,
    });

  const tideChain: any = {};
  tideChain.select = jest.fn(() => tideChain);
  tideChain.in = jest.fn(() => tideChain);
  tideChain.gte = jest.fn(() => tideChain);
  tideChain.lte = jest.fn(() => tideChain);
  tideChain.order = jest
    .fn()
    .mockReturnValueOnce(tideChain)
    .mockResolvedValueOnce({
      data: beachIds.map((beachId) => ({
        beach_id: beachId,
        ts: QUERY_TIME,
        created_at: QUERY_TIME,
        source: "test",
        tide_height_m: 0.5,
        tide_phase: "rising",
      })),
      error: null,
    });

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === "beaches") return beachChain as any;
    if (table === "marine_forecasts") return marineChain;
    if (table === "tide_forecasts") return tideChain;
    return beachChain as any;
  });
}

async function configureHoldStore(heldRows: unknown[]): Promise<void> {
  (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue({
    from: mockServiceFrom,
  });
  mockServiceFrom.mockImplementation((table: string) => {
    const chain: Record<string, jest.Mock> = {
      select: jest.fn(),
      in: jest.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.in.mockResolvedValue(
      table === "water_quality_held_beaches"
        ? { data: heldRows, error: null }
        : { data: [], error: null },
    );
    return chain;
  });
}

async function seedHeldBeach(beachId: string): Promise<void> {
  await configureHoldStore([{ beach_id: beachId }]);
}

describe("GET /api/v1/recommendations", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const env = setupApiTestEnvironment();
    cleanup = env.cleanup;
    jest.clearAllMocks();
    mockGetProfileExperienceLevel.mockResolvedValue("advanced");
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
        Promise.resolve(
          candidates.map(({ candidateId }) => allowDecision(candidateId)),
        ),
    );
    void configureHoldStore([]);
  });

  afterEach(() => {
    cleanup?.();
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/v1/recommendations/route.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
  });

  describe("input validation", () => {
    it("returns 400 for missing coordinates", async () => {
      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations",
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      expect(res.headers.get("Cache-Control")).toBe(NO_STORE);
      await expectErrorResponse(res, 400, "Missing required parameters");
    });

    it("returns 400 for non-numeric coordinates", async () => {
      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations",
        { searchParams: { lat: "nope", lon: "also-nope" } },
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Invalid coordinate format");
    });

    it("returns 400 for out-of-range coordinates", async () => {
      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations",
        { searchParams: { lat: "100", lon: "-200" } },
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Coordinates out of valid range");
    });

    it("returns 400 for invalid time", async () => {
      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations",
        { searchParams: { lat: "32.79", lon: "-117.23", time: "not-a-date" } },
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Invalid time format");
    });
  });

  describe("major-event hold boundary", () => {
    it("canonicalizes a parseable date before binding hold candidates", async () => {
      setupCompleteRecommendationQuery();
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: "verified-user" } },
        error: null,
      });

      const response = await GET(
        createMockRequest(
          "GET",
          "http://localhost:3000/api/v1/recommendations",
          {
            searchParams: {
              lat: "32.79",
              lon: "-117.23",
              time: "2026-07-19",
            },
          },
        ),
      );
      const body = await expectSuccessResponse<any>(response, 200);

      expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
        candidates: [
          {
            candidateId: `legacy-v1:${BEACH_ID}:2026-07-19T00:00:00.000Z`,
            beachId: BEACH_ID,
            startsAt: "2026-07-19T00:00:00.000Z",
            endsAt: "2026-07-19T00:00:00.001Z",
          },
        ],
        profileExperience: "advanced",
        applyWaterQualityHolds: true,
      });
      expect(body.data.recommendations).toHaveLength(1);
      expect(body.data.recommendationAvailability.state).toBe("available");
    });

    it("uses verified profile experience while preserving query skill for legacy scoring", async () => {
      setupCompleteRecommendationQuery();
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: "verified-user" } },
        error: null,
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations",
        {
          searchParams: {
            lat: "32.79",
            lon: "-117.23",
            time: QUERY_TIME,
            skill: "beginner",
          },
        },
      );
      const res = await GET(req);
      const body = await expectSuccessResponse<any>(res, 200);

      expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
        candidates: [
          {
            candidateId: `legacy-v1:${BEACH_ID}:${QUERY_TIME}`,
            beachId: BEACH_ID,
            startsAt: QUERY_TIME,
            endsAt: "2026-07-19T18:00:00.001Z",
          },
        ],
        profileExperience: "advanced",
        applyWaterQualityHolds: true,
      });
      expect(body.data.metadata.user_skill).toBe("beginner");
      expect(body.data.recommendationAvailability).toEqual({
        state: "available",
        holdEpoch: "ordinary-epoch",
      });
      expect(res.headers.get("Cache-Control")).toBe(NO_STORE);
    });

    it("filters the complete ranked pool before selecting and reranking three top picks", async () => {
      setupCompleteRecommendationQuery(BEACH_IDS);
      mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
        ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
          Promise.resolve(
            candidates.map(({ candidateId }, index) =>
              index === 0
                ? blockedDecision(candidateId)
                : allowDecision(candidateId),
            ),
          ),
      );

      const response = await GET(
        createMockRequest(
          "GET",
          "http://localhost:3000/api/v1/recommendations",
          { searchParams: { lat: "32.79", lon: "-117.23", time: QUERY_TIME } },
        ),
      );
      const body = await expectSuccessResponse<any>(response, 200);

      expect(
        body.data.recommendations.map(
          ({ spotId }: { spotId: string }) => spotId,
        ),
      ).toEqual(BEACH_IDS.slice(1));
      expect(
        body.data.top_picks.map(
          ({ spotId, rank }: { spotId: string; rank: number }) => ({
            spotId,
            rank,
          }),
        ),
      ).toEqual([
        { spotId: BEACH_IDS[1], rank: 1 },
        { spotId: BEACH_IDS[2], rank: 2 },
        { spotId: BEACH_IDS[3], rank: 3 },
      ]);
      expect(JSON.stringify(body)).not.toMatch(
        /internal-hold-id|holdIds|evaluation/,
      );
    });

    it("does not return a water-quality-held beach from the ranked pool", async () => {
      setupCompleteRecommendationQuery([BEACH_ID, BEACH_IDS[1]]);
      await seedHeldBeach(BEACH_ID);

      const response = await GET(
        createMockRequest(
          "GET",
          "http://localhost:3000/api/v1/recommendations",
          { searchParams: { lat: "32.79", lon: "-117.23", time: QUERY_TIME } },
        ),
      );
      const body = await expectSuccessResponse<any>(response, 200);

      expect(body.data.recommendations.map(({ spotId }: { spotId: string }) => spotId))
        .toEqual([BEACH_IDS[1]]);
      expect(body.data.top_picks.map(({ spotId }: { spotId: string }) => spotId))
        .toEqual([BEACH_IDS[1]]);
    });

    it("keeps positives in shadow mode without exposing would-block evidence", async () => {
      setupCompleteRecommendationQuery();
      mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
        ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
          Promise.resolve(
            candidates.map(({ candidateId }) => ({
              candidateId,
              evaluation: {
                outcome: "allow",
                holdIds: ["shadow-hold-id"],
                expiresAt: "2026-07-20T00:00:00.000Z",
                holdEpoch: "shadow-epoch",
              },
              recommendationAvailability: {
                state: "available",
                holdEpoch: "shadow-epoch",
              },
            })),
          ),
      );

      const res = await GET(
        createMockRequest(
          "GET",
          "http://localhost:3000/api/v1/recommendations",
          { searchParams: { lat: "32.79", lon: "-117.23", time: QUERY_TIME } },
        ),
      );
      const body = await expectSuccessResponse<any>(res, 200);

      expect(body.data.recommendations).toHaveLength(1);
      expect(body.data.top_picks).toHaveLength(1);
      expect(body.data.recommendationAvailability).toEqual({
        state: "available",
        holdEpoch: "shadow-epoch",
      });
      expect(JSON.stringify(body)).not.toMatch(
        /shadow-hold-id|holdIds|evaluation/,
      );
    });

    it("fails a decision binding mismatch closed without exposing hold evidence", async () => {
      setupCompleteRecommendationQuery();
      mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([
        allowDecision("legacy-v1:wrong-candidate:2026-07-19T18:00:00.000Z"),
      ]);

      const res = await GET(
        createMockRequest(
          "GET",
          "http://localhost:3000/api/v1/recommendations",
          { searchParams: { lat: "32.79", lon: "-117.23", time: QUERY_TIME } },
        ),
      );
      const body = await expectSuccessResponse<any>(res, 200);

      expect(body.data.recommendations).toEqual([]);
      expect(body.data.top_picks).toEqual([]);
      expect(body.data.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(JSON.stringify(body)).not.toMatch(
        /holdIds|evaluation|wrong-candidate/,
      );
    });

    it("sanitizes the complete early-empty response", async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: [], error: null });

      const res = await GET(
        createMockRequest(
          "GET",
          "http://localhost:3000/api/v1/recommendations",
          { searchParams: { lat: "32.79", lon: "-117.23", time: QUERY_TIME } },
        ),
      );
      const body = await expectSuccessResponse<any>(res, 200);

      expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
        candidates: [],
        profileExperience: null,
        applyWaterQualityHolds: true,
      });
      expect(body.data).toMatchObject({
        recommendations: [],
        top_picks: [],
        recommendationAvailability: {
          state: "none",
          reasonCode: "hold_state_unavailable",
        },
      });
    });
  });

  describe("degraded service", () => {
    it("includes degradation metadata when PostGIS RPC fails", async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "RPC not found" },
      });

      const beachesChain = mockSupabaseClient.from();
      // terminal await is on limit()
      beachesChain.limit.mockResolvedValueOnce({
        data: [
          {
            id: "beach-1",
            name: "Test Beach",
            is_private: false,
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      // For forecast queries, return empty results quickly
      const marineChain: any = {};
      marineChain.select = jest.fn(() => marineChain);
      marineChain.in = jest.fn(() => marineChain);
      marineChain.gte = jest.fn(() => marineChain);
      marineChain.lte = jest.fn(() => marineChain);
      marineChain.order = jest
        .fn()
        .mockReturnValueOnce(marineChain)
        .mockResolvedValueOnce({ data: [], error: null });

      const tideChain: any = {};
      tideChain.select = jest.fn(() => tideChain);
      tideChain.in = jest.fn(() => tideChain);
      tideChain.gte = jest.fn(() => tideChain);
      tideChain.lte = jest.fn(() => tideChain);
      tideChain.order = jest
        .fn()
        .mockReturnValueOnce(tideChain)
        .mockResolvedValueOnce({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "beaches") return beachesChain as any;
        if (table === "marine_forecasts") return marineChain;
        if (table === "tide_forecasts") return tideChain;
        return beachesChain as any;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations",
        { searchParams: { lat: "32.79", lon: "-117.23" } },
      );

      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      try {
        const res = await GET(req);
        const body = await expectSuccessResponse<any>(res, 200);

        expect(body.data).toHaveProperty("metadata");
        expect(body.data.metadata).toHaveProperty("degradation");
        expect(body.data.metadata.degradation).toMatchObject({
          postgis_unavailable: true,
          fallback_to_simple_query: true,
        });
        expect(normalizeSelect(beachesChain.select.mock.calls[0][0])).toBe(
          "id, name, is_private, skill_level, preferred_tide_ft_min, preferred_tide_ft_max, swell_window_min_deg, swell_window_max_deg, wind_offshore_deg, wind_offshore_tol_deg, wind_cross_shore_ok_kt, wind_onshore_bad_kt",
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "[DEGRADED] PostGIS RPC unavailable, using fallback query:",
          { message: "RPC not found" },
        );
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });
  });
});
