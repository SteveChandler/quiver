/** @jest-environment node */
import { POST } from "@/app/api/cron/swell-watch-evaluate/route";
import { loadSwellWatchAcquisitionScope } from "@/lib/alerts/swell-watch/provider-run-store";
import { evaluateSwellWatchShadow } from "@/lib/alerts/swell-watch/shadow-evaluation";
import { calculateSwellWatchPolicyHash, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import fixture from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/provider-run-store", () => ({ loadSwellWatchAcquisitionScope: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/shadow-evaluation", () => ({ evaluateSwellWatchShadow: jest.fn() }));
jest.mock("@/lib/notifications/enqueue", () => ({ enqueueNotification: () => { throw new Error("Forbidden send path"); } }));

if (typeof Response.json !== "function") {
  Response.json = (data: unknown, init?: ResponseInit): Response => new Response(JSON.stringify(data), init);
}
const batch = "10000000-0000-4000-8000-000000000001";
const cohort = [{ sourcePointId: batch, regionKey: "oahu" }];
const policy = { ...fixture, schema_version: "swell-watch-policy.v2",
  policy_values: { ...fixture.policy_values, volume_caps: { ...fixture.policy_values.volume_caps, projected_send_window_hours: 24 } },
} as SwellWatchPolicy;
policy.value_hash = calculateSwellWatchPolicyHash(policy);
const originalEnv = process.env;
const result = { status: "evaluated", enqueued: 0, sendEligibility: "not_evaluated", projectedSendsRolling24Hours: null };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createSupabaseServiceRoleClient).mockReset().mockReturnValue({} as never);
  process.env = { ...originalEnv, CRON_SECRET: "fixture-secret", SWELL_WATCH_SHADOW_EVALUATION_ENABLED: "true",
    SWELL_WATCH_ENABLED: "false", SWELL_WATCH_PUSH_ENABLED: "false",
    SWELL_WATCH_PRODUCER_CONFIG: JSON.stringify({ policy, cohort }) };
  jest.mocked(loadSwellWatchAcquisitionScope).mockResolvedValue([]);
  jest.mocked(evaluateSwellWatchShadow).mockResolvedValue(result as never);
});
afterEach(() => { process.env = originalEnv; jest.restoreAllMocks(); });

async function call(body: unknown = { provider_batch_id: batch }, query = "", token = "fixture-secret"): Promise<Response> {
  const response = await POST(new Request(`http://localhost/api/cron/swell-watch-evaluate${query}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
  expect(response.headers.get("Cache-Control")).toBe("private, no-store, no-cache, must-revalidate");
  return response;
}

it("authenticates before the default-off flag and does no work while disabled", async () => {
  delete process.env.SWELL_WATCH_SHADOW_EVALUATION_ENABLED;
  expect((await call(undefined, "", "wrong")).status).toBe(401);
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { skipped: true, reason: "disabled", enqueued: 0 } });
  expect(loadSwellWatchAcquisitionScope).not.toHaveBeenCalled();
  expect(evaluateSwellWatchShadow).not.toHaveBeenCalled();
});

it.each([{}, { provider_batch_id: "bad" }, { provider_batch_id: batch, policy }, { action: "acquire" }])("rejects caller overrides/invalid IDs: %j", async (body) => {
  expect((await call(body)).status).toBe(400);
  expect(loadSwellWatchAcquisitionScope).not.toHaveBeenCalled();
  expect(evaluateSwellWatchShadow).not.toHaveBeenCalled();
});

it("rejects query parameters", async () => {
  expect((await call(undefined, "?cohort=override")).status).toBe(400);
  expect(evaluateSwellWatchShadow).not.toHaveBeenCalled();
});

it("rejects malformed JSON without evaluating", async () => {
  const response = await POST(new Request("http://localhost/api/cron/swell-watch-evaluate", {
    method: "POST", headers: { Authorization: "Bearer fixture-secret" }, body: "{",
  }));
  expect(response.status).toBe(400);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(evaluateSwellWatchShadow).not.toHaveBeenCalled();
});

it.each([null, { cohort }, { policy: fixture, cohort }, { policy: { ...policy, value_hash: "0".repeat(64) }, cohort },
  { policy, cohort: [...cohort, ...cohort] }, { policy, cohort, extra: true },
  { policy, cohort: Array.from({ length: 11 }, (_, index) => ({ sourcePointId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, regionKey: "oahu" })) },
])("rejects invalid server configuration: %j", async (config) => {
  process.env.SWELL_WATCH_PRODUCER_CONFIG = JSON.stringify(config);
  expect((await call()).status).toBe(503);
  expect(loadSwellWatchAcquisitionScope).not.toHaveBeenCalled();
  expect(evaluateSwellWatchShadow).not.toHaveBeenCalled();
});

it("uses the server policy and cohort with live-send flags off", async () => {
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: result });
  expect(loadSwellWatchAcquisitionScope).toHaveBeenCalledWith(cohort, expect.anything());
  expect(evaluateSwellWatchShadow).toHaveBeenCalledTimes(1);
  expect(evaluateSwellWatchShadow).toHaveBeenCalledWith({ providerBatchId: batch, forecastDays: 7,
    policy, scopes: [], now: expect.any(String) }, expect.anything());
});

it("retains suppressed evaluation identity and unknown counts through the real cron wrapper", async () => {
  const update = jest.fn().mockReturnValue({ eq: jest.fn().mockImplementation(() =>
    Object.assign(Promise.resolve({ error: null }), { lt: jest.fn().mockResolvedValue({ error: null }) })) });
  const insert = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({
    single: jest.fn().mockResolvedValue({ data: { id: "cron-run" }, error: null }),
  }) });
  const from = jest.fn((table: string) => {
    if (table !== "cron_runs") throw new Error("Unexpected table access");
    return { insert, update };
  });
  jest.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from } as never);
  const suppressed = { ...result, status: "suppressed", reason: "incomplete_partition",
    providerBatchId: batch, policyHash: policy.value_hash, candidateCount: null,
    stableRegionalEventCount: null, preSafetyRecipientsThisEvaluation: null, recordedDemand: null };
  jest.mocked(evaluateSwellWatchShadow).mockResolvedValue(suppressed as never);
  const response = await call();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data).toEqual(suppressed);
  expect(insert).toHaveBeenCalledWith({ route: "/api/cron/swell-watch-evaluate", status: "started" });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "ok", summary: body }));
  expect(body.data.candidateCount).toBeNull();
  expect(body.data.sendEligibility).toBe("not_evaluated");
});

it.each(["scope", "evaluation"])("sanitizes %s failures", async (failure) => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  const mock = failure === "scope" ? jest.mocked(loadSwellWatchAcquisitionScope) : jest.mocked(evaluateSwellWatchShadow);
  mock.mockRejectedValueOnce(new Error("private-provider-detail"));
  const response = await call();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private-provider-detail");
  expect(log).toHaveBeenCalledWith("[swell-watch-evaluate] shadow evaluation failed");
  expect(evaluateSwellWatchShadow).toHaveBeenCalledTimes(failure === "scope" ? 0 : 1);
});
