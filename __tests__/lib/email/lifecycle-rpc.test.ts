/** @jest-environment node */
import { lifecycleRpc } from "@/lib/email/lifecycle";

const mockRpc = jest.fn();
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: async () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));

beforeEach(() => mockRpc.mockReset());

it("returns the RPC data", async () => {
  mockRpc.mockResolvedValue({ data: { status: "held" }, error: null });
  await expect(lifecycleRpc("evaluate_email_lifecycle", { p_user_id: "u" })).resolves.toEqual({ status: "held" });
  expect(mockRpc).toHaveBeenCalledWith("evaluate_email_lifecycle", { p_user_id: "u" });
});

it("keeps the Postgres code and message and the original error", async () => {
  const error = { code: "57014", message: "canceling statement due to statement timeout", details: null, hint: null };
  mockRpc.mockResolvedValue({ data: null, error });
  const thrown = await lifecycleRpc("evaluate_email_lifecycle").catch((caught: unknown) => caught);
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toBe("Lifecycle storage failed: evaluate_email_lifecycle: 57014 canceling statement due to statement timeout");
  expect((thrown as Error).cause).toBe(error);
});

it("keeps a transport failure message that has no Postgres code", async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: "", message: "TypeError: fetch failed" } });
  await expect(lifecycleRpc("email_lifecycle_cohort")).rejects.toThrow("Lifecycle storage failed: email_lifecycle_cohort: TypeError: fetch failed");
});

it("keeps PostgREST details and hint, and a bare string error", async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint \"x\"", details: "Key (user_id)=(u) already exists.", hint: "" } });
  await expect(lifecycleRpc("claim_email_lifecycle")).rejects.toThrow("Lifecycle storage failed: claim_email_lifecycle: 23505 duplicate key value violates unique constraint \"x\" Key (user_id)=(u) already exists.");
  mockRpc.mockResolvedValueOnce({ data: null, error: "socket hang up" });
  await expect(lifecycleRpc("email_lifecycle_cohort")).rejects.toThrow("Lifecycle storage failed: email_lifecycle_cohort: socket hang up");
});

it("falls back to the RPC name when the error has no detail", async () => {
  mockRpc.mockResolvedValue({ data: null, error: {} });
  await expect(lifecycleRpc("email_lifecycle_cohort")).rejects.toThrow(/^Lifecycle storage failed: email_lifecycle_cohort$/);
});
