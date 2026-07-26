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

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth:
    (
      handler: (
        request: NextRequest,
        context: {
          user: { id: string };
          supabase: unknown;
          params: Record<string, string>;
        },
      ) => Promise<Response>,
    ) =>
    async (
      request: NextRequest & { authenticated?: boolean },
    ): Promise<Response> => {
      if (!request.authenticated) {
        return jsonResponse({ error: "Authentication required" }, { status: 401 });
      }
      return handler(request, {
        user: { id: "10000000-0000-4000-8000-000000000001" },
        supabase: {},
        params: {},
      });
    },
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({ rpc: mockRpc })),
}));

function request(body: unknown, authenticated = true): NextRequest {
  return {
    authenticated,
    json: async () => body,
  } as unknown as NextRequest;
}

const IDENTIFIERS = {
  nativeInstallId: "20000000-0000-4000-8000-000000000002",
  idempotencyKey: "B".repeat(43),
};

describe("Android tester independent operational evidence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-25T12:00:00.000Z"));
    jest.clearAllMocks();
    mockRpc.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("records first open independently and maps same-key replay to observed", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ outcome: "same_key_retry" }],
      error: null,
    });
    const { POST } = await import(
      "@/app/api/android-tester-roster/first-open/route"
    );

    const response = await POST(request(IDENTIFIERS));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({
      outcome: "observed",
      retryable: false,
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "record_android_tester_roster_first_open",
      {
        p_user_id: "10000000-0000-4000-8000-000000000001",
        p_native_install_id: IDENTIFIERS.nativeInstallId,
        p_idempotency_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    );
  });

  it("keeps first open retryable until account join is linked", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ outcome: "pending_retryable" }],
      error: null,
    });
    const { POST } = await import(
      "@/app/api/android-tester-roster/first-open/route"
    );

    const response = await POST(request(IDENTIFIERS));

    await expect(response.json()).resolves.toEqual({
      outcome: "pending_retryable",
      retryable: true,
    });
  });

  it("records bounded install evidence independently from account join", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ outcome: "observed" }],
      error: null,
    });
    const { POST } = await import(
      "@/app/api/android-tester-roster/install/route"
    );
    const body = {
      ...IDENTIFIERS,
      attribution: {
        source: "android_beta_page",
        surface: "android_beta",
        placement: "direct",
        campaign: "app_first_v1",
        createdOn: "2026-07-25",
        expiresOn: "2026-08-24",
      },
    };

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      outcome: "observed",
      retryable: false,
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "record_android_tester_roster_install",
      {
        p_user_id: "10000000-0000-4000-8000-000000000001",
        p_native_install_id: IDENTIFIERS.nativeInstallId,
        p_idempotency_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_source: "android_beta_page",
        p_surface: "android_beta",
        p_placement: "direct",
        p_campaign: "app_first_v1",
        p_created_on: "2026-07-25",
        p_expires_on: "2026-08-24",
      },
    );
  });

  it.each([
    { route: "first-open", body: { ...IDENTIFIERS, email: "pii@example.com" } },
    {
      route: "install",
      body: {
        ...IDENTIFIERS,
        attribution: {
          source: "android_beta_page",
          surface: "android_beta",
          placement: "direct",
          campaign: "app_first_v1",
          createdOn: "2026-06-31",
          expiresOn: "2026-07-30",
        },
      },
    },
  ])("rejects invalid $route evidence without an RPC", async ({ route, body }) => {
    const { POST } =
      route === "first-open"
        ? await import("@/app/api/android-tester-roster/first-open/route")
        : await import("@/app/api/android-tester-roster/install/route");

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("requires authentication for both independent evidence routes", async () => {
    const firstOpen = await import(
      "@/app/api/android-tester-roster/first-open/route"
    );
    const install = await import(
      "@/app/api/android-tester-roster/install/route"
    );

    expect((await firstOpen.POST(request(IDENTIFIERS, false))).status).toBe(401);
    expect(
      (
        await install.POST(
          request(
            {
              ...IDENTIFIERS,
              attribution: {
                source: "android_beta_page",
                surface: "android_beta",
                placement: "direct",
                campaign: "app_first_v1",
                createdOn: "2026-07-25",
                expiresOn: "2026-08-24",
              },
            },
            false,
          ),
        )
      ).status,
    ).toBe(401);
  });
});
