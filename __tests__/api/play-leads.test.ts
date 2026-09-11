/** @jest-environment node */

const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockClaimMaybeSingle = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn((table: string) => table === "play_leads"
  ? { upsert: mockUpsert, update: mockUpdate }
  : table === "user_events" ? { insert: mockInsert } : {});

jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn(() => ({ from: mockFrom })) }));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth: (handler: any) => (request: any) => handler(request, { user: null }),
  withBotBlockingAndRateLimit: (handler: any) => handler,
  withErrorHandler: (handler: any) => handler,
}));
jest.mock("@/lib/mailer/play-outside", () => ({ sendPlayOutsideEmail: jest.fn(() => Promise.resolve({ success: true, messageId: "email-1" })) }));
jest.mock("next/server", () => ({ NextResponse: { json: (body: unknown) => ({ json: async () => body }) } }));

function buildRequest(body: unknown): any { return { json: jest.fn().mockResolvedValue(body) }; }
function validLead(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { email: "surfer@example.com", consent: true, breakSlug: "pipeline", breakName: "Pipeline", heatTotal: 15.25, challengeCode: "", sessionId: "00000000-0000-4000-8000-000000000001", ...overrides };
}

describe("POST /api/play/leads", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.PLAY_SMS_ENABLED;
    mockUpsert.mockResolvedValue({ error: null });
    mockClaimMaybeSingle.mockResolvedValue({ data: { email: "surfer@example.com" }, error: null });
    mockUpdate.mockReturnValue({ eq: jest.fn().mockReturnValue({ is: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ maybeSingle: mockClaimMaybeSingle }) }) }) });
    mockInsert.mockResolvedValue({ error: null });
  });

  async function post(body: unknown): Promise<{ json(): Promise<unknown> }> {
    const { POST } = await import("@/app/api/play/leads/route");
    return POST(buildRequest(body));
  }

  it("rejects invalid email", async () => {
    await expect((await post(validLead({ email: "nope" }))).json()).resolves.toEqual({ success: false, error: "invalid_email" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("requires consent", async () => {
    await expect((await post(validLead({ consent: false }))).json()).resolves.toEqual({ success: false, error: "consent_required" });
  });

  it("rejects phone-only leads when SMS is off", async () => {
    await expect((await post(validLead({ email: undefined, phone: "8315550123" }))).json()).resolves.toEqual({ success: false, error: "sms_unavailable" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("accepts phone-only leads when SMS is on without sending email", async () => {
    process.env.PLAY_SMS_ENABLED = "true";
    await expect((await post(validLead({ email: undefined, phone: "8315550123" }))).json()).resolves.toEqual({ success: true, emailSent: false });
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ phone: "+18315550123" }), { onConflict: "phone" });
  });

  it("upserts duplicate email leads", async () => {
    await expect((await post(validLead())).json()).resolves.toEqual({ success: true, emailSent: true });
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ email: "surfer@example.com" }), { onConflict: "email" });
    expect(mockUpdate).toHaveBeenCalledWith({ forecast_email_sent_at: expect.any(String) });
  });

  it("stores optional home break and surf frequency", async () => {
    await expect((await post(validLead({ homeBreak: "  Pleasure Point  ", surfFrequency: "weekly" }))).json()).resolves.toEqual({ success: true, emailSent: true });
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ home_break: "Pleasure Point", surf_frequency: "weekly" }), { onConflict: "email" });
  });

  it("rejects an unsupported surf frequency", async () => {
    await expect((await post(validLead({ surfFrequency: "daily" }))).json()).resolves.toEqual({ success: false, error: "invalid_input" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns success when email sending fails", async () => {
    const { sendPlayOutsideEmail } = await import("@/lib/mailer/play-outside");
    (sendPlayOutsideEmail as jest.Mock).mockResolvedValueOnce({ success: false, error: new Error("down") });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect((await post(validLead())).json()).resolves.toEqual({ success: true, emailSent: false });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
