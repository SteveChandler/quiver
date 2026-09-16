/** @jest-environment node */
import { POST } from "@/app/api/internal/send-welcome-email/route";
import { NextRequest, NextResponse } from "next/server";
const mockRpc = jest.fn();
const mockEnabled = jest.fn();
jest.mock("@/lib/email/lifecycle", () => ({ lifecycleRpc: (...args: unknown[]) => mockRpc(...args), lifecycleEnabled: () => mockEnabled() }));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth: (handler: Function) => (req: Request) => handler(req, { user: { id: "self" } }),
  withRateLimit: (handler: Function) => handler,
  createSuccessResponse: (data: unknown) => NextResponse.json({ success: true, data }),
  createErrorResponse: (_title: string, message: string, status: number) => NextResponse.json({ error: message }, { status }),
}));
it("does no work disabled, enqueues only the authenticated user, and reports storage failure", async () => {
  mockEnabled.mockReturnValue(false);
  expect((await POST(new NextRequest("http://localhost/api/internal/send-welcome-email"))).status).toBe(200);
  expect(mockRpc).not.toHaveBeenCalled();
  mockEnabled.mockReturnValue(true);
  mockRpc.mockResolvedValue({ status: "due" });
  const response = await POST(new NextRequest("http://localhost/api/internal/send-welcome-email"));
  expect(await response.json()).toEqual({ success: true, data: { sent: false, queued: true } });
  expect(mockRpc).toHaveBeenCalledWith("record_email_lifecycle_decision", { p_user_id: "self" });
  mockRpc.mockRejectedValue(new Error("storage failed"));
  expect((await POST(new NextRequest("http://localhost/api/internal/send-welcome-email"))).status).toBe(503);
});
