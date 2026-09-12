/** @jest-environment node */
import { runEmailLifecycle } from "@/lib/email/lifecycle-dispatcher";
jest.mock("@/lib/subscription/offer-automation", () => ({ refreshLifecycleEligibility: async () => ({ checked: 0, failed: 0 }) }));
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
