/** @jest-environment node */
import { currentWaterQuality, projectCurrentWaterQuality } from "@/lib/services/water-quality/current-status";
import { resolveWaterQualityHolds, type WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";
import { processWaterQualityAlerts } from "@/lib/services/water-quality/water-quality-alerts-service";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import type { SupabaseServiceClient } from "@/types/supabase";

jest.mock("@/lib/notifications/enqueue", () => ({ enqueueNotification: jest.fn().mockResolvedValue({ enqueued: true }) }));

const id = "d291411d-d331-4bf1-ad1a-302da3c69de0";
const other = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-09-04T03:30:00Z");
const row = { beach_id: id, status: "advisory", total_samples_30d: 16, latest_enterococcus: 220 };
const run = { id: "44444444-4444-4444-8444-444444444444", status: "completed",
  source_identifier: "county-san-diego-dehq-sdbeachinfo", fetched_at: "2026-09-04T03:00:00Z",
  advisory_count: 0, closure_count: 0, warning_count: 0 };
const notice = { beach_id: null, source_site_identifier: "FM-080", advisory_type: "advisory",
  county_latitude: 32.8548, county_longitude: -117.2598 };

function clientFor(tables: Record<string, unknown>, errorTable?: string): WaterQualityHoldClient {
  return { from: jest.fn((table: string) => {
    const result = { data: tables[table] ?? [], error: table === errorTable ? { message: "Unavailable" } : null };
    interface Query {
      select: jest.Mock; eq: jest.Mock; in: jest.Mock; order: jest.Mock; limit: jest.Mock; gt: jest.Mock; neq: jest.Mock;
      then: (resolve: (value: typeof result) => unknown) => Promise<unknown>;
    }
    const query: Query = {
      select: jest.fn(() => query), eq: jest.fn(() => query), in: jest.fn(() => query),
      order: jest.fn(() => query), limit: jest.fn(() => query),
      gt: jest.fn(() => query), neq: jest.fn(() => query),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  }) } as unknown as WaterQualityHoldClient;
}

describe("current county water-quality contract", () => {
  it.each(["good", "advisory"])("does not send sample-derived %s notifications for county-governed beaches", async (status) => {
    const tables = (beachId: string) => ({
      beach_water_quality: [{ ...row, beach_id: beachId, status, previous_status: status === "good" ? "advisory" : "good", status_changed_at: now.toISOString() }],
      county_beach_advisory_runs: [{ ...run, fetched_at: new Date().toISOString() }],
      beaches: [{ id: beachId, name: "Test beach", slug: "test-beach" }],
      profiles: [{ id: "test-user", home_beach_id: beachId, notif_water_quality: true, is_mock: false, timezone: "America/Los_Angeles" }],
    });
    jest.mocked(enqueueNotification).mockClear();
    const covered = await processWaterQualityAlerts(clientFor(tables(id)) as unknown as SupabaseServiceClient);
    expect(covered.notificationsSent).toBe(0);
    expect(enqueueNotification).not.toHaveBeenCalled();
    const control = await processWaterQualityAlerts(clientFor(tables(other)) as unknown as SupabaseServiceClient);
    expect(control.notificationsSent).toBe(1);
    expect(enqueueNotification).toHaveBeenCalledTimes(1);
  });
  it("supersedes old sample status without claiming good water or mutating source data", () => {
    const result = projectCurrentWaterQuality([row], run, [], [], now)[0];
    expect(result).toMatchObject({ status: "unknown", county_advisory_status: "clear", county_checked_at: run.fetched_at });
    expect(result).not.toHaveProperty("sample_status");
    expect(row.status).toBe("advisory");
  });
  it.each(["advisory", "warning", "closure"])("honors unmatched local %s notices", (type) => {
    const result = projectCurrentWaterQuality([row], { ...run, [`${type}_count`]: 1 },
      [{ ...notice, advisory_type: type }], [], now)[0];
    expect(result.status).toBe(type === "closure" ? "closure" : "advisory");
  });
  it("checks geography even when a notice is mapped to another beach", () => {
    expect(projectCurrentWaterQuality([row], { ...run, advisory_count: 1 },
      [{ ...notice, beach_id: other }], [], now)[0].status).toBe("advisory");
  });
  it("does not let a distant notice hold Shores", () => {
    expect(projectCurrentWaterQuality([row], { ...run, advisory_count: 1 },
      [{ ...notice, county_latitude: 32.6 }], [], now)[0].county_advisory_status).toBe("clear");
  });
  it("preserves manual holds and uncovered beaches", () => {
    expect(projectCurrentWaterQuality([row], run, [], [{ beach_id: id }], now)).toEqual([row]);
    const uncovered = { ...row, beach_id: other };
    expect(projectCurrentWaterQuality([uncovered], run, [], [], now)).toEqual([uncovered]);
  });
  it.each([
    ["missing", null, []],
    ["failed", { ...run, status: "failed" }, []],
    ["stale", { ...run, fetched_at: "2026-09-04T01:30:00Z" }, []],
    ["future", { ...run, fetched_at: "2026-09-04T04:00:00Z" }, []],
    ["incomplete", { ...run, advisory_count: 1 }, []],
    ["malformed", { ...run, advisory_count: 1 }, [{ ...notice, county_latitude: null }]],
    ["duplicate", { ...run, advisory_count: 2 }, [notice, notice]],
  ])("reports unavailable and retains conservative hold on %s data", (_name, snapshot, notices) => {
    expect(projectCurrentWaterQuality([row], snapshot, notices, [], now)[0]).toMatchObject({
      status: "advisory", county_advisory_status: "unavailable",
    });
  });
  it("fails closed on query errors and does not fall back to older completed runs", async () => {
    const tables = { county_beach_advisory_runs: [run] };
    expect((await currentWaterQuality([row], clientFor(tables, "county_beach_advisories"), now))[0].county_advisory_status).toBe("unavailable");
    expect((await currentWaterQuality([row], clientFor({ county_beach_advisory_runs: [{ ...run, status: "failed" }, run] }), now))[0].county_advisory_status).toBe("unavailable");
  });
  it.each([false, true])("recommendation resolver respects county status with zero samples (active=%s)", async (active) => {
    const client = clientFor({ beach_water_quality: [{ ...row, total_samples_30d: 0 }],
      county_beach_advisory_runs: [{ ...run, advisory_count: active ? 1 : 0 }],
      county_beach_advisories: active ? [notice] : [] });
    const result = await resolveWaterQualityHolds([{ candidateId: "test", beachId: id,
      startsAt: now.toISOString(), endsAt: "2026-09-04T04:30:00Z" }], { client, now });
    expect(result.heldBeachIds).toEqual(active ? [id] : []);
  });
});
