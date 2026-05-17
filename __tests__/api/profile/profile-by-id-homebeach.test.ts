/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  mockUnauthenticatedUser,
  expectSuccessResponse,
} from "@/test-utils/api-test-helpers";

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withBotBlockingAndRateLimit: (handler: any) => handler,
    withAuth:
      (handler: any, options: any = {}) =>
      async (request: any, context: any) => {
        const { data, error } = await mockSupabaseClient.auth.getUser();
        const user = error ? null : data?.user ?? null;
        if (!options.optional && !user) {
          const { createAuthError } = jest.requireActual("@/lib/api-utils");
          return createAuthError(
            options.authErrorMessage ?? "Authentication required"
          );
        }
        const resolvedParams = context?.params
          ? typeof context.params === "object" && "then" in context.params
            ? await context.params
            : context.params
          : {};
        return await handler(request, {
          params: resolvedParams,
          user,
          supabase: mockSupabaseClient,
        });
      },
  };
});

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

// Import after mocks
 
const { GET } = require("@/app/api/profile/[id]/route");

describe("/api/profile/[id] includes home_beach", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns home_beach object when available", async () => {
    const targetUserId = "550e8400-e29b-41d4-a716-446655440001";

    mockUnauthenticatedUser(mockSupabaseClient as any);

    // profiles_with_home_beach view for base DTO
    (mockSupabaseClient as any).from.mockImplementation((table: string) => {
      if (table === "profiles_with_home_beach") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve({
            data: {
              id: targetUserId,
              full_name: "Test User",
              home_beach_id: "550e8400-e29b-41d4-a716-446655440099",
              home_beach_name: "Malibu",
            },
            error: null,
          })),
        } as any;
      }

      if (table === "profiles") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve({
            data: {
              followers_count: 10,
              following_count: 5,
              created_at: "2024-01-01T00:00:00Z",
              avatar_url: null,
              email: "user@test.local",
              bio: "Hello",
              location: "San Diego",
              experience_level: "intermediate",
              instagram: null,
              home_beach: { id: "550e8400-e29b-41d4-a716-446655440099", name: "Malibu" },
            },
            error: null,
          })),
        } as any;
      }

      if (table === "sessions") {
        // No sessions needed for this test
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          data: [],
          error: null,
        } as any;
      }

      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      } as any;
    });

    const req = createMockRequest("GET");
    const res = await GET(req as any, { params: Promise.resolve({ id: targetUserId }) });
    const body = await expectSuccessResponse<any>(res, 200);

    expect(body.data).toMatchObject({
      id: targetUserId,
      homeBeachName: "Malibu",
      home_beach: { id: "550e8400-e29b-41d4-a716-446655440099", name: "Malibu" },
    });
  });

  it("defaults notif_push_enabled to false when the profile value is null", async () => {
    const targetUserId = "550e8400-e29b-41d4-a716-446655440002";

    mockUnauthenticatedUser(mockSupabaseClient as any);

    (mockSupabaseClient as any).from.mockImplementation((table: string) => {
      if (table === "profiles_with_home_beach") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() =>
            Promise.resolve({
              data: {
                id: targetUserId,
                full_name: "Pushless User",
                home_beach_id: null,
                home_beach_name: null,
              },
              error: null,
            })
          ),
        } as any;
      }

      if (table === "profiles") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() =>
            Promise.resolve({
              data: {
                followers_count: 0,
                following_count: 0,
                created_at: "2024-01-01T00:00:00Z",
                avatar_url: null,
                email: null,
                bio: null,
                location: null,
                experience_level: null,
                instagram: null,
                notif_push_enabled: null,
                home_beach: null,
              },
              error: null,
            })
          ),
        } as any;
      }

      if (table === "sessions") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          data: [],
          error: null,
        } as any;
      }

      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      } as any;
    });

    const req = createMockRequest("GET");
    const res = await GET(req as any, { params: Promise.resolve({ id: targetUserId }) });
    const body = await expectSuccessResponse<any>(res, 200);

    expect(body.data.notif_push_enabled).toBe(false);
  });
});
