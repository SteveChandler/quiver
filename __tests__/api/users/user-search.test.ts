/**
 * @jest-environment node
 */

import {
  createMockRequest,
  createMockSupabaseClient,
  createMockUser,
  expectSuccessResponse,
  mockAuthenticatedUser,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

let mockSupabaseClient: MockSupabaseClient;

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockSupabaseClient,
}));

const { GET } = require("@/app/api/users/search/route");

function createThenableChain<T>(data: T, error: unknown = null) {
  const chain: Record<string, jest.Mock> = {};
  [
    "select",
    "or",
    "neq",
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

describe("GET /api/users/search", () => {
  const viewerId = "550e8400-e29b-41d4-a716-446655440000";
  const followedUserId = "550e8400-e29b-41d4-a716-446655440001";
  const otherUserId = "550e8400-e29b-41d4-a716-446655440002";

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: viewerId }));
  });

  it("returns per-result following state for the authenticated viewer", async () => {
    const profilesChain = createThenableChain([
      {
        id: followedUserId,
        full_name: "Kelly Followed",
        avatar_url: null,
        email: "kelly.followed@example.com",
        followers_count: 7,
        following_count: 2,
      },
      {
        id: otherUserId,
        full_name: "Kelly Other",
        avatar_url: null,
        email: "kelly.other@example.com",
        followers_count: 3,
        following_count: 1,
      },
    ]);
    const followsChain = createThenableChain([
      { following_id: followedUserId },
    ]);

    (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "profiles") return profilesChain;
      if (table === "user_follows") return followsChain;
      throw new Error(`Unexpected table ${table}`);
    });

    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/users/search?q=kelly&limit=25",
    );
    const res = await GET(req as any);
    const body = await expectSuccessResponse(res, 200);

    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(followsChain.eq).toHaveBeenCalledWith("follower_id", viewerId);
    expect(followsChain.in).toHaveBeenCalledWith("following_id", [
      followedUserId,
      otherUserId,
    ]);
    const users = (body.data as any).users;
    expect(users).toEqual([
      expect.objectContaining({
        id: followedUserId,
        following: true,
      }),
      expect.objectContaining({
        id: otherUserId,
        following: false,
      }),
    ]);
    expect(users[0]).not.toHaveProperty("email");
    expect(users[1]).not.toHaveProperty("email");
  });
});
