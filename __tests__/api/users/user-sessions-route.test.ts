/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  createMockUser,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  expectErrorResponse,
  expectSuccessResponse,
  type MockQueryChain,
} from "@/test-utils/api-test-helpers";

// Mock API server client used by route handlers
const mockSupabaseClient = createMockSupabaseClient();
const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

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
    mockUnauthenticatedUser(mockSupabaseClient);
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

describe("owner session import metadata", () => {
  const ownerId = "550e8400-e29b-41d4-a716-446655440000";
  const viewerId = "550e8400-e29b-41d4-a716-446655440001";
  const sessions = [
    { id: "session-1", user_id: ownerId, notes: "Existing notes" },
    { id: "session-2", user_id: ownerId, notes: null },
  ];

  function queryResult(data: unknown, error: unknown = null): MockQueryChain {
    const chain = createMockSupabaseClient().from("sessions");
    chain.then.mockImplementation((resolve) => Promise.resolve(resolve({ data, error })));
    chain.maybeSingle.mockResolvedValue({ data, error });
    return chain;
  }

  function mockQueries(rows = sessions): Record<string, MockQueryChain> {
    const queries = {
      sessions: queryResult(rows),
      session_tracks: queryResult([{ session_id: "session-1" }]),
      session_media: queryResult([]),
      user_blocks: queryResult(null),
    };
    mockSupabaseClient.from.mockImplementation((table: string) => queries[table as keyof typeof queries]);
    return queries;
  }

  async function getSessions(): Promise<Response> {
    const request = createMockRequest("GET", `http://localhost:3000/api/users/${ownerId}/sessions`);
    return GET(request, { params: Promise.resolve({ id: ownerId }) });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: ownerId }));
    process.env.SESSION_IMPORTS_ENABLED = "true";
    process.env.SESSION_IMPORTS_USER_ALLOWLIST = ownerId;
  });

  it("adds track status per owner session and exposes the owner flag", async () => {
    const queries = mockQueries();

    const body = await expectSuccessResponse<{ sessions: unknown[]; sessionImportsEnabled: boolean }>(await getSessions());

    expect(body.data.sessionImportsEnabled).toBe(true);
    expect(body.data.sessions).toEqual([
      expect.objectContaining({ ...sessions[0], has_track: true }),
      expect.objectContaining({ ...sessions[1], has_track: false }),
    ]);
    expect(queries.session_tracks.eq).toHaveBeenCalledWith("user_id", ownerId);
    expect(queries.session_tracks.in).toHaveBeenCalledWith("session_id", ["session-1", "session-2"]);
    expect(mockSupabaseClient.from.mock.calls.filter(([table]) => table === "session_tracks")).toHaveLength(1);
  });

  it("omits track status and the flag for a non-owner", async () => {
    mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: viewerId }));
    const queries = mockQueries();

    const body = await expectSuccessResponse<{ sessions: Record<string, unknown>[] }>(await getSessions());

    expect(body.data).not.toHaveProperty("sessionImportsEnabled");
    expect(body.data.sessions).toHaveLength(2);
    body.data.sessions.forEach((session) => expect(session).not.toHaveProperty("has_track"));
    expect(queries.sessions.eq).toHaveBeenCalledWith("is_public", true);
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith("session_tracks");
  });

  it("omits import metadata for a blocked target", async () => {
    mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: viewerId }));
    const queries = mockQueries();
    queries.user_blocks.maybeSingle.mockResolvedValue({ data: { blocked_id: ownerId }, error: null });

    const body = await expectSuccessResponse(await getSessions());

    expect(body.data).toEqual({ sessions: [] });
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith("sessions");
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith("session_tracks");
  });

  it.each(["query error", "thrown error"])("returns owner sessions with false track status on a %s", async (failure) => {
    const queries = mockQueries();
    const error = new Error("Tracks service unavailable");
    if (failure === "query error") {
      queries.session_tracks.then.mockImplementation((resolve) => Promise.resolve(resolve({ data: null, error })));
    } else {
      queries.session_tracks.then.mockImplementation(() => { throw error; });
    }
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const body = await expectSuccessResponse<{ sessions: Record<string, unknown>[]; sessionImportsEnabled: boolean }>(await getSessions());

    expect(body.data.sessionImportsEnabled).toBe(true);
    expect(body.data.sessions).toEqual(sessions.map((session) => expect.objectContaining({ ...session, has_track: false })));
    expect(errorLog).toHaveBeenCalledWith(expect.any(String), error);
  });

  it("exposes the owner flag even when there are no sessions", async () => {
    mockQueries([]);

    const body = await expectSuccessResponse(await getSessions());

    expect(body.data).toEqual({ sessions: [], sessionImportsEnabled: true });
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith("session_tracks");
  });
});
