/** @jest-environment node */

// NextResponse.json relies on the static Response.json() helper (available in newer runtimes).
// Jest's jsdom environment may not provide it, so we polyfill it for route handler tests.
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

import { GET } from "@/app/api/cron/cleanup-pending-alert-captures/route";

jest.mock("@/lib/api-utils", () => ({
  validateCronRequest: jest.fn(() => true),
}));

const mockChain: {
  delete: jest.Mock;
  lt: jest.Mock;
  is: jest.Mock;
} = {
  delete: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  is: jest.fn().mockResolvedValue({ count: 5, error: null }),
};
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({
    from: jest.fn(() => mockChain),
  })),
}));

describe("cleanup-pending-alert-captures cron", () => {
  beforeEach(() => {
    mockChain.delete.mockClear();
    mockChain.lt.mockClear();
    mockChain.is.mockClear();
  });

  it("deletes expired unconsumed captures and returns count", async () => {
    const req = new Request("http://localhost/api/cron/cleanup-pending-alert-captures");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 5 });
    expect(mockChain.delete).toHaveBeenCalledWith({ count: "exact" });
    expect(mockChain.lt).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(mockChain.is).toHaveBeenCalledWith("consumed_at", null);
  });
});
