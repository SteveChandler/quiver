/** @jest-environment node */
// The v4 constants are read at module load, so the flags are set before the dispatcher is required.
process.env.TRIAL_FEEDBACK_ENABLED = "true";
process.env.LIFECYCLE_V4_ENABLED = "true";
const mockRpc = jest.fn(); const mockDb = jest.fn(); const mockSend = jest.fn(); const mockLoad = jest.fn(); const mockRender = jest.fn();
jest.mock("@/lib/subscription/offer-automation", () => ({ refreshLifecycleEligibility: async () => ({ checked: 0, failed: 0 }), refreshLifecycleUserEligibility: async () => undefined }));
jest.mock("@/lib/email/gmail-replies", () => ({ checkGmailRepliesBeforeSend: async () => ({ checked: 0, recorded: 0 }), gmailFailureCode: () => "x" }));
jest.mock("@/lib/email/lifecycle", () => ({ ...jest.requireActual("@/lib/email/lifecycle"), lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
jest.mock("@/lib/email/activation-call", () => ({ loadActivationCall: (...args: unknown[]) => mockLoad(...args) }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: () => mockDb() }));
jest.mock("@/lib/mailer/client", () => ({ getBaseUrl: () => "https://www.quiversurf.app", sendReservedLifecycleEmail: (...args: unknown[]) => mockSend(...args) }));
jest.mock("@/lib/mailer/lifecycle-email", () => ({ LIFECYCLE_CONTENT_HASH: "v4-hash", renderLifecycleEmail: (...args: unknown[]) => mockRender(...args) }));
jest.mock("@/lib/utils/email-rate-limiter", () => ({ createResendRateLimiter: () => ({ throttle: async () => {} }) }));
jest.mock("@/lib/alerts/email-token", () => ({ generateEmailUnsubscribeToken: () => "token" }));
const { runEmailLifecycle } = require("@/lib/email/lifecycle-dispatcher") as typeof import("@/lib/email/lifecycle-dispatcher");

const USER = "11111111-1111-4111-8111-111111111111";
const HOME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const decision = (job: string) => ({ user_id: USER, campaign_id: "startup-lifecycle-v4", status: "due", reason: "eligible", job,
  source: { audience: "free", email: "surfer@example.com", name: null, home_beach_id: HOME, sessions: 0, last_completion: null, trial_end: null } });
const call = { kind: "fallback", beach: { id: HOME, name: "Capitola", slug: "capitola" }, reason: "no_call", now: "2026-11-19T17:00:00Z" };

function setup(job: string, claim: () => Promise<unknown>): string[] {
  const order: string[] = [];
  process.env.EMAIL_LIFECYCLE_ENABLED = "true";
  process.env.EMAIL_REPLY_MAILBOX = "support@example.com";
  mockRpc.mockImplementation(async (name: string, args: unknown): Promise<unknown> => {
    order.push(name);
    if (name === "email_lifecycle_cohort") return [USER];
    if (name === "reconcile_email_lifecycle") return { unknown_handoffs: 0, expired_reservations: 0 };
    if (name === "evaluate_email_lifecycle") return decision(job);
    if (name === "claim_email_lifecycle") { expect(args).toEqual({ p_user_id: USER, p_version: 4, p_content_hash: "v4-hash" }); return claim(); }
    if (name === "email_automation_health") return { due_unsent: 0, enrollment_pending: 0 };
    return null;
  });
  mockLoad.mockImplementation(async () => { order.push("loadActivationCall"); return call; });
  mockRender.mockResolvedValue({ subject: "Planning a surf?", html: "x", text: "x" });
  mockSend.mockResolvedValue("accepted");
  const update = jest.fn().mockReturnValue({ eq: async () => ({ error: null }) });
  mockDb.mockResolvedValue({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "run" }, error: null }) }) }), update }) });
  return order;
}

beforeEach(() => jest.clearAllMocks());

it("reads the activation call before the claim and passes it to the renderer", async () => {
  const order = setup("activation", async () => ({ allowed: true, attempt_id: USER, decision: decision("activation") }));
  await expect(runEmailLifecycle(false)).resolves.toMatchObject({ accepted: 1 });
  expect(mockLoad).toHaveBeenCalledWith({ userId: USER, homeBeachId: HOME });
  expect(order.indexOf("loadActivationCall")).toBeLessThan(order.indexOf("claim_email_lifecycle"));
  expect(mockRender.mock.calls[0][5]).toBe(call);
  expect(mockSend).toHaveBeenCalledWith(USER, expect.objectContaining({ tags: expect.arrayContaining([{ name: "campaign_id", value: "startup-lifecycle-v4" }]) }));
});

it("does not read a forecast for other jobs", async () => {
  setup("welcome", async () => ({ allowed: true, attempt_id: USER, decision: decision("welcome") }));
  await runEmailLifecycle(false);
  expect(mockLoad).not.toHaveBeenCalled();
  expect(mockRender.mock.calls[0][5]).toBeUndefined();
});

it("a claim failure after the forecast read still aborts the run; it is not fallback copy", async () => {
  setup("activation", async () => { throw new Error("Lifecycle storage failed: claim_email_lifecycle: 57014"); });
  await expect(runEmailLifecycle(false)).rejects.toThrow("57014");
  expect(mockRender).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});

it("a render failure propagates after the claim", async () => {
  setup("activation", async () => ({ allowed: true, attempt_id: USER, decision: decision("activation") }));
  mockRender.mockRejectedValueOnce(new Error("Missing activation copy value: beach"));
  await expect(runEmailLifecycle(false)).rejects.toThrow("Missing activation copy value");
  expect(mockSend).not.toHaveBeenCalled();
});

it("loads the call after the claim when the claimed job became activation", async () => {
  const order = setup("welcome", async () => ({ allowed: true, attempt_id: USER, decision: decision("activation") }));
  await runEmailLifecycle(false);
  expect(mockLoad).toHaveBeenCalledTimes(1);
  expect(order.indexOf("loadActivationCall")).toBeGreaterThan(order.indexOf("claim_email_lifecycle"));
  expect(mockRender.mock.calls[0][5]).toBe(call);
});

it("drops a preloaded call when the claimed job is no longer activation", async () => {
  setup("activation", async () => ({ allowed: true, attempt_id: USER, decision: decision("progress") }));
  await runEmailLifecycle(false);
  expect(mockLoad).toHaveBeenCalledTimes(1);
  expect(mockRender.mock.calls[0][5]).toBeUndefined();
});

it("does not read a forecast for an activation candidate that is not due", async () => {
  setup("activation", async () => ({ allowed: true, attempt_id: USER, decision: decision("activation") }));
  mockRpc.mockImplementation(async (name: string): Promise<unknown> => {
    if (name === "email_lifecycle_cohort") return [USER];
    if (name === "reconcile_email_lifecycle") return { unknown_handoffs: 0, expired_reservations: 0 };
    if (name === "evaluate_email_lifecycle") return { ...decision("activation"), status: "deferred", reason: "cadence_or_quiet_hours" };
    if (name === "email_automation_health") return { due_unsent: 0, enrollment_pending: 0 };
    return null;
  });
  await runEmailLifecycle(false);
  expect(mockLoad).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalledWith("claim_email_lifecycle", expect.anything());
});

it("a claim that holds the user sends nothing, even after a preload", async () => {
  setup("activation", async () => ({ allowed: false, reason: "version_mismatch" }));
  await expect(runEmailLifecycle(false)).resolves.toMatchObject({ reasons: { version_mismatch: 1 } });
  expect(mockRender).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});
