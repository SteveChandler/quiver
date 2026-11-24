/** @jest-environment node */
import { recordProviderEvent } from "@/lib/email/provider-events";

// Real lifecycleRpc, so the fallback sees the same wrapped error shape as production.
const mockRpc = jest.fn();
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: async () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));

// Resend email.bounced payload shape (resend@6.9.2 EmailBouncedEvent; https://resend.com/docs/webhooks/emails/bounced).
const bounced = {
  type: "email.bounced",
  created_at: "2026-11-22T23:41:12.126Z",
  data: {
    created_at: "2026-11-22T23:41:11.894Z",
    email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
    from: "Quiver <hello@example.com>",
    to: ["surfer@example.com"],
    subject: "Surf",
    bounce: { message: "Mailbox full", subType: "MailboxFull", type: "Transient" },
  },
};
const oldArgs = {
  p_webhook_id: "w1", p_provider_id: bounced.data.email_id, p_type: "email.bounced", p_at: bounced.created_at,
  p_recipients: ["surfer@example.com"], p_hard_bounce: false, p_link: null, p_user_agent: null,
};

beforeEach(() => { mockRpc.mockReset(); mockRpc.mockResolvedValue({ data: null, error: null }); });

it("sends the provider bounce type and subtype to the v2 function", async () => {
  await expect(recordProviderEvent(bounced, "w1")).resolves.toBe(true);
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledWith("record_lifecycle_provider_event_v2", { ...oldArgs, p_bounce_type: "Transient", p_bounce_subtype: "MailboxFull" });
});

it("classifies a Resend Permanent bounce as hard", async () => {
  await recordProviderEvent({ ...bounced, data: { ...bounced.data, bounce: { message: "x", subType: "General", type: "Permanent" } } }, "w1");
  expect(mockRpc).toHaveBeenCalledWith("record_lifecycle_provider_event_v2", expect.objectContaining({ p_hard_bounce: true, p_bounce_type: "Permanent", p_bounce_subtype: "General" }));
});

it("sends null bounce fields for an event without a bounce", async () => {
  const { bounce: _bounce, ...data } = bounced.data;
  await recordProviderEvent({ ...bounced, type: "email.delivered", data }, "w1");
  expect(mockRpc).toHaveBeenCalledWith("record_lifecycle_provider_event_v2", expect.objectContaining({ p_type: "email.delivered", p_bounce_type: null, p_bounce_subtype: null }));
});

it.each([
  ["PGRST202", "Could not find the function public.record_lifecycle_provider_event_v2 in the schema cache"],
  ["42883", "function public.record_lifecycle_provider_event_v2 does not exist"],
])("falls back to the old function with today's arguments when v2 is missing (%s)", async (code, message) => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code, message, details: null, hint: null } });
  await expect(recordProviderEvent(bounced, "w1")).resolves.toBe(true);
  expect(mockRpc).toHaveBeenCalledTimes(2);
  expect(mockRpc).toHaveBeenLastCalledWith("record_lifecycle_provider_event", oldArgs);
});

it.each([
  ["57014", "canceling statement due to statement timeout"],
  ["P0001", "Suppression recipient missing"],
  ["PGRST203", "Could not choose the best candidate function"],
  ["", "TypeError: fetch failed"],
])("rethrows an unrelated error (%s) without calling the old function", async (code, message) => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code, message, details: null, hint: null } });
  await expect(recordProviderEvent(bounced, "w1")).rejects.toThrow(`Lifecycle storage failed: record_lifecycle_provider_event_v2: ${code ? `${code} ` : ""}${message}`);
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it("propagates a failure of the fallback call so the webhook is retried", async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "missing" } })
    .mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
  await expect(recordProviderEvent(bounced, "w1")).rejects.toThrow("Lifecycle storage failed: record_lifecycle_provider_event: 57014 timeout");
});
