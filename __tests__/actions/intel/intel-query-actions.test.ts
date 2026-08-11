/**
 * @jest-environment node
 *
 * Tests for actions/intel/intel-query-actions.ts
 *
 * Covers:
 * - getNearbyIntelPosts: geo-spatial RPC, profile enrichment, confirmation state
 * - getPublicIntelPosts: same RPC without user confirmations
 * - getAllIntelPosts: service-role client, tag filtering, fallback to global
 * - Empty results handling
 * - RPC failure (returns empty, not fallback)
 * - Profile lookup failure (graceful degradation to RPC fallback names)
 * - Pagination params forwarding
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockAuthUser = { id: "auth-user-123" };

const mockServerClient = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    }),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockResolvedValue({ data: [], error: null }),
  gte: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  single: jest.fn(),
  rpc: jest.fn(),
};

const mockServiceRoleClient = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: mockAuthUser },
      error: null,
    }),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockResolvedValue({ data: [], error: null }),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  rpc: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(mockServerClient)),
  createSupabaseServiceRoleClient: jest.fn(() =>
    Promise.resolve(mockServiceRoleClient)
  ),
}));

// Import after mocks
import {
  getNearbyIntelPosts,
  getPublicIntelPosts,
  getAllIntelPosts,
} from "@/actions/intel/intel-query-actions";

// =============================================================================
// HELPERS
// =============================================================================

const SAMPLE_RPC_POSTS = [
  {
    id: "post-1",
    user_id: "user-1",
    beach_id: "beach-1",
    latitude: 32.72,
    longitude: -117.16,
    tag: "conditions",
    title: "Great waves",
    description: "Clean overhead sets",
    photo_url: null,
    is_active: true,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    confirmations_count: 3,
    beach_name: "Ocean Beach",
    distance_miles: 1.2,
    user_name: "FallbackUser",
    surf_conditions: null,
  },
  {
    id: "post-2",
    user_id: "user-2",
    beach_id: "beach-2",
    latitude: 32.85,
    longitude: -117.27,
    tag: "crowd",
    title: "Packed lineup",
    description: "Super crowded",
    photo_url: "https://example.com/photo.jpg",
    is_active: true,
    expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    confirmations_count: 0,
    beach_name: "La Jolla Shores",
    distance_miles: 5.4,
    user_name: "AnotherUser",
    surf_conditions: { wave_height: 3 },
  },
];

const SAMPLE_PROFILES = [
  {
    id: "user-1",
    full_name: "John Surfer",
    avatar_url: "https://example.com/john.jpg",
  },
  {
    id: "user-2",
    full_name: "Jane Rider",
    avatar_url: null,
  },
];

// =============================================================================
// TESTS
// =============================================================================

describe("getNearbyIntelPosts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: authenticated user via server client (used for auth check)
    mockServerClient.auth.getUser.mockResolvedValue({
      data: { user: mockAuthUser },
      error: null,
    });
  });

  test("returns enriched posts from RPC with profiles", async () => {
    mockServiceRoleClient.rpc.mockResolvedValueOnce({
      data: SAMPLE_RPC_POSTS,
      error: null,
    });
    // profiles query
    mockServiceRoleClient.in.mockResolvedValueOnce({
      data: SAMPLE_PROFILES,
      error: null,
    });
    // confirmations query
    mockServiceRoleClient.in.mockResolvedValueOnce({
      data: [{ intel_post_id: "post-1" }],
      error: null,
    });

    const result = await getNearbyIntelPosts({
      lat: 32.72,
      lon: -117.16,
      radius: 5,
      tag: "all",
      limit: 50,
    });

    expect(result.success).toBe(true);
    expect(result.data?.posts).toHaveLength(2);
    const posts = (result.data as any).posts;
    expect(posts[0].user.full_name).toBe("John Surfer");
    expect(posts[0].user_has_confirmed).toBe(true);
    expect(posts[1].user_has_confirmed).toBe(false);
  });

  test("returns empty results when RPC fails (no fallback)", async () => {
    mockServiceRoleClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });

    const result = await getNearbyIntelPosts({
      lat: 32.72,
      lon: -117.16,
    });

    expect(result.success).toBe(true);
    expect(result.data?.posts).toEqual([]);
    expect(result.data?.total).toBe(0);
    expect(result.error).toContain("Unable to fetch nearby intel posts");
  });

  test("returns empty results when no posts found", async () => {
    mockServiceRoleClient.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await getNearbyIntelPosts({
      lat: 32.72,
      lon: -117.16,
    });

    expect(result.success).toBe(true);
    expect(result.data?.posts).toEqual([]);
    expect(result.data?.total).toBe(0);
  });

  test("passes correct parameters to RPC", async () => {
    mockServiceRoleClient.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await getNearbyIntelPosts({
      lat: 33.0,
      lon: -118.5,
      radius: 10,
      tag: "conditions",
      limit: 25,
    });

    expect(mockServiceRoleClient.rpc).toHaveBeenCalledWith(
      "get_nearby_intel_posts",
      {
        center_lat: 33.0,
        center_lng: -118.5,
        radius_miles: 10,
        tag_filter: "conditions",
        limit_count: 25,
      }
    );
  });

  test("passes null tag_filter for 'all'", async () => {
    mockServiceRoleClient.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await getNearbyIntelPosts({
      lat: 32.72,
      lon: -117.16,
      tag: "all",
    });

    expect(mockServiceRoleClient.rpc).toHaveBeenCalledWith(
      "get_nearby_intel_posts",
      expect.objectContaining({ tag_filter: undefined })
    );
  });

  test("uses default radius and limit when not provided", async () => {
    mockServiceRoleClient.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await getNearbyIntelPosts({
      lat: 32.72,
      lon: -117.16,
    });

    expect(mockServiceRoleClient.rpc).toHaveBeenCalledWith(
      "get_nearby_intel_posts",
      expect.objectContaining({
        radius_miles: 5,
        limit_count: 50,
      })
    );
  });

  test("uses fallback user name when profile lookup fails", async () => {
    mockServiceRoleClient.rpc.mockResolvedValueOnce({
      data: [SAMPLE_RPC_POSTS[0]],
      error: null,
    });
    // profiles query fails
    mockServiceRoleClient.in.mockResolvedValueOnce({
      data: null,
      error: { message: "RLS policy denied" },
    });
    // confirmations
    mockServiceRoleClient.in.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await getNearbyIntelPosts({
      lat: 32.72,
      lon: -117.16,
    });

    expect(result.success).toBe(true);
    // Falls back to user_name from RPC
    expect((result.data as any).posts[0].user.full_name).toBe("FallbackUser");
  });

  test("skips confirmations check for unauthenticated user", async () => {
    mockServerClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    mockServiceRoleClient.rpc.mockResolvedValueOnce({
      data: [SAMPLE_RPC_POSTS[0]],
      error: null,
    });
    // profiles
    mockServiceRoleClient.in.mockResolvedValueOnce({
      data: SAMPLE_PROFILES,
      error: null,
    });

    const result = await getNearbyIntelPosts({
      lat: 32.72,
      lon: -117.16,
    });

    expect(result.success).toBe(true);
    // The conditions linkage lookup is also batched, even when it returns no rows.
    expect(mockServiceRoleClient.in).toHaveBeenCalledTimes(2);
    expect(result.data?.posts[0].user_has_confirmed).toBe(false);
  });

  test("includes filters in response", async () => {
    mockServiceRoleClient.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await getNearbyIntelPosts({
      lat: 32.72,
      lon: -117.16,
      radius: 10,
      tag: "conditions",
      limit: 25,
    });

    expect(result.data?.filters).toEqual({
      lat: 32.72,
      lon: -117.16,
      radius: 10,
      tag: "conditions",
      limit: 25,
    });
  });
});

describe("getPublicIntelPosts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns posts without user confirmations", async () => {
    mockServerClient.rpc.mockResolvedValueOnce({
      data: [SAMPLE_RPC_POSTS[0]],
      error: null,
    });
    mockServerClient.in.mockResolvedValueOnce({
      data: SAMPLE_PROFILES,
      error: null,
    });

    const result = await getPublicIntelPosts({
      lat: 32.72,
      lon: -117.16,
    });

    expect(result.success).toBe(true);
    expect(result.data?.posts[0].user_has_confirmed).toBe(false);
    // The conditions linkage lookup is also batched, even when it returns no rows.
    expect(mockServerClient.in).toHaveBeenCalledTimes(2);
  });

  test("returns empty results when RPC fails", async () => {
    mockServerClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });

    const result = await getPublicIntelPosts({
      lat: 32.72,
      lon: -117.16,
    });

    expect(result.success).toBe(true);
    expect(result.data?.posts).toEqual([]);
    expect(result.error).toContain("Unable to fetch nearby intel posts");
  });

  test("uses fallback names when profile lookup fails", async () => {
    mockServerClient.rpc.mockResolvedValueOnce({
      data: [SAMPLE_RPC_POSTS[0]],
      error: null,
    });
    mockServerClient.in.mockResolvedValueOnce({
      data: null,
      error: { message: "error" },
    });

    const result = await getPublicIntelPosts({
      lat: 32.72,
      lon: -117.16,
    });

    expect(result.success).toBe(true);
    expect((result.data as any).posts[0].user.full_name).toBe("FallbackUser");
  });
});

describe("getAllIntelPosts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServerClient.auth.getUser.mockResolvedValue({
      data: { user: mockAuthUser },
      error: null,
    });
  });

  test("filters by tag when provided", async () => {
    // Track the eq calls through a custom mock chain
    const eqCalls: [string, any][] = [];
    const mockPostsQuery: any = {};
    const addBuilder = (obj: any) => {
      obj.select = jest.fn().mockReturnValue(obj);
      obj.eq = jest.fn((...args: any[]) => {
        eqCalls.push(args as [string, any]);
        return obj;
      });
      obj.or = jest.fn().mockReturnValue(obj);
      obj.order = jest.fn().mockReturnValue(obj);
      obj.limit = jest.fn().mockReturnValue(obj);
      // Make the builder "thenable" so await resolves the query
      obj.then = (resolve: any) =>
        resolve({ data: [], error: null });
      return obj;
    };
    addBuilder(mockPostsQuery);

    mockServiceRoleClient.from.mockReturnValueOnce(mockPostsQuery);

    await getAllIntelPosts({ tag: "conditions", limit: 10 });

    // eq is called with ("is_active", true) first, then ("tag", "conditions")
    const tagCall = eqCalls.find(([key]) => key === "tag");
    expect(tagCall).toEqual(["tag", "conditions"]);
  });

  test("catches and returns error on unexpected exceptions", async () => {
    // Force an exception by making the service role client throw
    const { createSupabaseServiceRoleClient } = jest.requireMock(
      "@/lib/supabase/server"
    );
    createSupabaseServiceRoleClient.mockRejectedValueOnce(
      new Error("Connection failed")
    );

    const result = await getAllIntelPosts();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Connection failed");
  });
});
