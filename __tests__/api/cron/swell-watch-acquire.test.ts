/** @jest-environment node */
import { GET } from "@/app/api/cron/swell-watch-acquire/route";
import { acquireSwellWatchCohort } from "@/lib/alerts/swell-watch/acquisition";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import deployment from "@/vercel.json";

jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/acquisition", () => ({
  ...jest.requireActual("@/lib/alerts/swell-watch/acquisition"),
  acquireSwellWatchCohort: jest.fn(),
}));
jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: () => { throw new Error("Forbidden send path"); },
}));

const originalEnv = process.env;
const cohort = [{ sourcePointId: "10000000-0000-4000-8000-000000000001", regionKey: "fixture" }];
const receipt = { issuanceId: "issuance", runBatchId: "batch", revisionSetId: "revision" };

it("schedules only acquisition hourly, not the completed-batch POST callback", () => {
  expect(deployment.crons.filter((cron) => cron.path === "/api/cron/swell-watch-acquire"))
    .toEqual([{ path: "/api/cron/swell-watch-acquire", schedule: "15 * * * *" }]);
  expect(deployment.crons.some((cron) => cron.path === "/api/cron/swell-watch-evaluate")).toBe(false);
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createSupabaseServiceRoleClient).mockReturnValue({} as never);
  jest.mocked(acquireSwellWatchCohort).mockResolvedValue(receipt);
  process.env = { ...originalEnv, CRON_SECRET: "fixture-secret",
    SWELL_WATCH_ACQUISITION_ENABLED: "true", SWELL_WATCH_ENABLED: "false",
    SWELL_WATCH_PUSH_ENABLED: "false", SWELL_WATCH_PRODUCER_CONFIG: JSON.stringify({ cohort }) };
});
afterEach(() => { process.env = originalEnv; jest.restoreAllMocks(); });

async function call(token = "fixture-secret", query = ""): Promise<Response> {
  const response = await GET(new Request(`http://localhost/api/cron/swell-watch-acquire${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
  expect(response.headers.get("Cache-Control")).toBe("private, no-store, no-cache, must-revalidate");
  return response;
}

it("authenticates before checking the default-off flag and never collects while disabled", async () => {
  delete process.env.SWELL_WATCH_ACQUISITION_ENABLED;
  expect((await call("wrong")).status).toBe(401);
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { skipped: true, reason: "disabled", enqueued: 0 } });
  expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
});

it("rejects caller-supplied acquisition overrides", async () => {
  expect((await call("fixture-secret", "?run=2026-09-06T00:00Z")).status).toBe(400);
  expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
});

it.each([null, {}, { cohort: [] }, { cohort: [...cohort, ...cohort] },
  { cohort, extra: true }, { cohort: [{ sourcePointId: "bad", regionKey: "fixture" }] },
  { cohort: Array.from({ length: 11 }, (_, i) => ({ sourcePointId: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`, regionKey: "fixture" })) },
])("rejects invalid server configuration: %j", async (config) => {
  process.env.SWELL_WATCH_PRODUCER_CONFIG = JSON.stringify(config);
  expect((await call()).status).toBe(503);
  expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
});

it("captures only the server cohort without treating receipts as qualified evaluations", async () => {
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { ...receipt, qualification: "prototype_unqualified", enqueued: 0 } });
  expect(acquireSwellWatchCohort).toHaveBeenCalledTimes(1);
  expect(acquireSwellWatchCohort).toHaveBeenCalledWith(cohort, expect.anything());
});

it("preserves a busy lease outcome without inventing a receipt", async () => {
  jest.mocked(acquireSwellWatchCohort).mockResolvedValueOnce({ skipped: true, reason: "collection_in_progress", enqueued: 0 });
  const response = await call();
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ skipped: true, reason: "collection_in_progress", qualification: "prototype_unqualified", enqueued: 0 });
});

it("returns a sanitized real failure when collection fails", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(acquireSwellWatchCohort).mockRejectedValueOnce(new Error("private-provider-detail"));
  const response = await call();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private-provider-detail");
  expect(log).toHaveBeenCalledWith("[swell-watch-acquire] acquisition failed");
});
