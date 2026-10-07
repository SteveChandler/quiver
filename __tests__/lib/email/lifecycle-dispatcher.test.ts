/** @jest-environment node */
import { lifecycleMaxAcceptedPerRun, runEmailLifecycle } from "@/lib/email/lifecycle-dispatcher";
const mockRefreshUser = jest.fn();
const mockRefreshEligibility = jest.fn();
jest.mock("@/lib/subscription/offer-automation", () => ({ refreshLifecycleEligibility: () => mockRefreshEligibility(), refreshLifecycleUserEligibility: (...args: unknown[]) => mockRefreshUser(...args) }));
const mockReplyCheck = jest.fn();
jest.mock("@/lib/email/gmail-replies", () => ({ checkGmailRepliesBeforeSend: () => mockReplyCheck(), gmailFailureCode: () => "gmail_transport_error" }));
const mockRpc = jest.fn(); const mockDb = jest.fn(); const mockSend = jest.fn();
jest.mock("@/lib/email/lifecycle", () => ({ ...jest.requireActual("@/lib/email/lifecycle"), lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: () => mockDb() }));
jest.mock("@/lib/mailer/client", () => ({ getBaseUrl: () => "https://www.quiversurf.app", sendReservedLifecycleEmail: (...args: unknown[]) => mockSend(...args) }));
jest.mock("@/lib/mailer/lifecycle-email", () => ({ LIFECYCLE_CONTENT_HASH: "hash", renderLifecycleEmail: async () => ({ subject: "hello", html: "hello", text: "hello" }) }));
jest.mock("@/lib/utils/email-rate-limiter", () => ({ createResendRateLimiter: () => ({ throttle: async () => {} }) }));
jest.mock("@/lib/alerts/email-token", () => ({ generateEmailUnsubscribeToken: () => "token" }));
const originalEnv = { ...process.env };
beforeEach(() => { jest.resetAllMocks(); process.env = { ...originalEnv }; delete process.env.EMAIL_LIFECYCLE_ENABLED; delete process.env.PRO_OFFERS_ENABLED; mockRefreshEligibility.mockResolvedValue({ checked: 0, failed: 0 }); mockReplyCheck.mockResolvedValue({ checked: 4, recorded: 2 }); });
afterAll(() => { process.env = originalEnv; });
it.each([
  [undefined, 5], ["", 5], ["0", 5], ["201", 5], ["5.5", 5], ["12", 12], ["1", 1], ["200", 200],
])("parses lifecycle burst guard %s", (value, expected) => {
  if (value === undefined) delete process.env.EMAIL_LIFECYCLE_MAX_PER_RUN;
  else process.env.EMAIL_LIFECYCLE_MAX_PER_RUN = value;
  expect(lifecycleMaxAcceptedPerRun()).toBe(expected);
});
it("disabled mode does not read or write production state", async () => {
  expect(await runEmailLifecycle(false)).toEqual({ status: "disabled", accepted: 0 });
  expect(mockRpc).not.toHaveBeenCalled(); expect(mockDb).not.toHaveBeenCalled(); expect(mockSend).not.toHaveBeenCalled();
});
it("dry run counts reasons through read-only functions, without reservations or provider credentials", async () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  mockRpc.mockResolvedValueOnce([userId]).mockResolvedValueOnce({ user_id: userId, campaign_id: null, status: "held", reason: "consent_or_history_unknown" });
  expect(await runEmailLifecycle(true)).toEqual({ mode: "dry_run", candidates: 1, reasons: { consent_or_history_unknown: 1 }, accepted: 0 });
  expect(mockRpc.mock.calls).toEqual([["email_lifecycle_cohort"], ["evaluate_email_lifecycle", { p_user_id: userId }]]);
  expect(mockDb).not.toHaveBeenCalled(); expect(mockSend).not.toHaveBeenCalled();
});
it("a missing run ledger blocks all provider work", async () => {
  process.env.EMAIL_LIFECYCLE_ENABLED = "true"; mockRpc.mockResolvedValue([]);
  mockDb.mockResolvedValue({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error("ledger down") }) }) }) }) });
  await expect(runEmailLifecycle(false)).rejects.toThrow("Cannot persist lifecycle run"); expect(mockSend).not.toHaveBeenCalled();
});

