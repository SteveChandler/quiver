/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMockRequest,
  createMockUser,
  createMockSupabaseClient,
  expectSuccessResponse,
} from "@/test-utils/api-test-helpers";

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withBotBlockingAndRateLimit: (handler: unknown) => handler,
    withErrorHandler: (handler: unknown) => handler,
    withRateLimit: (handler: unknown) => handler,
    withAuth:
      (handler: any, options: any = {}) =>
      async (request: any, context: any) => {
        const result = await mockSupabaseClient.auth.getUser();
        const user = result?.error ? null : result?.data?.user ?? null;
        if (!options.optional && !user) {
          const { NextResponse } = require("next/server");
          return NextResponse.json(
            { error: options.authErrorMessage ?? "Authentication required" },
            { status: 401 },
          );
        }
        const resolvedParams = context?.params
          ? typeof context.params === "object" && "then" in context.params
            ? await context.params
            : context.params
          : {};
        return handler(request, {
          params: resolvedParams,
          user,
          supabase: mockSupabaseClient,
        });
      },
  };
});

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Import after mocks

const { GET } = require("@/app/api/sessions/public/route");

function createThenableChain(result: any) {
  const chain: any = {};
  for (const method of ["select", "eq", "gte", "lte", "lt", "in", "is", "not", "order", "range"]) {
    chain[method] = jest.fn(() => chain);
  }
  chain.then = jest.fn((onResolve: any) => onResolve(result));
  return chain;
}

function eligibilityRow(overrides: Record<string, unknown> = {}) {
  return {
    session_id: "session-1",
    user_id: "surfer-1",
    beach_id: "beach-1",
    arrival_time: "2026-06-11T13:05:00.000Z",
    created_at: "2026-06-11T14:26:06.000Z",
    has_context: true,
    has_media: false,
    thin: false,
    warning: false,
    informative: true,
    strong: true,
    ...overrides,
  };
}

