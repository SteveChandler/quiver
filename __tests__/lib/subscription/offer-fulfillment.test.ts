/** @jest-environment node */
import { fulfillProOffer, reconcileProOffers } from "@/lib/subscription/offer-fulfillment";
import { createHash } from "node:crypto";
const mockRpc = jest.fn();
jest.mock("@/lib/email/lifecycle", () => ({ lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
const userId = "11111111-1111-4111-8111-111111111111";
const code = "a".repeat(43);
const reservation = { status: "reserved", award_id: userId, reservation_id: "22222222-2222-4222-8222-222222222222", user_id: userId, expires_at: "2027-02-28T12:00:00+00:00", entitlement_id: "Quiver Pro" };
const subscriber = { original_app_user_id: userId, entitlements: {}, subscriptions: {} };
const promo = { ...subscriber, entitlements: { "Quiver Pro": { product_identifier: "rc_promo_pro", expires_date: reservation.expires_at } }, subscriptions: { rc_promo_pro: { store: "promotional", is_sandbox: false, expires_date: reservation.expires_at } } };
const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status });
let fetchMock: jest.Mock;
const verifiedFetch: typeof fetch = async (url, options) => {
  if (String(url).includes('/v2/')) return json(String(url).includes('/aliases') ? { items: [{ id: userId }], next_page: null } : { id: userId, project_id: 'projfixture' });
  return fetchMock(url, options);
};
beforeEach(() => {
  jest.resetAllMocks(); process.env.PRO_OFFERS_ENABLED = "true"; process.env.REVENUECAT_SECRET_API_KEY = "fixture"; process.env.REVENUECAT_PROJECT_ID = "projfixture"; process.env.REVENUECAT_V2_SECRET_API_KEY = "fixture-v2";
  let reserved = false;
  mockRpc.mockImplementation(async name => {
    if (name === "reserve_pro_offer") { if (reserved) return { status: "verified", expires_at: reservation.expires_at, mirror_verified: false }; reserved = true; return reservation; }
    return name === "begin_pro_offer" ? true : null;
  });
  fetchMock = jest.fn().mockResolvedValueOnce(json({ subscriber })).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({ subscriber: promo }));
});
afterEach(() => { delete process.env.PRO_OFFERS_ENABLED; delete process.env.REVENUECAT_SECRET_API_KEY; });
it("disabled path never reads secrets, reserves or calls a provider", async () => {
  delete process.env.PRO_OFFERS_ENABLED; expect(await fulfillProOffer(userId, code, verifiedFetch)).toEqual({ status: "disabled" });
  expect(mockRpc).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
});
it("hashes a user-bound claim, reserves before handoff and verifies promo independently", async () => {
  expect(await fulfillProOffer(userId, code, verifiedFetch)).toEqual({ status: "verified", expires_at: reservation.expires_at, mirror_verified: false });
  expect(mockRpc.mock.calls[1]).toEqual(["reserve_pro_offer", { p_user_id: userId, p_code_hash: createHash("sha256").update(code).digest("hex"), p_entitlement_id: "Quiver Pro" }]);
  expect(mockRpc.mock.calls.map(c => c[0])).toEqual(["request_pro_offer_claim", "reserve_pro_offer", "begin_pro_offer", "verify_pro_offer", "apply_verified_pro_offer_mirror", "reconcile_pro_offer_mirrors", "reserve_pro_offer"]);
  expect(mockRpc.mock.invocationCallOrder[2]).toBeLessThan(fetchMock.mock.invocationCallOrder[1]);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ end_time_ms: Date.parse(reservation.expires_at) });
  expect(mockRpc.mock.calls[3][1].p_receipt).toMatchObject({ store: "promotional", product_id: "rc_promo_pro", user_id: userId });
});
it.each(["busy", "not_found", "paused", "not_earned", "verified", "reconciliation_required"])("%s does not call RevenueCat", async status => {
  const result = status === 'verified' ? { status, expires_at: reservation.expires_at, mirror_verified: false } : status === 'not_earned' ? { status, completed_sessions: 4 } : { status };
  mockRpc.mockResolvedValue(result); expect(await fulfillProOffer(userId, code, verifiedFetch)).toEqual(result); expect(fetchMock).not.toHaveBeenCalled();
});
it("active remote entitlement holds the earned right without a grant", async () => {
  fetchMock.mockReset().mockResolvedValue(json({ subscriber: { ...subscriber, entitlements: { "Quiver Pro": { product_identifier: "lifetime", expires_date: null } } } }));
  expect(await fulfillProOffer(userId, code, verifiedFetch)).toEqual({ status: "held_active_access" });
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(mockRpc).toHaveBeenCalledWith("hold_pro_offer", expect.objectContaining({ p_reason: "active_provider_access" }));
});
it("an alias identity requires review before any provider mutation", async () => {
  fetchMock.mockReset().mockResolvedValue(json({ subscriber: { ...subscriber, original_app_user_id: "other" } }));
  await expect(fulfillProOffer(userId, code, verifiedFetch)).rejects.toThrow("identity"); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("a failed durable handoff fence cannot issue a grant", async () => {
  mockRpc.mockImplementation(async name => name === "reserve_pro_offer" ? reservation : false);
  expect(await fulfillProOffer(userId, code, verifiedFetch)).toEqual({ status: "paused" }); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each(["timeout", "rejected", "wrong_receipt", "ledger_failed"])("%s after handoff goes to reconciliation without a second POST", async failure => {
  fetchMock.mockReset().mockResolvedValueOnce(json({ subscriber }));
  if (failure === "timeout") fetchMock.mockRejectedValueOnce(Error("timeout"));
  else fetchMock.mockResolvedValueOnce(json({}, failure === "rejected" ? 500 : 200)).mockResolvedValueOnce(json({ subscriber: failure === "wrong_receipt" ? subscriber : promo }));
  if (failure === "ledger_failed") mockRpc.mockImplementation(async name => { if (name === "verify_pro_offer") throw Error("ledger down"); return name === "reserve_pro_offer" ? reservation : true; });
  expect(await fulfillProOffer(userId, code, verifiedFetch)).toEqual({ status: "reconciliation_required" });
  expect(mockRpc).toHaveBeenCalledWith("unknown_pro_offer", expect.objectContaining({ p_award_id: reservation.award_id }));
  expect(fetchMock.mock.calls.filter(c => c[1]?.method === "POST")).toHaveLength(1);
});
it("reconciliation only GETs the original fixed award and repairs its ledger", async () => {
  mockRpc.mockImplementation(async name => name === "pro_offer_reconciliation_queue" ? [reservation] : name === "reconcile_pro_offer_mirrors" ? { matched: 0, overdue_mirrors: 0 } : null);
  fetchMock.mockReset().mockResolvedValue(json({ subscriber: promo }));
  expect(await reconcileProOffers(verifiedFetch)).toEqual({ checked: 1, unresolved: 0 });
  expect(fetchMock.mock.calls.every(c => c[1].method !== "POST")).toBe(true); expect(mockRpc).toHaveBeenCalledWith("verify_pro_offer", expect.anything());
});
it("unmatched reconciliation keeps the incident open and never re-grants", async () => {
  mockRpc.mockImplementation(async name => name === "pro_offer_reconciliation_queue" ? [reservation] : name === "reconcile_pro_offer_mirrors" ? { matched: 0, overdue_mirrors: 0 } : null);
  fetchMock.mockReset().mockResolvedValue(json({ subscriber }));
  expect(await reconcileProOffers(verifiedFetch)).toEqual({ checked: 1, unresolved: 1 });
  expect(mockRpc).toHaveBeenCalledWith("record_pro_offer_reconciliation", { p_award_id: reservation.award_id });
  expect(mockRpc).not.toHaveBeenCalledWith("verify_pro_offer", expect.anything());
});

it("preview reads owned terms without credentials, reservations, or provider work", async () => {
  delete process.env.REVENUECAT_SECRET_API_KEY;
  mockRpc.mockResolvedValue({ status: "preview", months: 1, terms_version: "v1", state: "enrolled", completed_sessions: 2 });
  expect(await fulfillProOffer(userId, code, verifiedFetch, true)).toEqual({ status: "preview", months: 1, terms_version: "v1", state: "enrolled", completed_sessions: 2 });
  expect(mockRpc.mock.calls.map(c => c[0])).toEqual(["preview_pro_offer"]); expect(fetchMock).not.toHaveBeenCalled();
});

it("a verified grant with an overdue missing product mirror keeps monitoring red", async () => {
  mockRpc.mockImplementation(async name => name === "pro_offer_reconciliation_queue" ? [] : { matched: 0, overdue_mirrors: 1 });
  expect(await reconcileProOffers(verifiedFetch)).toEqual({ checked: 0, unresolved: 1 });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("billing grace is active access even when the nominal expiry has passed", async () => {
  fetchMock.mockReset().mockResolvedValue(json({ subscriber: { ...subscriber, entitlements: { "Quiver Pro": { product_identifier: "paid", expires_date: "2000-01-01T00:00:00Z", grace_period_expires_date: "2099-01-01T00:00:00Z" } } } }));
  expect(await fulfillProOffer(userId, code, verifiedFetch)).toEqual({ status: "held_active_access" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("a get-or-create 201 never proceeds to a promotional grant", async () => {
  fetchMock.mockReset().mockResolvedValue(json({ subscriber }, 201));
  await expect(fulfillProOffer(userId, code, verifiedFetch)).rejects.toThrow("created");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