it("reply check failure blocks every handoff and returns attention", async () => {
  process.env.EMAIL_LIFECYCLE_ENABLED = "true";
  const userId = "11111111-1111-4111-8111-111111111111";
  mockRpc.mockResolvedValueOnce([userId]).mockResolvedValueOnce({ unknown_handoffs: 0, expired_reservations: 0 }).mockResolvedValueOnce({
    user_id: userId, campaign_id: null, status: "due", reason: "eligible", job: "welcome", source: {
      email: "surfer@example.com", name: null, home_beach_id: null, sessions: 0, last_completion: null, trial_end: null,
    },
  });
  mockReplyCheck.mockRejectedValueOnce(Error("history gap"));
  const update = jest.fn().mockReturnValue({ eq: async () => ({ error: null }) });
  mockDb.mockResolvedValue({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "run" }, error: null }) }) }), update }) });
  await expect(runEmailLifecycle(false)).resolves.toMatchObject({ status: "attention", accepted: 0, reply_check: { status: "failed" } });
  expect(mockSend).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalledWith("claim_email_lifecycle", expect.anything());
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "error", error_message: "Email reply check failed: gmail_transport_error", produced: 0, summary: expect.objectContaining({ reply_check: { status: "failed", reason: "gmail_transport_error" } }) }));
});

it("skips the reply check when no candidate is due", async () => {
  process.env.EMAIL_LIFECYCLE_ENABLED = "true";
  const userId = "11111111-1111-4111-8111-111111111111";
  mockRpc.mockImplementation(async name => name === "email_lifecycle_cohort" ? [userId] : name === "reconcile_email_lifecycle" ? { unknown_handoffs: 0, expired_reservations: 0 } : name === "evaluate_email_lifecycle" ? { user_id: userId, campaign_id: null, status: "held", reason: "quiet" } : name === "email_automation_health" ? { due_unsent: 0, enrollment_pending: 0, approval_unavailable: 0 } : null);
  const update = jest.fn().mockReturnValue({ eq: async () => ({ error: null }) });
  mockDb.mockResolvedValue({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "run" }, error: null }) }) }), update }) });
  await expect(runEmailLifecycle(false)).resolves.toMatchObject({ status: "ok", reply_check: { status: "skipped" } });
  expect(mockReplyCheck).not.toHaveBeenCalled();
  expect(mockRpc.mock.calls.filter(([name]) => name === "evaluate_email_lifecycle")).toHaveLength(1);
});

it("records unavailable approval as health information without failing an empty run", async () => {
 process.env.EMAIL_LIFECYCLE_ENABLED = "true";
 mockRpc.mockImplementation(async name => name === "email_lifecycle_cohort" ? [] : name === "reconcile_email_lifecycle" ? {unknown_handoffs:0,expired_reservations:0} : name === "email_automation_health" ? {due_unsent:0,enrollment_pending:0,approval_unavailable:1} : null);
 const update=jest.fn().mockReturnValue({eq:async () => ({error:null})});
 mockDb.mockResolvedValue({from:() => ({insert:() => ({select:() => ({single:async () => ({data:{id:"run"},error:null})})}),update})});
 expect(await runEmailLifecycle(false)).toMatchObject({status:"ok",accepted:0});
 expect(update).toHaveBeenCalledWith(expect.objectContaining({status:"ok",error_message:null,produced:0,summary:expect.objectContaining({health:{due_unsent:0,enrollment_pending:0,approval_unavailable:1}})}));
 expect(mockSend).not.toHaveBeenCalled();
});

