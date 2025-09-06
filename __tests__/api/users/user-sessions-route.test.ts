/**
 * @jest-environment node
 */

import { GET } from "@/app/api/users/[id]/sessions/route";
import {
  createMockSupabaseClient,
  createMockRequest,
  mockUnauthenticatedUser,
  expectErrorResponse,
  expectSuccessResponse,
} from "@/test-utils/api-test-helpers";

// Mock API server client used by route handlers
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

describe("/api/users/[id]/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 on invalid user id (UUID)", async () => {
    const req = createMockRequest("GET", "http://localhost:3000/api/users/not-a-uuid/sessions");
    const res = await GET(req as any, { params: { id: "not-a-uuid" } });
    await expectErrorResponse(res, 400);
  });

  it("adds is_public filter for unauthenticated viewer", async () => {
    // Unauthenticated by default
    mockUnauthenticatedUser(mockSupabaseClient as any);

    // Build a controllable chain for sessions query
    const eqMock = jest.fn();
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: eqMock.mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: jest.fn((onResolve: any) => onResolve({ data: [], error: null })),
    };

    (mockSupabaseClient as any).from.mockImplementation((table: string) => {
      if (table === "sessions") return chain;
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
    });

    const userId = "550e8400-e29b-41d4-a716-446655440000";
    const req = createMockRequest("GET", `http://localhost:3000/api/users/${userId}/sessions`);
    const res = await GET(req as any, { params: { id: userId } });
    await expectSuccessResponse(res, 200);

    // Expect filter applied
    const hadIsPublicFilter = eqMock.mock.calls.some(
      (args: any[]) => args[0] === "is_public" && args[1] === true
    );
    expect(hadIsPublicFilter).toBe(true);
  });
});

