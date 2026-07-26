import type { NextRequest } from "next/server";

const mockInsert = jest.fn();
const mockAuditInsert = jest.fn();

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
  withBotBlockingAndRateLimit:
    (handler: (request: NextRequest) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request),
  withErrorHandler:
    (handler: (request: NextRequest) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({
    from: (table: string) => {
      if (table === "install_attribution_tokens") {
        return { insert: mockInsert };
      }
      if (table === "install_attribution_audit") {
        return { insert: mockAuditInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  })),
}));

describe("POST /api/install-attribution/issue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-25T12:00:00.000Z"));
    jest.resetModules();
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockAuditInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("issues a 30-day single-use token without storing the raw token", async () => {
    const { POST } = await import("@/app/api/install-attribution/issue/route");
    const response = await POST({
      json: async () => ({
        source: "partner_landing",
        surface: "partner_landing",
        placement: "primary_android",
        campaign: "app_first_v1",
        email: "must-not-survive@example.com",
      }),
    } as NextRequest);
    const body = await response.json();
    const referrer = new URL(body.storeUrl).searchParams.get("referrer");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      success: true,
      storeUrl: expect.stringMatching(
        /^https:\/\/play\.google\.com\/store\/apps\/details\?/,
      ),
      expiresOn: "2026-08-24",
    });
    expect(referrer).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        source: "partner_landing",
        surface: "partner_landing",
        placement: "primary_android",
        campaign: "app_first_v1",
        expires_at: "2026-08-24T12:00:00.000Z",
      }),
    );
    expect(JSON.stringify(mockInsert.mock.calls)).not.toContain(referrer);
    expect(JSON.stringify(mockInsert.mock.calls)).not.toContain(
      "must-not-survive@example.com",
    );
  });

  it("fails closed without exposing a Play token when persistence fails", async () => {
    mockInsert.mockResolvedValue({
      error: { message: "database unavailable" },
    });
    const { POST } = await import("@/app/api/install-attribution/issue/route");
    const response = await POST({
      json: async () => ({
        source: "android_beta_page",
        surface: "android_beta",
        placement: "direct",
        campaign: "app_first_v1",
      }),
    } as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      success: false,
      error: "issuance_unavailable",
    });
    expect(JSON.stringify(body)).not.toMatch(/storeUrl|referrer|token/i);
    expect(mockAuditInsert).not.toHaveBeenCalled();
  });
});
