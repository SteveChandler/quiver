export {};

const mockUpsert = jest.fn();
const mockLeadSelect = jest.fn();
const mockLeadMaybeSingle = jest.fn();
const mockUpdate = jest.fn();
const mockClaimEq = jest.fn();
const mockClaimIs = jest.fn();
const mockClaimSelect = jest.fn();
const mockClaimMaybeSingle = jest.fn();
const mockResetEqEmail = jest.fn();
const mockResetEqClaimedAt = jest.fn();
const mockInsert = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn((table: string) => {
  if (table === "android_beta_leads") {
    return {
      upsert: mockUpsert,
      update: mockUpdate,
    };
  }

  if (table === "user_events") {
    return {
      insert: mockInsert,
    };
  }

  return {};
});

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withBotBlockingAndRateLimit: (handler: any) => handler,
  withErrorHandler: (handler: any) => handler,
}));

jest.mock("@/lib/mailer/android-beta", () => ({
  sendAndroidBetaInstructionsEmail: jest.fn(() =>
    Promise.resolve({ success: true, messageId: "email-1" }),
  ),
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
    mockUpsert.mockReturnValue({ select: mockLeadSelect });
    mockLeadSelect.mockReturnValue({ maybeSingle: mockLeadMaybeSingle });
    mockLeadMaybeSingle.mockResolvedValue({
      data: { id: "30000000-0000-4000-8000-000000000003" },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: "40000000-0000-4000-8000-000000000004",
      error: null,
    });
    mockClaimEq.mockReturnValue({ is: mockClaimIs });
    mockClaimIs.mockReturnValue({ select: mockClaimSelect });
    mockClaimSelect.mockReturnValue({ maybeSingle: mockClaimMaybeSingle });
    mockClaimMaybeSingle.mockResolvedValue({
      data: { email: "surfer@example.com" },
      error: null,
    });
    mockResetEqEmail.mockReturnValue({ eq: mockResetEqClaimedAt });
    mockResetEqClaimedAt.mockResolvedValue({ error: null });
    mockUpdate.mockImplementation(
      (payload: { instructions_sent_at?: string | null }) => {
        if (payload.instructions_sent_at === null) {
          return { eq: mockResetEqEmail };
        }

        return { eq: mockClaimEq };
      },
    );
    mockInsert.mockResolvedValue({ error: null });
  });

  it("normalizes and stores a new Android beta lead", async () => {
    const { sendAndroidBetaInstructionsEmail } =
      await import("@/lib/mailer/android-beta");
    const { POST } = await import("@/app/api/android-beta/leads/route");

    const response = await POST(
      buildRequest({
        email: "  SURFER@example.COM  ",
        source: "features-hero-android-waitlist",
        surface: "features-page",
        placement: "hero_secondary",
        sessionId: "00000000-0000-4000-8000-000000000001",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      success: true,
      emailSent: true,
    });
    expect(mockFrom).toHaveBeenCalledWith("android_beta_leads");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        email: "surfer@example.com",
        source: "features-hero-android-waitlist",
        surface: "features-page",
        placement: "hero_secondary",
        session_id: "00000000-0000-4000-8000-000000000001",
      },
      { onConflict: "email" },
    );
    expect(mockLeadSelect).toHaveBeenCalledWith("id");
    expect(mockLeadMaybeSingle).toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith(
      "resolve_android_waitlist_entry",
      expect.objectContaining({
        p_user_id: null,
        p_normalized_email_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_roster_entry_id: null,
        p_source_kind: "anonymous_lead",
        p_source_id: "30000000-0000-4000-8000-000000000003",
      }),
    );
    expect(sendAndroidBetaInstructionsEmail).toHaveBeenCalledWith(
      "surfer@example.com",
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      instructions_sent_at: expect.any(String),
    });
    expect(mockClaimEq).toHaveBeenCalledWith("email", "surfer@example.com");
    expect(mockClaimIs).toHaveBeenCalledWith("instructions_sent_at", null);
    expect(mockClaimSelect).toHaveBeenCalledWith("email");
    expect(mockFrom).toHaveBeenCalledWith("user_events");
    expect(mockInsert).toHaveBeenCalledWith({
      session_id: "00000000-0000-4000-8000-000000000001",
      event_type: "android_lead_captured",
      metadata: {
        cta_family: "android_waitlist",
        platform: "android",
        destination_type: "lead_capture",
        destination_status: "email_captured",
        email_domain: "example.com",
        source: "features-hero-android-waitlist",
        surface: "features-page",
        placement: "hero_secondary",
      },
    });
  });

  it("skips duplicate instruction emails after a lead was already sent", async () => {
    mockClaimMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    const { sendAndroidBetaInstructionsEmail } =
      await import("@/lib/mailer/android-beta");
    const { POST } = await import("@/app/api/android-beta/leads/route");

    const response = await POST(
      buildRequest({
        email: "surfer@example.com",
        source: "features-hero-android-waitlist",
        surface: "features-page",
        placement: "hero_secondary",
      }),
    );

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        email: "surfer@example.com",
        source: "features-hero-android-waitlist",
        surface: "features-page",
        placement: "hero_secondary",
      },
      { onConflict: "email" },
    );
    await expect(response.json()).resolves.toEqual({
      success: true,
      emailSent: false,
    });
    expect(sendAndroidBetaInstructionsEmail).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      instructions_sent_at: expect.any(String),
    });
    expect(mockClaimIs).toHaveBeenCalledWith("instructions_sent_at", null);
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

  it("fails closed before sending instructions when canonical resolution fails", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "resolver unavailable" },
    });
    const { sendAndroidBetaInstructionsEmail } =
      await import("@/lib/mailer/android-beta");
    const { POST } = await import("@/app/api/android-beta/leads/route");

    const response = await POST(
      buildRequest({
        email: "surfer@example.com",
        source: "features-hero-android-waitlist",
        surface: "features-page",
        placement: "hero_secondary",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "save_failed",
    });
    expect(sendAndroidBetaInstructionsEmail).not.toHaveBeenCalled();
  });
});
