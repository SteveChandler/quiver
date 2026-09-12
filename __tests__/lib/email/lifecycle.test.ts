/** @jest-environment node */
import { sendReservedLifecycleEmail, sendEmail, resend } from "@/lib/mailer/client";
const mockRpc = jest.fn();
const mockSend = jest.fn();
jest.mock("@/lib/email/lifecycle", () => ({ lifecycleEnabled: () => process.env.EMAIL_LIFECYCLE_ENABLED === "true", lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
jest.mock("resend", () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: (...args: unknown[]) => mockSend(...args) } })) }));
const payload = { from: "Quiver <hello@example.com>", to: "surfer@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" };
const original = process.env;
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...original, EMAIL_LIFECYCLE_ENABLED: "true", EMAIL_REPLY_INGESTION_VERIFIED: "true", RESEND_API_KEY: "fake" };
  delete process.env.PLAYWRIGHT_TEST;
  delete process.env.NEXT_PUBLIC_E2E_DISABLE_EMAIL_SENDS;
  mockRpc.mockResolvedValue(true);
  mockSend.mockResolvedValue({ data: { id: "provider-1" }, error: null });
});
afterEach(() => { process.env = original; });
it("blocks disabled, E2E, unclassified and direct sends before provider handoff", async () => {
  await expect(sendEmail(payload)).rejects.toThrow("Unclassified");
  await expect(resend.emails.send()).rejects.toThrow("retired");
  process.env.EMAIL_LIFECYCLE_ENABLED = "false";
  expect(await sendReservedLifecycleEmail("a", payload)).toBe("disabled");
  process.env.EMAIL_LIFECYCLE_ENABLED = "true";
  process.env.PLAYWRIGHT_TEST = "true";
  expect(await sendReservedLifecycleEmail("a", payload)).toBe("disabled");
  expect(mockRpc).not.toHaveBeenCalled(); expect(mockSend).not.toHaveBeenCalled();
});
it("checks the persisted reservation before handoff and retains its idempotency key", async () => {
  expect(await sendReservedLifecycleEmail("attempt-1", payload)).toBe("accepted");
  expect(mockRpc.mock.calls).toEqual([["begin_email_lifecycle", { p_attempt_id: "attempt-1", p_payload: payload }], ["finish_email_lifecycle", { p_attempt_id: "attempt-1", p_provider_id: "provider-1" }]]);
  expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(mockSend.mock.invocationCallOrder[0]);
  expect(mockSend).toHaveBeenCalledWith(payload, { idempotencyKey: "attempt-1" });
});
it("does not send when eligibility changed", async () => {
  mockRpc.mockResolvedValue(false);
  expect(await sendReservedLifecycleEmail("a", payload)).toBe("cancelled"); expect(mockSend).not.toHaveBeenCalled();
});
it.each(["timeout", "missing-id", "receipt-failure"])("holds ambiguous %s without another send", async scenario => {
  if (scenario === "timeout") mockSend.mockRejectedValue(new Error("timeout"));
  if (scenario === "missing-id") mockSend.mockResolvedValue({ data: null, error: null });
  if (scenario === "receipt-failure") mockRpc.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("storage"));
  expect(await sendReservedLifecycleEmail("a", payload)).toBe("unknown");
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenLastCalledWith("mark_email_lifecycle_unknown", { p_attempt_id: "a" });
});
