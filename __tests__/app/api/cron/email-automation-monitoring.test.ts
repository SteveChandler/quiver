/** @jest-environment node */
import { GET as replies } from "@/app/api/cron/email-replies/route";
import { GET as lifecycle } from "@/app/api/cron/email-lifecycle/route";
import { GET as offers } from "@/app/api/cron/pro-offer-reconcile/route";
import deployment from "@/vercel.json";

const mockAuth = jest.fn();
const mockStart = jest.fn();
const mockComplete = jest.fn();
const mockDb = jest.fn();
const mockReplies = jest.fn();
const mockLifecycle = jest.fn();
const mockOffers = jest.fn();
const mockRpc = jest.fn();
jest.mock("@/lib/middleware/api-wrappers", () => ({ validateCronRequest: () => mockAuth() }));
jest.mock("@/lib/monitoring/sentry-cron", () => ({
  startCronCheckIn: (...args: unknown[]) => mockStart(...args),
  completeCronCheckIn: (...args: unknown[]) => mockComplete(...args),
}));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: () => mockDb() }));
jest.mock("@/lib/email/gmail-replies", () => ({ syncGmailReplies: () => mockReplies() }));
jest.mock("@/lib/email/lifecycle-dispatcher", () => ({ runEmailLifecycle: (...args: unknown[]) => mockLifecycle(...args) }));
jest.mock("@/lib/subscription/offer-automation", () => ({ runProOfferAutomation: () => mockOffers() }));
jest.mock("@/lib/email/lifecycle", () => ({
  lifecycleEnabled: () => process.env.EMAIL_LIFECYCLE_ENABLED === "true",
  lifecycleRpc: (...args: unknown[]) => mockRpc(...args),
}));

const routes = [
  { get: replies, slug: "email-replies", flag: "EMAIL_GMAIL_REPLY_SYNC_ENABLED", schedule: "* * * * *", margin: 2, runtime: 1 },
  { get: lifecycle, slug: "email-lifecycle", flag: "EMAIL_LIFECYCLE_ENABLED", schedule: "*/15 * * * *", margin: 15, runtime: 3 },
  { get: offers, slug: "pro-offer-reconcile", flag: "PRO_OFFERS_ENABLED", schedule: "*/15 * * * *", margin: 15, runtime: 3 },
];
const originalEnv = { ...process.env };
beforeEach(() => {
  jest.resetAllMocks();
  for (const route of routes) delete process.env[route.flag];
  mockAuth.mockReturnValue(true);
  mockStart.mockReturnValue("check-in");
  mockComplete.mockResolvedValue(undefined);
});
afterAll(() => { process.env = originalEnv; });

it.each(routes)("$slug authenticates before check-ins or database/provider work", async ({ get }) => {
  mockAuth.mockReturnValue(false);
  expect((await get(new Request("http://localhost/cron"))).status).toBe(401);
  for (const mock of [mockStart, mockComplete, mockDb, mockReplies, mockLifecycle, mockOffers, mockRpc]) expect(mock).not.toHaveBeenCalled();
});

it.each(routes)("$slug reports disabled reachability without database/provider work", async ({ get, slug, schedule, margin, runtime }) => {
  const response = await get(new Request(`http://localhost/api/cron/${slug}`));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "disabled" });
  expect(mockStart.mock.calls).toEqual([[{ slug, schedule, checkinMarginMinutes: margin, maxRuntimeMinutes: runtime }]]);
  expect(mockComplete.mock.calls).toEqual([["check-in", slug, "ok"]]);
  for (const mock of [mockDb, mockReplies, mockLifecycle, mockOffers, mockRpc]) expect(mock).not.toHaveBeenCalled();
  expect(deployment.crons.filter(cron => cron.path === `/api/cron/${slug}`)).toEqual([{ path: `/api/cron/${slug}`, schedule }]);
});

it.each(routes.filter(route => route.get !== lifecycle))("$slug reports unavailable ledger as an error before provider work", async ({ get, slug, flag }) => {
  process.env[flag] = "true";
  mockDb.mockResolvedValue({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error("offline") }) }) }) }) });
  const response = await get(new Request("http://localhost/cron"));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Run ledger unavailable" });
  expect(mockComplete.mock.calls).toEqual([["check-in", slug, "error"]]);
  expect(mockReplies).not.toHaveBeenCalled(); expect(mockOffers).not.toHaveBeenCalled();
});

it("lifecycle reports dispatcher failure to the monitor", async () => {
  process.env.EMAIL_LIFECYCLE_ENABLED = "true";
  mockLifecycle.mockRejectedValue(new Error("ledger unavailable"));
  expect((await lifecycle(new Request("http://localhost/cron"))).status).toBe(503);
  expect(mockComplete.mock.calls).toEqual([["check-in", "email-lifecycle", "error"]]);
});

it("dry runs do not count as scheduled check-ins or grant offers", async () => {
  mockLifecycle.mockResolvedValue({ mode: "dry_run", accepted: 0 });
  mockRpc.mockResolvedValue([]);
  expect((await lifecycle(new Request("http://localhost/cron?mode=dry-run"))).status).toBe(200);
  expect(mockLifecycle.mock.calls).toEqual([[true]]);
  const response = await offers(new Request("http://localhost/cron?mode=dry-run"));
  expect(await response.json()).toEqual({ mode: "dry-run", due: [], unresolved: [], granted: 0 });
  expect(mockRpc.mock.calls).toEqual([["pro_offer_fulfillment_queue"], ["pro_offer_reconciliation_queue"]]);
  for (const mock of [mockStart, mockComplete, mockDb, mockOffers]) expect(mock).not.toHaveBeenCalled();
});

it("removes overlapping retired lifecycle schedules", () => {
  const retired = ["welcome-email", "weekly-recap-email", "session-prompt-email", "trial-lifecycle-email", "trial-invitation-email", "first-session-nudge", "earn-pro-evaluate"];
  expect(deployment.crons.filter(cron => retired.some(slug => cron.path === `/api/cron/${slug}`))).toEqual([]);
});
