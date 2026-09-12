/** @jest-environment node */
import { recordProviderEvent } from "@/lib/email/provider-events";
const mockRpc = jest.fn();
jest.mock("@/lib/email/lifecycle", () => ({ lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
beforeEach(() => { jest.clearAllMocks(); process.env.EMAIL_REPLY_MAILBOX = "founder@example.com"; mockRpc.mockResolvedValue(null); });
it("routes a signed reply by exact mailbox and normalized sender", async () => {
  const event = { type: "email.received", created_at: "2026-09-11T12:00:00Z", data: { email_id: "r1", created_at: "2026-09-11T12:00:00Z", from: "Surfer <surfer@example.com>", to: ["founder@example.com"] } };
  expect(await recordProviderEvent(event, "w1")).toBe(true);
  expect(mockRpc).toHaveBeenCalledWith("record_email_reply", { p_event_id: "r1", p_webhook_id: "w1", p_sender: "surfer@example.com", p_received_at: "2026-09-11T12:00:00Z" });
  mockRpc.mockClear();
  expect(await recordProviderEvent({ ...event, data: { ...event.data, to: ["elsewhere@example.com"] } }, "w2")).toBe(false);
  expect(mockRpc).not.toHaveBeenCalled();
});
it.each(["email.complained", "email.bounced", "email.delivered", "email.opened", "email.clicked"])("durably passes %s to the transactional receipt processor", async type => {
  await recordProviderEvent({ type, created_at: "2026-09-11T13:00:00Z", data: { email_id: "p1", created_at: "2026-09-11T12:00:00Z", to: ["surfer@example.com"], bounce: { type: "Permanent" } } }, "w1");
  expect(mockRpc).toHaveBeenCalledWith("record_lifecycle_provider_event", expect.objectContaining({ p_type: type, p_provider_id: "p1", p_webhook_id: "w1", p_hard_bounce: true, p_at: "2026-09-11T13:00:00Z" }));
});
it("propagates storage errors so the signed webhook can be retried", async () => {
  mockRpc.mockRejectedValue(new Error("write failed"));
  await expect(recordProviderEvent({ type: "email.complained", created_at: "2026-09-11T12:00:00Z", data: { email_id: "p1", created_at: "2026-09-11T12:00:00Z" } }, "w1")).rejects.toThrow("write failed");
});

it("does not suppress a temporary bounce or accept a missing event timestamp", async () => {
 const event = { type: "email.bounced", created_at: "2026-09-11T13:00:00Z", data: { email_id: "p1", created_at: "2026-09-11T12:00:00Z", bounce: { type: "Temporary" } } };
 await recordProviderEvent(event, "w1");
 expect(mockRpc).toHaveBeenCalledWith("record_lifecycle_provider_event", expect.objectContaining({ p_hard_bounce: false, p_at: event.created_at }));
 mockRpc.mockClear();
 await expect(recordProviderEvent({ ...event, created_at: undefined }, "w2")).rejects.toThrow();
 expect(mockRpc).not.toHaveBeenCalled();
});
