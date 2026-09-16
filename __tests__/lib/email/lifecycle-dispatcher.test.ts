/** @jest-environment node */
import { runEmailLifecycle } from "@/lib/email/lifecycle-dispatcher";
const mockRefreshUser = jest.fn();
jest.mock("@/lib/subscription/offer-automation", () => ({ refreshLifecycleEligibility: async () => ({ checked: 0, failed: 0 }), refreshLifecycleUserEligibility: (...args: unknown[]) => mockRefreshUser(...args) }));
const mockSync = jest.fn();
jest.mock("@/lib/email/gmail-replies", () => ({ ensureGmailRepliesFresh: () => mockSync() }));
const mockRpc = jest.fn(); const mockDb = jest.fn(); const mockSend = jest.fn();
jest.mock("@/lib/email/lifecycle", () => ({ ...jest.requireActual("@/lib/email/lifecycle"), lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: () => mockDb() }));
jest.mock("@/lib/mailer/client", () => ({ getBaseUrl: () => "https://www.quiversurf.app", sendReservedLifecycleEmail: (...args: unknown[]) => mockSend(...args) }));
beforeEach(() => { jest.clearAllMocks(); delete process.env.EMAIL_LIFECYCLE_ENABLED; });
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

it("inbox scan failure blocks every handoff and finishes the run as failed", async () => {
  process.env.EMAIL_LIFECYCLE_ENABLED = "true";
  mockRpc.mockResolvedValueOnce([]).mockResolvedValueOnce({ unknown_handoffs: 0, expired_reservations: 0 });
  mockSync.mockRejectedValueOnce(Error("history gap"));
  const update = jest.fn().mockReturnValue({ eq: async () => ({ error: null }) });
  mockDb.mockResolvedValue({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "run" }, error: null }) }) }), update }) });
  await expect(runEmailLifecycle(false)).rejects.toThrow("history gap");
  expect(mockSend).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalledWith("claim_email_lifecycle", expect.anything());
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "error", produced: 0 }));
});

it("marks the persisted run as an error when approval has expired, even with no due recipients", async () => {
 process.env.EMAIL_LIFECYCLE_ENABLED = "true";
 mockRpc.mockImplementation(async name => name === "email_lifecycle_cohort" ? [] : name === "reconcile_email_lifecycle" ? {unknown_handoffs:0,expired_reservations:0} : name === "email_automation_health" ? {due_unsent:0,enrollment_pending:0,approval_unavailable:1} : null);
 const update=jest.fn().mockReturnValue({eq:async () => ({error:null})});
 mockDb.mockResolvedValue({from:() => ({insert:() => ({select:() => ({single:async () => ({data:{id:"run"},error:null})})}),update})});
 expect(await runEmailLifecycle(false)).toMatchObject({status:"attention",accepted:0});
 expect(update).toHaveBeenCalledWith(expect.objectContaining({status:"error",produced:0}));
 expect(mockSend).not.toHaveBeenCalled();
});

it.each([false, true])("refreshes promo eligibility before reservation; provider failure=%s", async providerFails => {
 process.env.EMAIL_LIFECYCLE_ENABLED = "true";
 process.env.EMAIL_REPLY_INGESTION_VERIFIED = "true";
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
  return null;
 });
 const update = jest.fn().mockReturnValue({ eq:async () => ({ error:null }) });
 mockDb.mockResolvedValue({from:() => ({insert:() => ({select:() => ({single:async () => ({data:{id:"run"},error:null})})}),update})});
 const result = runEmailLifecycle(false);
 const outcome = await result.catch(error => ({ error:error.message }));
 expect(outcome).toMatchObject(providerFails ? { error:"provider unavailable" } : { accepted:0 });
 expect(order).toEqual(providerFails ? ["provider_read"] : ["provider_read", "reservation"]);
 expect(mockRefreshUser).toHaveBeenCalledWith(userId);
 expect(mockSend).not.toHaveBeenCalled();
});
