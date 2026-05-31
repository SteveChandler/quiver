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

    const countChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: jest.fn((onResolve: any) =>
        onResolve({ count: 1, data: null, error: null })
      ),
    };

    const dataChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
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

    let call = 0;
    (mockSupabaseClient as any).from.mockImplementation((table: string) => {
      expect(table).toBe("sessions");
      call += 1;
      return call === 1 ? countChain : dataChain;
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

    const createChain = (result: any) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn((onResolve: any) => onResolve(result)),
      };
      return chain;
    };

    const blocksChain = createChain({ data: [], error: null });
    const followsChain = createChain({
      data: [
        { following_id: "friend-1" },
        { following_id: "friend-2" },
      ],
      error: null,
    });
    const countChain = createChain({ count: 1, data: null, error: null });
    const dataChain = createChain({
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
    const likesChain = createChain({ data: [], error: null });

    const sessionsChains = [countChain, dataChain];
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "user_blocks") return blocksChain;
      if (table === "user_follows") return followsChain;
      if (table === "session_likes") return likesChain;
      if (table === "sessions") return sessionsChains.shift();
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
    expect(countChain.in).toHaveBeenCalledWith("user_id", [
      "friend-1",
      "friend-2",
    ]);
    expect(dataChain.eq).toHaveBeenCalledWith("beach_id", "beach-1");
    expect(dataChain.in).toHaveBeenCalledWith("user_id", [
      "friend-1",
      "friend-2",
    ]);
    expect(likesChain.eq).toHaveBeenCalledWith("user_id", "current-user");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
