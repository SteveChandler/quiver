import type { NextRequest } from "next/server";

const mockRpc = jest.fn();

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

const mockWithAuth = jest.fn(
  (
    handler: (
      request: NextRequest,
      context: {
        user: { id: string; email?: string };
        supabase: unknown;
        params: Record<string, string>;
      },
    ) => Promise<Response>,
  ) =>
    async (
      request: NextRequest & {
        testUser?: { id: string; email?: string };
      },
    ): Promise<Response> => {
      if (!request.testUser) {
        return jsonResponse(
          { success: false, error: "Authentication required" },
          { status: 401 },
        );
      }
      return handler(request, {
        user: request.testUser,
        supabase: {},
        params: {},
      });
    },
);

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth: mockWithAuth,
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({ rpc: mockRpc })),
}));

jest.mock(
  "@/lib/android-tester-roster/keys",
  () => ({
    loadTesterIdentityKey: jest.fn(() => Buffer.from("11".repeat(32), "hex")),
  }),
  { virtual: true },
);

function request(
  body: unknown,
  user: { id: string; email?: string } | null = {
    id: "10000000-0000-4000-8000-000000000001",
    email: "surfer@example.com",
  },
): NextRequest {
  return {
    testUser: user ?? undefined,
    json: async () => body,
  } as unknown as NextRequest;
}

const VALID_BODY = {
  nativeInstallId: "20000000-0000-4000-8000-000000000002",
  idempotencyKey: "A".repeat(43),
};

describe("POST /api/android-tester-roster/join", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-25T12:00:00.000Z"));
    jest.clearAllMocks();
    mockRpc.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("requires authentication and has no optional bearer bypass", async () => {
    const { POST } = await import("@/app/api/android-tester-roster/join/route");

    const response = await POST(request(VALID_BODY, null));

    expect(response.status).toBe(401);
    expect(mockWithAuth).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects email and unknown fields without touching the roster", async () => {
    const { POST } = await import("@/app/api/android-tester-roster/join/route");

    for (const body of [
      { ...VALID_BODY, email: "surfer@example.com" },
      { ...VALID_BODY, unexpected: true },
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects malformed identifiers", async () => {
    const { POST } = await import("@/app/api/android-tester-roster/join/route");

    for (const body of [
      { ...VALID_BODY, nativeInstallId: "not-a-uuid" },
      { ...VALID_BODY, idempotencyKey: "too-short" },
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns pending_retryable when no complete roster snapshot exists", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ snapshot_complete: false, already_linked: false, candidates: [] }],
      error: null,
    });
    const { POST } = await import("@/app/api/android-tester-roster/join/route");

    const response = await POST(request(VALID_BODY));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({
      outcome: "pending_retryable",
      retryable: true,
    });
  });

  it("returns pending_retryable when the complete snapshot has no exact transient email match", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ snapshot_complete: true, already_linked: false, candidates: [] }],
      error: null,
    });
    const { POST } = await import("@/app/api/android-tester-roster/join/route");

    const response = await POST(request(VALID_BODY));

    await expect(response.json()).resolves.toEqual({
      outcome: "pending_retryable",
      retryable: true,
    });
  });

  it("returns pending_retryable when the authenticated account has no transient email to match", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ snapshot_complete: true, already_linked: false, candidates: [] }],
      error: null,
    });
    const { POST } = await import("@/app/api/android-tester-roster/join/route");

    const response = await POST(
      request(VALID_BODY, {
        id: "10000000-0000-4000-8000-000000000001",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      outcome: "pending_retryable",
      retryable: true,
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("atomically links and redacts an exact eligible match without consulting analytics consent", async () => {
    const {
      encryptTesterIdentity,
    } = await import("@/lib/android-tester-roster/crypto");
    const envelope = encryptTesterIdentity(
      {
        email: "surfer@example.com",
        externalMemberId: "google-member-1",
      },
      Buffer.from("11".repeat(32), "hex"),
      1,
    );
    mockRpc
      .mockResolvedValueOnce({
        data: [
          {
            snapshot_complete: true,
            already_linked: false,
            candidates: [
              {
                entry_id: "30000000-0000-4000-8000-000000000003",
                key_version: 1,
                iv: envelope.iv,
                ciphertext: envelope.ciphertext,
                auth_tag: envelope.authTag,
              },
            ],
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ outcome: "linked" }],
        error: null,
      });
    const { POST } = await import("@/app/api/android-tester-roster/join/route");

    const response = await POST(request(VALID_BODY));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      outcome: "linked",
      retryable: false,
    });
    expect(mockRpc.mock.calls.map(([name]) => name)).toEqual([
      "get_android_tester_roster_join_context",
      "link_android_tester_roster_account",
    ]);
    expect(mockRpc).not.toHaveBeenCalledWith(
      "get_my_analytics_tracking_allowed",
      expect.anything(),
    );
    const linkArgs = mockRpc.mock.calls[1][1];
    expect(linkArgs).toEqual({
      p_entry_id: "30000000-0000-4000-8000-000000000003",
      p_user_id: "10000000-0000-4000-8000-000000000001",
      p_native_install_id: VALID_BODY.nativeInstallId,
      p_idempotency_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(mockRpc.mock.calls)).not.toContain(
      "surfer@example.com",
    );
    expect(JSON.stringify(mockRpc.mock.calls)).not.toContain("google-member-1");
  });

  it("maps same-key idempotent retry to the linked response", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ snapshot_complete: true, already_linked: true, candidates: [] }],
      error: null,
    });
    const { POST } = await import("@/app/api/android-tester-roster/join/route");

    const response = await POST(request(VALID_BODY));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      outcome: "linked",
      retryable: false,
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("maps same-key retry to linked even when the account no longer exposes an email", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ snapshot_complete: true, already_linked: true, candidates: [] }],
      error: null,
    });
    const { POST } = await import("@/app/api/android-tester-roster/join/route");

    const response = await POST(
      request(VALID_BODY, {
        id: "10000000-0000-4000-8000-000000000001",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      outcome: "linked",
      retryable: false,
    });
  });
});