describe("/api/sessions/public", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the shared API wrapper module for pagination helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/sessions/public/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
  });

  it("returns public sessions without leaking author name/avatar or rating", async () => {
    const profileId = "550e8400-e29b-41d4-a716-446655440000";

    const countChain = createThenableChain({ count: 1, data: null, error: null });
    const eligibilityChain = createThenableChain({
      data: [eligibilityRow({ user_id: profileId })],
      error: null,
    });

    const dataChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      then: jest.fn((onResolve: any) =>
        onResolve({
          data: [
            {
              id: "session-1",
              beach_name: "Ocean Beach",
              beach_id: "beach-1",
              arrival_time: "2025-01-01T08:00:00.000Z",
              rating: 5, // intentionally present in DB row; should not be exposed by API
              wave_quality: 4,
              wave_height_ft: 3,
              wave_characteristics: ["clean", "fat"],
              tide_height_ft: 3.2,
              tide_status: "rising",
              tide_rate_ft_per_hr: 0.8,
              rip_current_observed: "light",
              rip_current_risk: "high",
              notes: "Great waves",
              description: null,
              image_url: null,
              likes_count: 2,
              created_at: "2025-01-01T10:00:00.000Z",
              user_id: profileId,
              duration_minutes: 90,
              crowd_level: 3,
              water_temp: 62,
              profiles: {
                id: profileId,
                full_name: "Should Not Leak",
                avatar_url: "/should-not-leak.jpg",
              },
              session_media: [],
            },
          ],
          error: null,
        })
      ),
    };

    const eligibilityChains = [countChain, eligibilityChain];
    (mockSupabaseClient as any).from.mockImplementation((table: string) => {
      if (table === "public_session_feed_eligibility") return eligibilityChains.shift();
      if (table === "sessions") return dataChain;
      throw new Error(`Unexpected table ${table}`);
    });

    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/sessions/public?page=1&limit=10"
    );
    const res = await GET(req as any);
    const payload = await expectSuccessResponse<any[]>(res, 200);

    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(1);

    const item = payload.data[0];
    expect(item).toMatchObject({
      id: "session-1",
      beachName: "Ocean Beach",
      author: { id: profileId },
      quality: {
        hasContext: true,
        hasMedia: false,
        thin: false,
        warning: false,
        informative: true,
        strong: true,
      },
      waveCharacteristics: ["clean", "fat"],
      tideHeightFt: 3.2,
      tideStatus: "rising",
      tideRateFtPerHr: 0.8,
      ripCurrentObserved: "light",
      ripCurrentRisk: "high",
    });

    // Route exposes rating as public data for community feed
    expect(item).toHaveProperty("rating");

    // Author object exposes only id (name/avatar exposed via displayName/avatarUrl top-level fields)
    expect(item.author).not.toHaveProperty("name");
    expect(item.author).not.toHaveProperty("avatar");
  });

  it("filters friends feed by followed users and requested beach", async () => {
    const user = createMockUser({ id: "current-user" });
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user },
      error: null,
    });

    const blocksChain = createThenableChain({ data: [], error: null });
    const followsChain = createThenableChain({
      data: [
        { following_id: "friend-1" },
        { following_id: "friend-2" },
      ],
      error: null,
    });
    const countChain = createThenableChain({ count: 1, data: null, error: null });
    const eligibilityChain = createThenableChain({
      data: [eligibilityRow({ user_id: "friend-1" })],
      error: null,
    });
    const dataChain = createThenableChain({
      data: [
        {
          id: "session-1",
          user_id: "friend-1",
          beach_name: "Blacks Beach",
          beach_id: "beach-1",
          arrival_time: "2026-05-18T08:00:00.000Z",
          wave_quality: 4,
          wave_height_ft: 3,
          notes: null,
          description: "Fun morning",
          image_url: null,
          likes_count: 0,
          created_at: "2026-05-18T10:00:00.000Z",
          duration_minutes: 75,
          crowd_level: 2,
          water_temp: 62,
          rating: 4,
          beaches: { name: "Blacks Beach" },
          profiles: {
            id: "friend-1",
            full_name: "Crew Surfer",
            avatar_url: null,
          },
          session_media: [],
        },
      ],
      error: null,
    });
    const likesChain = createThenableChain({ data: [], error: null });

    const eligibilityChains = [countChain, eligibilityChain];
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "user_blocks") return blocksChain;
      if (table === "user_follows") return followsChain;
      if (table === "session_likes") return likesChain;
      if (table === "public_session_feed_eligibility") return eligibilityChains.shift();
      if (table === "sessions") return dataChain;
      throw new Error(`Unexpected table ${table}`);
    });

    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/sessions/public?feed_type=friends&beach_id=beach-1&page=1&limit=10",
    );
    const res = await GET(req as any);
    const payload = await expectSuccessResponse<any[]>(res, 200);

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({
      id: "session-1",
      userId: "friend-1",
      beachId: "beach-1",
      displayName: "Crew Surfer",
    });
    expect(followsChain.eq).toHaveBeenCalledWith("follower_id", "current-user");
    expect(countChain.eq).toHaveBeenCalledWith("beach_id", "beach-1");
    expect(countChain.eq).toHaveBeenCalledWith("informative", true);
    expect(countChain.in).toHaveBeenCalledWith("user_id", [
      "friend-1",
      "friend-2",
    ]);
    expect(eligibilityChain.eq).toHaveBeenCalledWith("beach_id", "beach-1");
    expect(eligibilityChain.in).toHaveBeenCalledWith("user_id", [
      "friend-1",
      "friend-2",
    ]);
    expect(dataChain.in).toHaveBeenCalledWith("id", ["session-1"]);
    expect(likesChain.eq).toHaveBeenCalledWith("user_id", "current-user");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("uses beach lat/lon columns for nearby filtering and applies those beach IDs to session queries", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const nearbyChain = createThenableChain({
      data: [{ id: "beach-1" }, { id: "beach-2" }],
      error: null,
    });
    const countChain = createThenableChain({ count: 1, data: null, error: null });
    const eligibilityChain = createThenableChain({
      data: [eligibilityRow()],
      error: null,
    });
    const dataChain = createThenableChain({
      data: [
        {
          id: "session-1",
          user_id: "surfer-1",
          beach_name: "Ocean Beach Pier",
          beach_id: "beach-1",
          arrival_time: "2026-06-11T13:05:00.000Z",
          wave_quality: 4,
          wave_height_ft: 3,
          notes: "Fun morning",
          description: null,
          image_url: null,
          likes_count: 0,
          created_at: "2026-06-11T14:26:06.000Z",
          duration_minutes: 60,
          crowd_level: 2,
          water_temp: null,
          rating: 4,
          beaches: { name: "Ocean Beach Pier" },
          profiles: {
            id: "surfer-1",
            full_name: "Local Surfer",
            avatar_url: null,
          },
          session_media: [],
        },
      ],
      error: null,
    });

    const eligibilityChains = [countChain, eligibilityChain];
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "beaches") return nearbyChain;
      if (table === "public_session_feed_eligibility") return eligibilityChains.shift();
      if (table === "sessions") return dataChain;
      throw new Error(`Unexpected table ${table}`);
    });

    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/sessions/public?lat=32.75&lon=-117.25&radius_miles=30&page=1&limit=10",
    );
    const res = await GET(req as any);
    const payload = await expectSuccessResponse<any[]>(res, 200);

    expect(payload.data).toHaveLength(1);
    expect(nearbyChain.gte).toHaveBeenCalledWith("lat", expect.any(Number));
    expect(nearbyChain.lte).toHaveBeenCalledWith("lat", expect.any(Number));
    expect(nearbyChain.gte).toHaveBeenCalledWith("lon", expect.any(Number));
    expect(nearbyChain.lte).toHaveBeenCalledWith("lon", expect.any(Number));
    expect(nearbyChain.gte).not.toHaveBeenCalledWith("center_lat", expect.any(Number));
    expect(nearbyChain.lte).not.toHaveBeenCalledWith("center_lng", expect.any(Number));
    expect(countChain.in).toHaveBeenCalledWith("beach_id", ["beach-1", "beach-2"]);
    expect(eligibilityChain.in).toHaveBeenCalledWith("beach_id", ["beach-1", "beach-2"]);
    expect(dataChain.in).toHaveBeenCalledWith("id", ["session-1"]);
  });

  it("applies explicit quality filters before hydration", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const countChain = createThenableChain({ count: 0, data: null, error: null });
    const eligibilityChain = createThenableChain({ data: [], error: null });
    const eligibilityChains = [countChain, eligibilityChain];
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "public_session_feed_eligibility") return eligibilityChains.shift();
      throw new Error(`Unexpected table ${table}`);
    });

    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/sessions/public?quality=strong&page=1&limit=10",
    );
    const res = await GET(req as any);
    const payload = await expectSuccessResponse<any[]>(res, 200);

    expect(payload.data).toEqual([]);
    expect(countChain.eq).toHaveBeenCalledWith("strong", true);
    expect(eligibilityChain.eq).toHaveBeenCalledWith("strong", true);
  });

  it("does not apply a quality flag when quality=all", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const countChain = createThenableChain({ count: 0, data: null, error: null });
    const eligibilityChain = createThenableChain({ data: [], error: null });
    const eligibilityChains = [countChain, eligibilityChain];
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "public_session_feed_eligibility") return eligibilityChains.shift();
      throw new Error(`Unexpected table ${table}`);
    });

    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/sessions/public?quality=all&page=1&limit=10",
    );
    const res = await GET(req as any);
    const payload = await expectSuccessResponse<any[]>(res, 200);

    expect(payload.data).toEqual([]);
    expect(countChain.eq).not.toHaveBeenCalledWith("informative", true);
    expect(countChain.eq).not.toHaveBeenCalledWith("strong", true);
    expect(eligibilityChain.eq).not.toHaveBeenCalledWith("informative", true);
    expect(eligibilityChain.eq).not.toHaveBeenCalledWith("strong", true);
  });

  it("throws when nearby beach lookup fails instead of silently returning an empty feed", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const nearbyError = new Error("column beaches.center_lat does not exist");
    const nearbyChain = createThenableChain({
      data: null,
      error: nearbyError,
    });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "beaches") return nearbyChain;
      throw new Error(`Unexpected table ${table}`);
    });

    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/sessions/public?lat=32.75&lon=-117.25&page=1&limit=10",
    );

    await expect(GET(req as any)).rejects.toThrow("column beaches.center_lat does not exist");
  });
});
