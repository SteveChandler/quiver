/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/webhooks/resend/route";
const mockVerify = jest.fn(); const mockRecord = jest.fn();
jest.mock("svix", () => ({ Webhook: jest.fn().mockImplementation(() => ({ verify: (...args: unknown[]) => mockVerify(...args) })) }));
jest.mock("@/lib/email/provider-events", () => ({ recordProviderEvent: (...args: unknown[]) => mockRecord(...args) }));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));
const request = (signed = true) => new NextRequest("http://localhost/api/webhooks/resend", { method: "POST", body: "signed-body", headers: signed ? { "svix-id": "w1", "svix-timestamp": "1", "svix-signature": "signature" } : {} });
beforeEach(() => { jest.clearAllMocks(); process.env.RESEND_WEBHOOK_SECRET = "fake"; mockVerify.mockReturnValue({ type: "email.delivered" }); mockRecord.mockResolvedValue(true); });
it("verifies the raw body before storing anything", async () => {
  expect((await POST(request(false))).status).toBe(400); expect(mockRecord).not.toHaveBeenCalled();
  mockVerify.mockImplementationOnce(() => { throw new Error("signature"); });
  expect((await POST(request())).status).toBe(401); expect(mockRecord).not.toHaveBeenCalled();
  expect((await POST(request())).status).toBe(200);
  expect(mockVerify).toHaveBeenLastCalledWith("signed-body", { "svix-id": "w1", "svix-timestamp": "1", "svix-signature": "signature" });
});
it("returns a retryable error on storage failure even after earlier delivery", async () => {
  mockRecord.mockRejectedValueOnce(new Error("suppression failure"));
  expect((await POST(request())).status).toBe(503);
  expect((await POST(request())).status).toBe(200);
  expect(mockRecord).toHaveBeenCalledTimes(2);
});
