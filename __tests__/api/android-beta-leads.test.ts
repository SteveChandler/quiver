const mockUpsert = jest.fn();
const mockFrom = jest.fn((table: string) => {
  if (table === "android_beta_leads") {
    return {
      upsert: mockUpsert,
    };
  }

  return {};
});

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withBotBlockingAndRateLimit: (handler: any) => handler,
  withErrorHandler: (handler: any) => handler,
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown) => ({
      json: async () => body,
    }),
  },
}));

function buildRequest(body: unknown): any {
  return {
    json: jest.fn().mockResolvedValue(body),
  };
}

describe("POST /api/android-beta/leads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("normalizes and stores a new Android beta lead", async () => {
    const { POST } = await import("@/app/api/android-beta/leads/route");

    const response = await POST(
      buildRequest({
        email: "  SURFER@example.COM  ",
        source: "features-hero-android-waitlist",
        surface: "features-page",
        placement: "hero_secondary",
      }),
    );

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledWith("android_beta_leads");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        email: "surfer@example.com",
        source: "features-hero-android-waitlist",
        surface: "features-page",
        placement: "hero_secondary",
      },
      { onConflict: "email" },
    );
  });

  it("rejects malformed email without writing", async () => {
    const { POST } = await import("@/app/api/android-beta/leads/route");

    const response = await POST(
      buildRequest({
        email: "not-an-email",
        source: "features-hero-android-waitlist",
        surface: "features-page",
        placement: "hero_secondary",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_email",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
