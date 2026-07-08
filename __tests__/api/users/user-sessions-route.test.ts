/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  mockUnauthenticatedUser,
  expectErrorResponse,
  expectSuccessResponse,
} from "@/test-utils/api-test-helpers";

// Mock API server client used by route handlers
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/middleware/api-wrappers", () => {
  const { NextResponse } = require("next/server");
  return {
    withBotBlockingAndRateLimit: (handler: any) => handler,
    withAuth:
      (handler: any, options: any = {}) =>
      async (request: any, context: any) => {
        try {
          const { data, error } = await mockSupabaseClient.auth.getUser();
          const user = error ? null : data?.user ?? null;
          if (!options.optional && !user) {
            return NextResponse.json(
              { success: false, error: "Authentication required", timestamp: Date.now() },
              { status: 401 },
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
        } catch (err: any) {
          return NextResponse.json(
            { success: false, error: options.errorMessage ?? err?.message ?? "Internal error", timestamp: Date.now() },
            { status: 500 },
          );
        }
      },
    createSuccessResponse: (data: any) => {
      const { NextResponse } = require("next/server");
      return NextResponse.json({ success: true, data, timestamp: Date.now() });
    },
    createValidationError: (message: string) => {
      const { NextResponse } = require("next/server");
      return NextResponse.json(
        { success: false, error: message, timestamp: Date.now() },
        { status: 400 },
      );
    },
    methodNotAllowed: (allowed: string[]) => {
      const { NextResponse } = require("next/server");
      return NextResponse.json(
        { error: `Method not allowed. Allowed: ${allowed.join(", ")}` },
        { status: 405 },
      );
    },
  };
});

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

// Import after mocks

const { GET } = require("@/app/api/users/[id]/sessions/route");

function normalizeSelect(select: string): string {
  return select.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

describe("/api/users/[id]/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 on invalid user id (UUID)", async () => {
    const req = createMockRequest("GET", "http://localhost:3000/api/users/not-a-uuid/sessions");
    const res = await GET(req as any, { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(res.status).toBe(400);
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
    const res = await GET(req as any, { params: Promise.resolve({ id: userId }) });
    await expectSuccessResponse(res, 200);

    const select = normalizeSelect(chain.select.mock.calls[0][0]);
    expect(select).not.toContain("*");
    expect(select).toContain(
      "id, user_id, beach_id, beach_name, board_id, board_snapshot, arrival_time, created_at, duration_minutes, status, is_public, rating, wave_quality, crowd_level, parking_ease, description, notes, image_url, water_temp, wave_height_ft, wind_speed_mph, wind_direction, tide_status, tide_height_ft, tide_rate_ft_per_hr, tide_data_source, forecast_accuracy, goals, invitee_ids, comments_count, likes_count, share_count, muted, rip_current_observed, rip_current_risk, session_board_fit, session_decomposition, session_skill_fit, skill_ratings, source, wave_characteristics, custom_spot_id"
    );
    expect(select).toContain("beach:beaches(id, name, lat, lon)");
    expect(select).toContain("user:profiles(id, full_name, avatar_url)");

    // Expect filter applied
    const hadIsPublicFilter = eqMock.mock.calls.some(
      (args: any[]) => args[0] === "is_public" && args[1] === true
    );
    expect(hadIsPublicFilter).toBe(true);
  });
});
