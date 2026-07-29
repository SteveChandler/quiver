/** @jest-environment node */

// NextResponse.json relies on Response.json() which jsdom doesn't ship.
if (typeof (globalThis as any).Response?.json !== "function") {
  (globalThis as any).Response.json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
}

/**
 * Unit tests for POST /api/alerts/seed-default.
 *
 * The route is thin: profile lookup → optional 400 → delegate to
 * seedDefaultRulesForUser. We mock `withAuth` to inject a fake user/supabase
 * and mock `seedDefaultRulesForUser` to verify the route forwards the right
 * args and surfaces the right responses.
 */

const mockUser = { id: "user-1" };

type ProfileRow = {
  home_beach_id: string | null;
  experience_level: string | null;
  notif_email_enabled: boolean | null;
  notif_push_enabled: boolean | null;
};

let mockProfileResult: {
  data: ProfileRow | null;
  error: { message: string } | null;
} = {
  data: {
    home_beach_id: "beach-123",
    experience_level: "beginner",
    notif_email_enabled: true,
    notif_push_enabled: false,
  },
  error: null,
};

let mockPrefsResult: {
  data: { pref_time_bucket: string | null } | null;
  error: { message: string } | null;
} = {
  data: { pref_time_bucket: "dawn_patrol" },
  error: null,
};

let mockBeachLookupResult: {
  data: { id: string } | null;
  error: { message: string } | null;
} = {
  data: { id: "beach-999" },
  error: null,
};

const seedSpy = jest.fn();

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: any) => (request: any) => {
      const supabase = {
        from: (table: string) => ({
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              single: () => Promise.resolve(mockProfileResult),
              maybeSingle: () =>
                Promise.resolve(
                  table === "user_email_prefs"
                    ? mockPrefsResult
                    : table === "beaches"
                      ? mockBeachLookupResult
                      : mockProfileResult
                ),
            }),
          }),
        }),
      };
      return handler(request, { user: mockUser, supabase, params: {} });
    },
  };
});

jest.mock("@/lib/alerts/seed-default-rule", () => ({
  seedDefaultRulesForUser: (...args: unknown[]) => seedSpy(...args),
}));

import { POST } from "@/app/api/alerts/seed-default/route";

function makeReq(body?: unknown, rawBody?: string): any {
  return {
    headers: { get: () => null },
    text: () =>
      Promise.resolve(
        rawBody ?? (body === undefined ? "" : JSON.stringify(body)),
      ),
  };
}

beforeEach(() => {
  seedSpy.mockReset();
  mockProfileResult = {
    data: {
      home_beach_id: "beach-123",
      experience_level: "beginner",
      notif_email_enabled: true,
      notif_push_enabled: false,
    },
    error: null,
  };
  mockPrefsResult = {
    data: { pref_time_bucket: "dawn_patrol" },
    error: null,
  };
  mockBeachLookupResult = {
    data: { id: "beach-999" },
    error: null,
  };
});

