/** @jest-environment node */
import { sendWithContactPolicy, recordInboundReply } from "@/lib/email/contact-policy";

const rpc = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({ rpc })),
}));

describe("contact policy", () => {
  const originalEnv = process.env;
  const send = jest.fn();
  const contact = { userId: "11111111-1111-4111-8111-111111111111", emailType: "trial_invitation" } as const;
  beforeEach(() => {
    process.env = { ...originalEnv, EMAIL_CONTACT_POLICY_ENABLED: "true", EMAIL_REPLY_MAILBOX: "replies@inbound.example.com" };
    jest.clearAllMocks();
    rpc.mockResolvedValue({ data: { allowed: true, attempt_id: "attempt-1" }, error: null });
    send.mockResolvedValue({ data: { id: "provider-1" }, error: null });
  });
  afterEach(() => { process.env = originalEnv; });

  it("never calls the provider when the deterministic gate denies", async () => {
    rpc.mockResolvedValue({ data: { allowed: false, reason: "reply_paused" }, error: null });
    await expect(sendWithContactPolicy(contact, "surfer@example.com", send)).rejects.toThrow("reply_paused");
    expect(send).not.toHaveBeenCalled();
  });
  it("fails closed on database failure or malformed results", async () => {
    for (const response of [{ error: { message: "offline" } }, { data: {} }]) {
      rpc.mockResolvedValue(response);
      await expect(sendWithContactPolicy(contact, "surfer@example.com", send)).rejects.toThrow();
    }
    expect(send).not.toHaveBeenCalled();
  });
  it("uses the reservation as provider idempotency key and records acceptance", async () => {
    await sendWithContactPolicy(contact, "SURFER@example.com", send);
    expect(rpc).toHaveBeenNthCalledWith(1, "claim_email_contact", {
      p_user_id: contact.userId, p_email: "surfer@example.com", p_email_type: "trial_invitation",
    });
    expect(send).toHaveBeenCalledWith("attempt-1", "replies@inbound.example.com");
    expect(rpc).toHaveBeenNthCalledWith(2, "finish_email_contact", {
      p_attempt_id: "attempt-1", p_provider_id: "provider-1",
    });
  });
  it("leaves ambiguous requests reserved and does not retry", async () => {
    send.mockRejectedValue(new Error("timeout"));
    await expect(sendWithContactPolicy(contact, "surfer@example.com", send)).rejects.toThrow("timeout");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("does not count provider errors or missing IDs as sent", async () => {
    for (const response of [{ data: null, error: { message: "rate limited" } }, { data: {}, error: null }]) {
      rpc.mockClear();
      send.mockResolvedValue(response);
      await expect(sendWithContactPolicy(contact, "surfer@example.com", send)).rejects.toThrow();
      expect(rpc).toHaveBeenCalledTimes(1);
    }
  });
  it("requires the reply mailbox before acquisition sends", async () => {
    delete process.env.EMAIL_REPLY_MAILBOX;
    await expect(sendWithContactPolicy(contact, "surfer@example.com", send)).rejects.toThrow("mailbox");
    expect(send).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects multiple recipients and malformed contact metadata", async () => {
    await expect(sendWithContactPolicy(contact, ["a@example.com", "b@example.com"], send)).rejects.toThrow();
    await expect(sendWithContactPolicy({ ...contact, userId: "bad" }, "a@example.com", send)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
  it("persists only inbound metadata for the configured mailbox", async () => {
    const event = { email_id: "inbound-1", from: "SURFER@example.com", to: ["replies@inbound.example.com"], created_at: "2026-09-03T12:00:00Z", text: "untrusted content" };
    await recordInboundReply(event, "webhook-1");
    expect(rpc).toHaveBeenCalledWith("record_email_reply", {
      p_event_id: "inbound-1", p_webhook_id: "webhook-1", p_sender: "surfer@example.com", p_received_at: event.created_at,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("untrusted content");
  });
  it("ignores other mailboxes and fails on invalid metadata or storage failure", async () => {
    const event = { email_id: "inbound-1", from: "a@example.com", to: ["other@example.com"], created_at: "2026-09-03T12:00:00Z" };
    expect(await recordInboundReply(event, "webhook-1")).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    await expect(recordInboundReply({}, "webhook-1")).rejects.toThrow();
    rpc.mockResolvedValue({ error: { message: "offline" } });
    await expect(recordInboundReply({ ...event, to: ["replies@inbound.example.com"] }, "webhook-1")).rejects.toThrow();
  });
});
