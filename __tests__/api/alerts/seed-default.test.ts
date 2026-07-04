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

function makeReq(): any {
  return { headers: { get: () => null } };
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
});
