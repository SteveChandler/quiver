import type { NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const mockRpc = jest.fn();
const mockAuditInsert = jest.fn();
const mockRateLimitResponse: { current: Response | null } = { current: null };

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...Object.fromEntries(new Headers(init?.headers).entries()),
        },
      }),
  },
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withRateLimit:
    (handler: (request: NextRequest) => Promise<Response>) =>
    (request: NextRequest) =>
      mockRateLimitResponse.current ?? handler(request),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({
    rpc: mockRpc,
    from: () => ({ insert: mockAuditInsert }),
  })),
}));

const TOKEN = "A".repeat(43);
const REDEMPTION_ID = "B".repeat(43);
const HANDOFF_ID = "550e8400-e29b-41d4-a716-446655440000";
const HANDOFF_CONTEXT = {
  v: 1,
  beachId: "123e4567-e89b-12d3-a456-426614174000",
  slug: "ocean-beach",
  windowId: "2026-07-25T13:00:00.000Z",
  sourceSurface: "surf_comparison",
  generatedAt: "2026-07-25T12:00:00.000Z",
  expiresAt: "2026-07-25T12:30:00.000Z",
  priorRecommendation: {
    recommendationId:
      "beach:123e4567-e89b-12d3-a456-426614174000:2026-07-25T13:00:00.000Z",
    mode: "best",
    verdict: "go",
  },
};

function request(body: Record<string, unknown>): NextRequest {
  return {
    headers: new Headers({ Authorization: "Bearer native-user-jwt" }),
    json: async () => body,
  } as NextRequest;
}

describe("POST /api/install-attribution/redeem", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockRateLimitResponse.current = null;
    process.env.INSTALL_ATTRIBUTION_REDEMPTION_ENABLED = "true";
    mockAuditInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    delete process.env.INSTALL_ATTRIBUTION_REDEMPTION_ENABLED;
  });

  it("defaults redemption off without resolving or consuming the token", async () => {
    delete process.env.INSTALL_ATTRIBUTION_REDEMPTION_ENABLED;
    const { POST } = await import("@/app/api/install-attribution/redeem/route");
    const response = await POST(
      request({ token: TOKEN, redemptionId: REDEMPTION_ID }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      outcome: "unattributed_retryable",
      retryable: true,
      attribution: null,
    });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockAuditInsert).not.toHaveBeenCalled();
  });

  it("returns bounded attribution for the first consume or same-key retry", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          source: "landing-navbar",
          surface: "landing-page",
          placement: "navbar_primary",
          campaign: "app_first_v1",
          created_at: "2026-07-25T12:00:00.000Z",
          expires_at: "2026-08-24T12:00:00.000Z",
          handoff_id: HANDOFF_ID,
          handoff_context: HANDOFF_CONTEXT,
        },
      ],
      error: null,
    });
    const { POST } = await import("@/app/api/install-attribution/redeem/route");
    const response = await POST(
      request({ token: TOKEN, redemptionId: REDEMPTION_ID }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      outcome: "attributed",
      retryable: false,
      attribution: {
        source: "landing-navbar",
        surface: "landing-page",
        placement: "navbar_primary",
        campaign: "app_first_v1",
        createdOn: "2026-07-25",
        expiresOn: "2026-08-24",
        handoffId: HANDOFF_ID,
        handoffContext: HANDOFF_CONTEXT,
      },
    });
    expect(mockRpc).toHaveBeenCalledWith("redeem_install_attribution_token", {
      p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_redemption_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(mockRpc.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(mockRpc.mock.calls)).not.toContain(REDEMPTION_ID);
  });

  it.each([
    ["malformed", { token: "bad", redemptionId: REDEMPTION_ID }],
    [
      "unknown, expired, or replayed",
      { token: TOKEN, redemptionId: REDEMPTION_ID },
    ],
  ])(
    "fails closed for %s input without blocking launch",
    async (_name, body) => {
      mockRpc.mockResolvedValue({ data: [], error: null });
      const { POST } =
        await import("@/app/api/install-attribution/redeem/route");
      const response = await POST(request(body));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        outcome: "unattributed_terminal",
        retryable: false,
        attribution: null,
      });
    },
  );

  it("returns a retryable unattributed outcome when resolution fails", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "db unavailable" },
    });
    const { POST } = await import("@/app/api/install-attribution/redeem/route");
    const response = await POST(
      request({ token: TOKEN, redemptionId: REDEMPTION_ID }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      outcome: "unattributed_retryable",
      retryable: true,
      attribution: null,
    });
    expect(warn).toHaveBeenCalledWith(
      "install-attribution redemption unavailable",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(REDEMPTION_ID);
    warn.mockRestore();
  });

  it("converts rate-limiter infrastructure failure to a retryable launch-safe outcome", async () => {
    mockRateLimitResponse.current = new Response(
      JSON.stringify({ error: "Service temporarily unavailable" }),
      { status: 503 },
    );
    const { POST } = await import("@/app/api/install-attribution/redeem/route");
    const response = await POST(
      request({ token: TOKEN, redemptionId: REDEMPTION_ID }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      outcome: "unattributed_retryable",
      retryable: true,
      attribution: null,
    });
  });

  it("preserves the rate limiter's explicit 429 response", async () => {
    mockRateLimitResponse.current = new Response(null, { status: 429 });
    const { POST } = await import("@/app/api/install-attribution/redeem/route");
    const response = await POST(
      request({ token: TOKEN, redemptionId: REDEMPTION_ID }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
