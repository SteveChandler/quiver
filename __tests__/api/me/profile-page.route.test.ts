/**
 * Tests for GET /api/me/profile-page
 *
 * Validates:
 * - Authentication requirement
 * - Aggregated data structure
 * - All required fields present
 * - Error handling
 */

describe("GET /api/me/profile-page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    jest.doMock("@/lib/api-utils", () => ({
      createAuthError: () => ({
        status: 401,
        json: async () => ({ success: false, error: "Unauthorized" }),
      }),
      createSuccessResponse: (data: any, status = 200) => ({
        status,
        json: async () => ({ success: true, data }),
      }),
      handleApiError: (err: any) => ({
        status: 500,
        json: async () => ({ success: false, error: String(err) }),
      }),
      methodNotAllowed: () => ({
        status: 405,
        json: async () => ({ success: false, error: "Method not allowed" }),
      }),
    }));

    jest.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: { message: "No auth" } }),
        },
      }),
    }));

    const { GET } = await import("@/app/api/me/profile-page/route");
    const res = await GET({} as any);

    expect(res.status).toBe(401);
    const json = await (res as any).json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns aggregated profile page data with all required fields", async () => {
    const mockProfile = {
      id: "user-123",
      full_name: "Test Surfer",
      avatar_url: "https://example.com/avatar.jpg",
      bio: "Love surfing",
      location: "San Diego, CA",
      instagram: "@testsurfer",
      home_beach_id: "beach-456",
      experience_level: "intermediate",
      surf_styles: ["shortboard", "longboard"],
      notif_reminders: true,
      notif_forecast_alerts: true,
      digest_session_invites: false,
      inapp_session_invites: true,
      email_session_invites: true,
      allow_implicit_tracking: true,
      home_beach: { id: "beach-456", name: "La Jolla Shores" },
    };

    const mockPreferences = {
      user_id: "user-123",
      wave_min_ft: 3,
      wave_max_ft: 6,
      confidence: 0.75,
      sample_size: 12,
    };

    jest.doMock("@/lib/api-utils", () => ({
      createAuthError: () => ({
        status: 401,
        json: async () => ({ success: false, error: "Unauthorized" }),
      }),
      createSuccessResponse: (data: any, status = 200) => ({
        status,
        json: async () => ({ success: true, data }),
      }),
      handleApiError: (err: any) => ({
        status: 500,
        json: async () => ({ success: false, error: String(err) }),
      }),
      methodNotAllowed: () => ({
        status: 405,
        json: async () => ({ success: false, error: "Method not allowed" }),
      }),
    }));

    jest.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-123" } }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => {
                if (table === "profiles") return { data: mockProfile, error: null };
                if (table === "user_surf_preferences") return { data: mockPreferences, error: null };
                return { data: null, error: null };
              },
              order: () => ({
                limit: async () => {
                  if (table === "sessions") return { data: [], error: null };
                  if (table === "boards") return { data: [], error: null };
                  return { data: [], error: null };
                },
              }),
            }),
            or: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
            count: "exact",
            head: true,
          }),
        }),
        rpc: async () => ({ data: [], error: null }),
      }),
    }));

    jest.doMock("@/actions/session-actions", () => ({
      addFeaturedPhotoToSessions: async (_: any, sessions: any[]) => sessions,
    }));

    // Clear module cache to pick up mocks
    jest.resetModules();

    const { GET } = await import("@/app/api/me/profile-page/route");
    const res = await GET({} as any);

    expect(res.status).toBe(200);
    const json = await (res as any).json();

    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();

    // Check profile structure
    expect(json.data.profile).toBeDefined();
    expect(json.data.profile.id).toBe("user-123");
    expect(json.data.profile.full_name).toBe("Test Surfer");
    expect(json.data.profile.homeBeachName).toBe("La Jolla Shores");

    // Check stats structure
    expect(json.data.stats).toBeDefined();
    expect(typeof json.data.stats.sessionCount).toBe("number");
    expect(typeof json.data.stats.boardCount).toBe("number");

    // Check preferences structure
    expect(json.data.preferences).toBeDefined();
    expect(json.data.preferences.onboarding).toBeDefined();

    // Check arrays present
    expect(Array.isArray(json.data.recentSessions)).toBe(true);
    expect(Array.isArray(json.data.boards)).toBe(true);
    expect(Array.isArray(json.data.beaches)).toBe(true);
  });

  it("handles missing learned preferences gracefully", async () => {
    const mockProfile = {
      id: "user-123",
      full_name: "New User",
      avatar_url: null,
      bio: null,
      location: null,
      instagram: null,
      home_beach_id: null,
      experience_level: null,
      surf_styles: null,
      notif_reminders: null,
      notif_forecast_alerts: null,
      digest_session_invites: null,
      inapp_session_invites: null,
      email_session_invites: null,
      allow_implicit_tracking: null,
      home_beach: null,
    };

    jest.doMock("@/lib/api-utils", () => ({
      createAuthError: () => ({
        status: 401,
        json: async () => ({ success: false, error: "Unauthorized" }),
      }),
      createSuccessResponse: (data: any, status = 200) => ({
        status,
        json: async () => ({ success: true, data }),
      }),
      handleApiError: (err: any) => ({
        status: 500,
        json: async () => ({ success: false, error: String(err) }),
      }),
      methodNotAllowed: () => ({
        status: 405,
        json: async () => ({ success: false, error: "Method not allowed" }),
      }),
    }));

    jest.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-123" } }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => {
                if (table === "profiles") return { data: mockProfile, error: null };
                // PGRST116 = row not found (expected for new users)
                if (table === "user_surf_preferences") {
                  return { data: null, error: { code: "PGRST116", message: "Row not found" } };
                }
                return { data: null, error: null };
              },
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
            or: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
            count: "exact",
            head: true,
          }),
        }),
        rpc: async () => ({ data: [], error: null }),
      }),
    }));

    jest.doMock("@/actions/session-actions", () => ({
      addFeaturedPhotoToSessions: async (_: any, sessions: any[]) => sessions,
    }));

    jest.resetModules();

    const { GET } = await import("@/app/api/me/profile-page/route");
    const res = await GET({} as any);

    expect(res.status).toBe(200);
    const json = await (res as any).json();

    expect(json.success).toBe(true);
    // Learned preferences should be null when not found
    expect(json.data.preferences.learned).toBeNull();
    // Onboarding preferences should reflect profile values (all null)
    expect(json.data.preferences.onboarding.experience_level).toBeUndefined();
  });
});
