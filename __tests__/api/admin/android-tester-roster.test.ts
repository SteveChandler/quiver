import type { NextRequest } from "next/server";

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSyncRoster = jest.fn();

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    },
  });
}

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => jsonResponse(body, init),
  },
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAdminAuth:
    (
      handler: (
        request: NextRequest,
        context: {
          user: { id: string };
          supabase: { rpc: typeof mockRpc; from: typeof mockFrom };
          params: Record<string, string>;
        },
      ) => Promise<Response>,
    ) =>
    async (
      request: NextRequest & { testRole?: "admin" | "user" },
      context?: { params?: Record<string, string> },
    ): Promise<Response> => {
      if (!request.testRole) {
        return jsonResponse({ error: "Authentication required" }, { status: 401 });
      }
      if (request.testRole !== "admin") {
        return jsonResponse({ error: "Admin access required" }, { status: 403 });
      }
      return handler(request, {
        user: { id: "10000000-0000-4000-8000-000000000001" },
        supabase: { rpc: mockRpc, from: mockFrom },
        params: context?.params ?? {},
      });
    },
}));

jest.mock("@/lib/android-tester-roster/keys", () => ({
  loadTesterIdentityKey: jest.fn(() => Buffer.from("11".repeat(32), "hex")),
}));

jest.mock("@/lib/android-tester-roster/canonical-sync", () => ({
  syncCanonicalAndroidTesterRoster: mockSyncRoster,
}));

function request(
  body?: unknown,
  role?: "admin" | "user",
): NextRequest {
  return {
    testRole: role,
    json: async () => body,
  } as unknown as NextRequest;
}

describe("admin Android tester roster APIs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockSyncRoster.mockReset();
  });

  it("returns 401/403 before aggregate roster access", async () => {
    const { GET } = await import(
      "@/app/api/admin/android-tester-roster/route"
    );

    expect((await GET(request())).status).toBe(401);
    expect((await GET(request(undefined, "user"))).status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails closed when mandatory summary-read audit cannot be recorded", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "audit unavailable" },
    });
    const { GET } = await import(
      "@/app/api/admin/android-tester-roster/route"
    );

    const response = await GET(request(undefined, "admin"));

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mockRpc).toHaveBeenCalledWith(
      "record_android_tester_roster_audit",
      expect.objectContaining({
        p_action: "read_summary",
        p_outcome: "attempted",
      }),
    );
    expect(mockRpc).not.toHaveBeenCalledWith(
      "get_android_tester_roster_summary",
      expect.anything(),
    );
  });

  it("returns only aggregate summary after a successful audit", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({
        data: {
          eligible: 8,
          ineligible: 2,
          linkedAccounts: 3,
          unjoinedIdentities: 7,
          purgeScheduled: 2,
        },
        error: null,
      });
    const { GET } = await import(
      "@/app/api/admin/android-tester-roster/route"
    );

    const response = await GET(request(undefined, "admin"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      summary: {
        eligible: 8,
        ineligible: 2,
        linkedAccounts: 3,
        unjoinedIdentities: 7,
        purgeScheduled: 2,
      },
    });
    expect(JSON.stringify(body)).not.toMatch(
      /email|member.?id|ciphertext|auth.?tag/i,
    );
  });

  it("never reveals identity when reveal audit fails", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "audit unavailable" },
    });
    const { GET } = await import(
      "@/app/api/admin/android-tester-roster/identity/[entryId]/route"
    );

    const response = await GET(request(undefined, "admin"), {
      params: {
        entryId: "20000000-0000-4000-8000-000000000002",
      },
    });

    expect(response.status).toBe(503);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("exports non-PII rows only after mandatory audit", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            entry_id: "20000000-0000-4000-8000-000000000002",
            eligibility_status: "eligible",
            linked: false,
            stage: "group_eligibility",
          },
        ],
        error: null,
      });
    const { GET } = await import(
      "@/app/api/admin/android-tester-roster/export/route"
    );

    const response = await GET(request(undefined, "admin"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(
      /email|member.?id|ciphertext|auth.?tag/i,
    );
  });

  it("records explicit manual Play evidence without inferring another stage", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: 44, error: null });
    const { POST } = await import(
      "@/app/api/admin/android-tester-roster/play-evidence/route"
    );

    const response = await POST(
      request(
        {
          entryId: "20000000-0000-4000-8000-000000000002",
          status: "observed",
          observedAt: "2026-07-25T12:00:00.000Z",
          evidenceCode: "play_console_membership_review",
          evidenceReferenceId: "40000000-0000-4000-8000-000000000004",
        },
        "admin",
      ),
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenLastCalledWith(
      "record_android_tester_roster_stage",
      {
        p_actor_user_id: "10000000-0000-4000-8000-000000000001",
        p_entry_id: "20000000-0000-4000-8000-000000000002",
        p_stage: "play_opt_in",
        p_status: "observed",
        p_source: "manual_google_play_console",
        p_observed_at: "2026-07-25T12:00:00.000Z",
        p_confidence: "manual",
        p_evidence: {
          code: "play_console_membership_review",
          referenceId: "40000000-0000-4000-8000-000000000004",
        },
      },
    );
    expect(JSON.stringify(mockRpc.mock.calls)).not.toMatch(
      /first_open|account_join|install["']/i,
    );
  });

  it.each([
    {
      evidenceReference:
        "google-member-id-or-hash-that-must-never-be-retained",
    },
    {
      evidenceCode: "unknown_evidence_code",
      evidenceReferenceId: "40000000-0000-4000-8000-000000000004",
    },
    {
      evidenceCode: "play_console_membership_review",
      evidenceReferenceId: "google-member-id-or-hash",
    },
  ])("rejects raw or unbounded manual Play evidence: %p", async (evidence) => {
    const { POST } = await import(
      "@/app/api/admin/android-tester-roster/play-evidence/route"
    );

    const response = await POST(
      request(
        {
          entryId: "20000000-0000-4000-8000-000000000002",
          status: "observed",
          observedAt: "2026-07-25T12:00:00.000Z",
          ...evidence,
        },
        "admin",
      ),
    );

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails closed before manual sync when the mandatory change audit fails", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "audit unavailable" },
    });
    const { POST } = await import(
      "@/app/api/admin/android-tester-roster/sync/route"
    );

    const response = await POST(request({}, "admin"));

    expect(response.status).toBe(503);
    expect(mockSyncRoster).not.toHaveBeenCalled();
  });

  it("runs manual sync only after audit and returns non-PII counts", async () => {
    mockRpc.mockResolvedValueOnce({ data: 1, error: null });
    mockSyncRoster.mockResolvedValue({
      complete: true,
      addedCount: 2,
      rejoinedCount: 1,
      leftCount: 1,
      purgedCount: 0,
    });
    const { POST } = await import(
      "@/app/api/admin/android-tester-roster/sync/route"
    );

    const response = await POST(request({}, "admin"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSyncRoster).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "10000000-0000-4000-8000-000000000001",
      }),
    );
    expect(body).toEqual({
      result: {
        complete: true,
        addedCount: 2,
        rejoinedCount: 1,
        leftCount: 1,
        purgedCount: 0,
      },
    });
    expect(JSON.stringify(body)).not.toMatch(
      /email|member.?id|ciphertext|auth.?tag/i,
    );
  });
});
