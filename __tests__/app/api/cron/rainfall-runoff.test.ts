/** @jest-environment node */
import { GET } from "@/app/api/cron/rainfall-runoff/route";
import { runRainfallRunoffIngest } from "@/lib/services/water-quality/rainfall-runoff-ingest";
import { syncMetarRainAdvisories } from "@/lib/services/water-quality/rain-advisory-events-sync";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const upsert = jest.fn(async () => ({ error: null }));
const prune = jest.fn(async () => ({ error: null }));
jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));
jest.mock("@/lib/middleware/api-wrappers", () => ({ validateCronRequest: jest.fn(() => true) }));
jest.mock("@/lib/cron/observability", () => ({ withObservedCron: jest.fn((_route, handler) => handler) }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn(() => ({
  from: () => ({ upsert, delete: () => ({ lt: prune }) }),
})) }));
jest.mock("@/lib/services/water-quality/rainfall-runoff-ingest", () => ({
  fetchAwcMetars: jest.fn(), runRainfallRunoffIngest: jest.fn(),
}));
jest.mock("@/lib/services/water-quality/rain-advisory-events-sync", () => ({
  syncMetarRainAdvisories: jest.fn(),
}));

it("still writes rainfall readings and returns 200 when event sync reports a missing table", async () => {
  delete process.env.RAIN_ADVISORY_PUSH_ENABLED;
  (runRainfallRunoffIngest as jest.Mock).mockImplementation(async ({ writeReadings }) => {
    await writeReadings([{ cluster_id: "huntington_newport", window_end: "2026-10-18T12:00:00Z",
      total_in: 0.3, station_totals: { KLGB: 0.3 } }]);
    return { written: 1, skipped: [], readings: [], signals: [{ region: "huntington_newport" }] };
  });
  (syncMetarRainAdvisories as jest.Mock).mockResolvedValue({ status: "table_missing" });
  const response = await GET(new Request("http://localhost/api/cron/rainfall-runoff"));
  expect(response.status).toBe(200);
  expect(upsert).toHaveBeenCalledTimes(1);
  expect(prune).toHaveBeenCalledTimes(1);
  expect(syncMetarRainAdvisories).toHaveBeenCalledWith(expect.anything(), [{ region: "huntington_newport" }], expect.any(Date));
  expect((await response.json()).data).toMatchObject({
    rainAdvisory: { status: "table_missing" }, rainAdvisoryPush: { status: "disabled" },
  });
  expectConsoleWarnings([/rain advisory events table missing/]);
});