it("preserves every deliberate skip and records zero output as successful despite health backlog", async () => {
  process.env.EMAIL_LIFECYCLE_ENABLED = "true";
  process.env.EMAIL_REPLY_MAILBOX = "support@example.com";
  const reasons = ["no_relevant_job", "timezone_unknown", "version_mismatch", "cadence_or_quiet_hours", "entitlement_review_stale"];
  const users = reasons.map((_, index) => `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`);
  const health = { due_unsent: 7, enrollment_pending: 3, approval_unavailable: 1 };
  mockRpc.mockImplementation(async (name: string, args?: { p_user_id: string }): Promise<unknown> => {
    if (name === "email_lifecycle_cohort") return users;
    if (name === "reconcile_email_lifecycle") return { unknown_handoffs: 0, expired_reservations: 0 };
    if (name === "evaluate_email_lifecycle") return args!.p_user_id === users[2] ? { user_id: args!.p_user_id, campaign_id: null, status: "due", reason: "eligible", job: "welcome" } : { user_id: args!.p_user_id, campaign_id: null, status: "held", reason: reasons[users.indexOf(args!.p_user_id)] };
    if (name === "claim_email_lifecycle") return { allowed: false, reason: "version_mismatch" };
    if (name === "email_automation_health") return health;
    return null;
  });
  const update = jest.fn().mockReturnValue({ eq: async () => ({ error: null }) });
  mockDb.mockResolvedValue({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "run" }, error: null }) }) }), update }) });
  const counts = Object.fromEntries(reasons.map(reason => [reason, 1]));
  expect(await runEmailLifecycle(false)).toMatchObject({ status: "ok", candidates: 5, accepted: 0, reasons: counts, health });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "ok", error_message: null, produced: 0, summary: expect.objectContaining({ reasons: counts, health, reply_check: { status: "ok", checked: 4, recorded: 2 } }) }));
  expect(mockSend).not.toHaveBeenCalled();
  expect(mockReplyCheck).toHaveBeenCalledTimes(1);
  expect(mockRpc.mock.calls.filter(([name]) => name === "record_email_lifecycle_decision")).toHaveLength(5);
});

it.each(["email_lifecycle_cohort", "evaluate_email_lifecycle", "email_automation_health"])("records a %s query failure with its cause", async failedQuery => {
  process.env.EMAIL_LIFECYCLE_ENABLED = "true";
  const userId = "11111111-1111-4111-8111-111111111111";
  mockRpc.mockImplementation(async (name: string): Promise<unknown> => {
    if (name === failedQuery) throw new Error(`Lifecycle storage failed: ${name}`);
    if (name === "email_lifecycle_cohort") return [userId];
    if (name === "reconcile_email_lifecycle") return { unknown_handoffs: 0, expired_reservations: 0 };
    if (name === "evaluate_email_lifecycle") return { user_id: userId, campaign_id: null, status: "held", reason: "timezone_unknown" };
    return null;
  });
  const update = jest.fn().mockReturnValue({ eq: async () => ({ error: null }) });
  mockDb.mockResolvedValue({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "run" }, error: null }) }) }), update }) });
  await expect(runEmailLifecycle(false)).rejects.toThrow(`Lifecycle storage failed: ${failedQuery}`);
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "error", error_message: `Lifecycle storage failed: ${failedQuery}` }));
  expect(update.mock.calls[0][0].summary.reasons).toEqual(failedQuery === "email_automation_health" ? { timezone_unknown: 1 } : {});
  expect(mockSend).not.toHaveBeenCalled();
});

