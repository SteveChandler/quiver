jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { jest } from "@jest/globals";

const transition = jest.fn<
  (command: unknown, store: unknown) => Promise<unknown>
>();
const getControl = jest.fn<() => Promise<unknown>>();

jest.mock("@/lib/auth/admin", () => ({ authenticateAdmin: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({ rpc: jest.fn() })),
}));
jest.mock("@/lib/alerts/swell-watch/safety-control", () => ({
  createSupabaseSwellWatchSafetyStore: jest.fn(() => ({ getControl, transition })),
  executeSwellWatchControlCommand: (command: unknown, store: unknown) => transition(command, store),
}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

function request(body?: unknown, headers: Record<string, string> = {}) {
  const normalized = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    json: async () => body,
    headers: { get: (name: string) => normalized.get(name.toLowerCase()) ?? null },
  } as never;
}

describe("/api/admin/swell-watch-control", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    getControl.mockResolvedValue({ state: "held", epoch: 4, reasonCode: "provider_failure_rate" });
    transition.mockResolvedValue({ state: "held", epoch: 5, reasonCode: "provider_failure_rate" });
  });

  it("uses admin auth and no-store before all control reads", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    jest.mocked(authenticateAdmin).mockResolvedValue({ success: false, status: 403, error: "no" });
    const { GET } = await import("@/app/api/admin/swell-watch-control/route");
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getControl).not.toHaveBeenCalled();
  });

  it("requires a bounded command, expected epoch, and idempotency key before transition", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    jest.mocked(authenticateAdmin).mockResolvedValue({ success: true, user: { id: ADMIN_ID } as never });
    const { POST } = await import("@/app/api/admin/swell-watch-control/route");
    const response = await POST(request({ operation: "arm", expectedEpoch: 4, reasonCode: "operator_review" }));
    expect(response.status).toBe(400);
    expect(transition).not.toHaveBeenCalled();
  });

  it("passes only authenticated actor, expected epoch, reason, and idempotency to the append-only command", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    jest.mocked(authenticateAdmin).mockResolvedValue({ success: true, user: { id: ADMIN_ID } as never });
    const { POST } = await import("@/app/api/admin/swell-watch-control/route");
    const response = await POST(request(
      { operation: "hold", expectedEpoch: 4, reasonCode: "operator_hold" },
      { "Idempotency-Key": "swell-watch-control-1" },
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "hold", expectedEpoch: 4, reasonCode: "operator_hold", operatorUserId: ADMIN_ID,
      }),
      expect.anything(),
    );
  });
});
