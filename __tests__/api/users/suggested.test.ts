/**
 * @jest-environment node
 */

import { NextResponse } from "next/server";
import {
  createMockRequest,
  createMockSupabaseClient,
  createMockUser,
  expectSuccessResponse,
  mockAuthenticatedUser,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

let mockSupabaseClient: MockSupabaseClient;

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth:
    (handler: any, options: any = {}) =>
    async (request: any, context: any = {}) => {
      try {
        const { data, error } = await mockSupabaseClient.auth.getUser();
        const user = error ? null : data?.user ?? null;
        if (!user) {
          return NextResponse.json(
            { error: options.authErrorMessage ?? "Authentication required" },
            { status: 401 },
          );
        }
        return handler(request, {
          params: context.params ?? {},
          user,
          supabase: mockSupabaseClient,
        });
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            error: options.errorMessage ?? err?.message ?? "Internal error",
            timestamp: Date.now(),
          },
          { status: 500 },
        );
      }
    },
  createSuccessResponse: (data: any) =>
    NextResponse.json({ success: true, data, timestamp: Date.now() }),
}));

const { GET } = require("@/app/api/users/suggested/route");

function createThenableChain<T>(data: T, error: unknown = null) {
  const chain: Record<string, jest.Mock> = {};
  [
    "select",
    "neq",
    "not",
    "is",
    "or",
    "gt",
    "order",
    "limit",
    "eq",
    "in",
  ].forEach((method) => {
    chain[method] = jest.fn(() => chain);
  });
  chain.then = jest.fn((resolve) => Promise.resolve(resolve({ data, error })));
  return chain;
}

describe("GET /api/users/suggested", () => {
  const viewerId = "550e8400-e29b-41d4-a716-446655440000";
  const followedUserId = "550e8400-e29b-41d4-a716-446655440001";
  const otherUserId = "550e8400-e29b-41d4-a716-446655440002";

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: viewerId }));
  });

  it("returns suggested profiles with follow state and no-store cache headers", async () => {
    const profilesChain = createThenableChain([
      {
        id: followedUserId,
        full_name: "Kelly Followed",
        avatar_url: null,
        followers_count: 12,
        following_count: 2,
        deleted_at: null,
        is_mock: false,
        analytics_is_real_user: true,
        is_system_account: false,
      },
      {
        id: otherUserId,
        full_name: "Jordan Local",
        avatar_url: null,
        followers_count: 6,
        following_count: 1,
        deleted_at: null,
        is_mock: false,
        analytics_is_real_user: true,
        is_system_account: false,
      },
    ]);
    const blocksChain = createThenableChain([]);
    const followsChain = createThenableChain([
      { following_id: followedUserId },
    ]);

    (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "user_blocks") return blocksChain;
      if (table === "profiles") return profilesChain;
      if (table === "user_follows") return followsChain;
      throw new Error(`Unexpected table ${table}`);
    });

    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/users/suggested?limit=25",
    );
    const res = await GET(req as any);
    const body = await expectSuccessResponse(res, 200);

    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(blocksChain.eq).toHaveBeenCalledWith("blocker_id", viewerId);
    expect(profilesChain.neq).toHaveBeenCalledWith("id", viewerId);
    expect(profilesChain.not).toHaveBeenCalledWith("full_name", "is", null);
    expect(profilesChain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(profilesChain.or).toHaveBeenCalledWith("is_mock.is.null,is_mock.eq.false");
    expect(profilesChain.or).toHaveBeenCalledWith("is_system_account.is.null,is_system_account.eq.false");
    expect(profilesChain.limit).toHaveBeenCalledWith(60);
    expect(followsChain.eq).toHaveBeenCalledWith("follower_id", viewerId);
    expect(followsChain.in).toHaveBeenCalledWith("following_id", [
      followedUserId,
      otherUserId,
    ]);
    expect((body.data as any).users).toEqual([
      expect.objectContaining({
        id: followedUserId,
        following: true,
      }),
      expect.objectContaining({
        id: otherUserId,
        following: false,
      }),
    ]);
    expect((body.data as any).source).toBe("popular_profiles");
  });

  it("filters blocked and non-public profiles before returning follow state", async () => {
    const blockedUserId = "550e8400-e29b-41d4-a716-446655440003";
    const deletedUserId = "550e8400-e29b-41d4-a716-446655440004";
    const mockUserId = "550e8400-e29b-41d4-a716-446655440005";
    const systemUserId = "550e8400-e29b-41d4-a716-446655440006";
    const nonRealUserId = "550e8400-e29b-41d4-a716-446655440007";

    const profilesChain = createThenableChain([
      {
        id: blockedUserId,
        full_name: "Blocked User",
        avatar_url: null,
        followers_count: 20,
        following_count: 1,
        deleted_at: null,
        is_mock: false,
        analytics_is_real_user: true,
        is_system_account: false,
      },
      {
        id: deletedUserId,
        full_name: "Deleted User",
        avatar_url: null,
        followers_count: 18,
        following_count: 1,
        deleted_at: "2026-07-01T00:00:00Z",
        is_mock: false,
        analytics_is_real_user: true,
        is_system_account: false,
      },
      {
        id: mockUserId,
        full_name: "Mock User",
        avatar_url: null,
        followers_count: 17,
        following_count: 1,
        deleted_at: null,
        is_mock: true,
        analytics_is_real_user: true,
        is_system_account: false,
      },
      {
        id: systemUserId,
        full_name: "System User",
        avatar_url: null,
        followers_count: 16,
        following_count: 1,
        deleted_at: null,
        is_mock: false,
        analytics_is_real_user: true,
        is_system_account: true,
      },
      {
        id: nonRealUserId,
        full_name: "Non Real User",
        avatar_url: null,
        followers_count: 15,
        following_count: 1,
        deleted_at: null,
        is_mock: false,
        analytics_is_real_user: false,
        is_system_account: false,
      },
      {
        id: otherUserId,
        full_name: "Jordan Local",
        avatar_url: null,
        followers_count: 6,
        following_count: 1,
        deleted_at: null,
        is_mock: false,
        analytics_is_real_user: true,
        is_system_account: false,
      },
    ]);
    const blocksChain = createThenableChain([{ blocked_id: blockedUserId }]);
    const followsChain = createThenableChain([]);

    (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "user_blocks") return blocksChain;
      if (table === "profiles") return profilesChain;
      if (table === "user_follows") return followsChain;
      throw new Error(`Unexpected table ${table}`);
    });

    const req = createMockRequest("GET", "http://localhost:3000/api/users/suggested");
    const res = await GET(req as any);
    const body = await expectSuccessResponse(res, 200);

    expect(followsChain.in).toHaveBeenCalledWith("following_id", [otherUserId]);
    expect((body.data as any).users).toEqual([
      expect.objectContaining({
        id: otherUserId,
        following: false,
      }),
    ]);
    expect((body.data as any).users[0]).not.toHaveProperty("deleted_at");
    expect((body.data as any).users[0]).not.toHaveProperty("is_mock");
    expect((body.data as any).users[0]).not.toHaveProperty("analytics_is_real_user");
    expect((body.data as any).users[0]).not.toHaveProperty("is_system_account");
  });
});