it.each(["eligibility", "handoff", "unknown", "accepted"])("reports %s outcomes with accurate status and failure detail", async outcome => {
  process.env.EMAIL_LIFECYCLE_ENABLED = "true";
  process.env.EMAIL_REPLY_MAILBOX = "support@example.com";
  const userId = "11111111-1111-4111-8111-111111111111";
  const decision = { user_id: userId, campaign_id: null, status: "due", reason: "eligible", job: "welcome", source: { email: "surfer@example.com", name: null, home_beach_id: null, sessions: 0, last_completion: null, trial_end: null } };
  mockRpc.mockImplementation(async (name: string): Promise<unknown> => {
    if (name === "email_lifecycle_cohort") return [userId];
    if (name === "reconcile_email_lifecycle") return { unknown_handoffs: outcome === "handoff" ? 2 : 0, expired_reservations: 0 };
    if (name === "evaluate_email_lifecycle") return decision;
    if (name === "claim_email_lifecycle") return { allowed: true, attempt_id: userId, decision };
    if (name === "email_automation_health") return { due_unsent: 0, enrollment_pending: 0 };
    return null;
  });
  if (outcome === "eligibility") mockRefreshEligibility.mockResolvedValue({ checked: 0, failed: 1 });
  mockSend.mockResolvedValue(outcome === "unknown" ? "unknown" : "accepted");
  const update = jest.fn().mockReturnValue({ eq: async () => ({ error: null }) });
  mockDb.mockResolvedValue({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "run" }, error: null }) }) }), update }) });
  const errorMessage = outcome === "eligibility" ? "Lifecycle eligibility refresh failed for 1 user(s)" : outcome === "handoff" ? "Email lifecycle has 2 unresolved handoff(s)" : outcome === "unknown" ? "Email provider acceptance unknown; handoff requires reconciliation" : null;
  expect(await runEmailLifecycle(false)).toMatchObject({ status: errorMessage ? "attention" : "ok", ...(errorMessage ? { error_message: errorMessage } : {}) });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: errorMessage ? "error" : "ok", error_message: errorMessage, produced: ["eligibility", "accepted"].includes(outcome) ? 1 : 0 }));
  expect(mockSend).toHaveBeenCalledTimes(outcome === "handoff" ? 0 : 1);
});

it.each([false, true])("refreshes promo eligibility before reservation; provider failure=%s", async providerFails => {
 process.env.EMAIL_LIFECYCLE_ENABLED = "true";
 process.env.EMAIL_REPLY_MAILBOX = "support@example.com";
 const userId = "11111111-1111-4111-8111-111111111111";
 const order: string[] = [];
 mockRefreshUser.mockImplementation(async () => { order.push("provider_read"); if (providerFails) throw Error("provider unavailable"); });
 mockRpc.mockImplementation(async name => {
  if (name === "email_lifecycle_cohort") return [userId];
  if (name === "reconcile_email_lifecycle") return { unknown_handoffs:0, expired_reservations:0 };
  if (name === "evaluate_email_lifecycle") return { user_id:userId,campaign_id:"startup-lifecycle-v1",status:"due",reason:"eligible",job:"offer_ready",source:{audience:"free",email:"surfer@example.com",name:null,home_beach_id:null,sessions:5,last_completion:null,trial_end:null,offer_id:"33333333-3333-4333-8333-333333333333",offer_months:1} };
  if (name === "claim_email_lifecycle") { order.push("reservation"); return { allowed:false,reason:"eligibility_changed" }; }
  if (name === "email_automation_health") return { due_unsent:0,enrollment_pending:0 };
  if (name === "gmail_reply_known") return [];
  return null;
 });
 const update = jest.fn().mockReturnValue({ eq:async () => ({ error:null }) });
 mockDb.mockResolvedValue({from:() => ({insert:() => ({select:() => ({single:async () => ({data:{id:"run"},error:null})})}),update})});
 const result = runEmailLifecycle(false);
 const outcome = await result.catch(error => ({ error:error.message }));
 expect(outcome).toMatchObject(providerFails ? { error:"provider unavailable" } : { accepted:0 });
 expect(order).toEqual(providerFails ? ["provider_read"] : ["provider_read", "reservation"]);
 expect(mockRpc.mock.calls.filter(([name]) => name === "evaluate_email_lifecycle")).toHaveLength(1);
 expect(mockRefreshUser).toHaveBeenCalledWith(userId);
 expect(mockSend).not.toHaveBeenCalled();
 expect(update).toHaveBeenCalledWith(expect.objectContaining(providerFails ? { status:"error", error_message:"provider unavailable" } : { status:"ok", error_message:null }));
});
