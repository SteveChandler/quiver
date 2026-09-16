/** @jest-environment node */
import { GET, POST } from "@/app/api/email/lifecycle/unsubscribe/route";
const mockRpc = jest.fn();
jest.mock("@/lib/email/lifecycle", () => ({ lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
jest.mock("@/lib/alerts/email-token", () => ({ verifyEmailUnsubscribeToken: (_id: string, token: string) => token === "valid" }));
const id = "11111111-1111-4111-8111-111111111111";
const request = (token: string) => new Request(`http://localhost/api/email/lifecycle/unsubscribe?user_id=${id}&token=${token}`);
beforeEach(() => { jest.clearAllMocks(); mockRpc.mockResolvedValue(null); });
it("GET renders confirmation without changing preferences", async () => {
  const response = await GET(request("valid")); expect(response.status).toBe(200);
  expect(await response.text()).toContain('method="post"'); expect(mockRpc).not.toHaveBeenCalled();
});
it("POST accepts the signed one-click link without a session or extra action", async () => {
  expect((await POST(request("valid"))).status).toBe(200);
  expect(mockRpc).toHaveBeenCalledWith("unsubscribe_email_lifecycle", { p_user_id: id });
});
it("invalid tokens never write, and storage failures remain retryable", async () => {
  expect((await POST(request("invalid"))).status).toBe(400); expect(mockRpc).not.toHaveBeenCalled();
  mockRpc.mockRejectedValue(new Error("failed")); expect((await POST(request("valid"))).status).toBe(503);
});