describe("POST /api/alerts/seed-default", () => {
  it("returns 400 when home_beach_id is missing", async () => {
    mockProfileResult = {
      data: {
        home_beach_id: null,
        experience_level: null,
        notif_email_enabled: true,
        notif_push_enabled: false,
      },
      error: null,
    };

    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      error: "home_beach_id_required",
    });
    expect(seedSpy).not.toHaveBeenCalled();
  });

  it("forwards beach, experience, and preferred time to seedDefaultRulesForUser", async () => {
    seedSpy.mockResolvedValueOnce({
      seeded: true,
      rules: [
        { ruleId: "rule-abc", presetType: "mellow_session" },
        { ruleId: "rule-def", presetType: "dawn_patrol" },
      ],
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      data: {
        seeded: true,
        rules: [
          { ruleId: "rule-abc", presetType: "mellow_session" },
          { ruleId: "rule-def", presetType: "dawn_patrol" },
        ],
      },
    });

    expect(seedSpy).toHaveBeenCalledTimes(1);
    expect(seedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        beachId: "beach-123",
        experienceLevel: "beginner",
        preferredTimeBucket: "dawn_patrol",
        notifyEmail: true,
        notifyPush: false,
      })
    );
  });

  it("forwards profile notif flags to seedDefaultRulesForUser (push opted in)", async () => {
    mockProfileResult = {
      data: {
        home_beach_id: "beach-123",
        experience_level: "beginner",
        notif_email_enabled: false,
        notif_push_enabled: true,
      },
      error: null,
    };
    seedSpy.mockResolvedValueOnce({
      seeded: true,
      rules: [{ ruleId: "rule-abc", presetType: "mellow_session" }],
    });

    await POST(makeReq());

    expect(seedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ notifyEmail: false, notifyPush: true })
    );
  });

  it("falls back to email=true / push=false when profile flags are null", async () => {
    mockProfileResult = {
      data: {
        home_beach_id: "beach-123",
        experience_level: "beginner",
        notif_email_enabled: null,
        notif_push_enabled: null,
      },
      error: null,
    };
    seedSpy.mockResolvedValueOnce({
      seeded: true,
      rules: [{ ruleId: "rule-abc", presetType: "mellow_session" }],
    });

    await POST(makeReq());

    expect(seedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ notifyEmail: true, notifyPush: false })
    );
  });

  it("passes null experience_level through (mellow_session fallback lives in seedDefaultRulesForUser)", async () => {
    mockProfileResult = {
      data: {
        home_beach_id: "beach-123",
        experience_level: null,
        notif_email_enabled: true,
        notif_push_enabled: false,
      },
      error: null,
    };
    seedSpy.mockResolvedValueOnce({
      seeded: true,
      rules: [{ ruleId: "rule-xyz", presetType: "mellow_session" }],
    });

    await POST(makeReq());

    expect(seedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ experienceLevel: null })
    );
  });

  it("passes null preferredTimeBucket when user_email_prefs is absent", async () => {
    mockPrefsResult = { data: null, error: null };
    seedSpy.mockResolvedValueOnce({
      seeded: true,
      rules: [{ ruleId: "rule-abc", presetType: "mellow_session" }],
    });

    await POST(makeReq());

    expect(seedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ preferredTimeBucket: null })
    );
  });

  it("returns 200 with already_has_rules on a re-seed", async () => {
    seedSpy.mockResolvedValueOnce({
      seeded: false,
      reason: "already_has_rules",
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      data: { seeded: false, reason: "already_has_rules" },
    });
  });

  describe("target beach override", () => {
    it("with no body, seeds on the home beach and marks isHomeBeach true", async () => {
      seedSpy.mockResolvedValueOnce({
        seeded: true,
        rules: [{ ruleId: "rule-abc", presetType: "mellow_session" }],
      });

      await POST(makeReq());

      expect(seedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ beachId: "beach-123", isHomeBeach: true })
      );
    });

    it("returns a validation error for a JSON null body and does not seed", async () => {
      const res = await POST(makeReq(null));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: "invalid_request_body",
      });
      expect(seedSpy).not.toHaveBeenCalled();
    });

    it("returns a validation error for malformed non-empty JSON and does not seed", async () => {
      const res = await POST(makeReq(undefined, "{"));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: "invalid_request_body",
      });
      expect(seedSpy).not.toHaveBeenCalled();
    });

    it("with an explicit beach_id that differs from home, seeds on that beach and marks isHomeBeach false", async () => {
      const targetId = "22222222-2222-4222-8222-222222222222";
      mockBeachLookupResult = { data: { id: targetId }, error: null };
      seedSpy.mockResolvedValueOnce({
        seeded: true,
        rules: [{ ruleId: "rule-abc", presetType: "mellow_session" }],
      });

      const res = await POST(makeReq({ beach_id: targetId }));

      expect(res.status).toBe(200);
      expect(seedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ beachId: targetId, isHomeBeach: false })
      );
    });

    it("with an explicit beach_id equal to home, seeds on the home beach and marks isHomeBeach true", async () => {
      const homeId = "11111111-1111-4111-8111-111111111111";
      mockProfileResult = {
        data: {
          home_beach_id: homeId,
          experience_level: "beginner",
          notif_email_enabled: true,
          notif_push_enabled: false,
        },
        error: null,
      };
      mockBeachLookupResult = { data: { id: homeId }, error: null };
      seedSpy.mockResolvedValueOnce({
        seeded: true,
        rules: [{ ruleId: "rule-abc", presetType: "mellow_session" }],
      });

      await POST(makeReq({ beach_id: homeId }));

      expect(seedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ beachId: homeId, isHomeBeach: true })
      );
    });

    it("returns the standard validation error for an unknown beach_id and does not seed", async () => {
      mockBeachLookupResult = { data: null, error: null };

      const res = await POST(
        makeReq({ beach_id: "33333333-3333-4333-8333-333333333333" })
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: "beach_not_found",
      });
      expect(seedSpy).not.toHaveBeenCalled();
    });

    it("returns the standard validation error for a malformed beach_id and does not seed", async () => {
      const res = await POST(makeReq({ beach_id: "not-a-uuid" }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: "beach_not_found",
      });
      expect(seedSpy).not.toHaveBeenCalled();
    });

    it("returns the standard validation error for a non-string beach_id and does not seed", async () => {
      const res = await POST(makeReq({ beach_id: 123 }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: "beach_not_found",
      });
      expect(seedSpy).not.toHaveBeenCalled();
    });
  });
});
