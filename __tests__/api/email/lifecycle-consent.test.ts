/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({ from: mockFrom })),
}));
jest.mock("@/lib/email/lifecycle", () => ({ lifecycleRpc: jest.fn() }));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withRateLimit: (handler: unknown) => handler,
  withAuth:
    (handler: (...args: unknown[]) => unknown) =>
    (request: unknown) =>
      handler(request, { user: { id: USER_ID }, supabase: {} }),
}));

async function getConsent(): Promise<Response> {
  const { GET } = await import("@/app/api/email/lifecycle/consent/route");
  return GET(new NextRequest("https://example.com/api/email/lifecycle/consent"));
}

describe("GET /api/email/lifecycle/consent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports the signed-in user's saved opt-in", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { lifecycle_consent_at: "2026-09-12T00:00:00Z" }, error: null });
    const response = await getConsent();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ consent: true, contract_version: 1 });
    expect(mockFrom).toHaveBeenCalledWith("email_contact_state");
    expect(mockEq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  it("reports off when there is no saved choice or it was withdrawn", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect((await getConsent()).json()).resolves.toEqual({ consent: false, contract_version: 1 });
    mockMaybeSingle.mockResolvedValueOnce({ data: { lifecycle_consent_at: null }, error: null });
    await expect((await getConsent()).json()).resolves.toEqual({ consent: false, contract_version: 1 });
  });

  it("fails with a real error status when the preference cannot be read", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await getConsent()).status).toBe(503);
  });
});
