/** @jest-environment node */
import { currentWaterQuality, projectCurrentWaterQuality, unsampledWaterQualityRow } from "@/lib/services/water-quality/current-status";
import { resolveWaterQualityHolds, type WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";
import { processWaterQualityAlerts } from "@/lib/services/water-quality/water-quality-alerts-service";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { COUNTY_GENERAL_ADVISORY_MIN_SITES } from "@/lib/services/county-beach-advisories/types";
import type { SupabaseServiceClient } from "@/types/supabase";

jest.mock("@/lib/notifications/enqueue", () => ({ enqueueNotification: jest.fn().mockResolvedValue({ enqueued: true }) }));

// Real catalog coordinates, checked against the beaches table on 2026-10-12.
const id = "d291411d-d331-4bf1-ad1a-302da3c69de0"; // La Jolla Shores
const pacificBeach = "55555555-5555-4555-8555-555555555555";
const crystalPier = "66666666-6666-4666-8666-666666666666";
const blacks = "77777777-7777-4777-8777-777777777777";
const other = "11111111-1111-4111-8111-111111111111"; // Outside the County feed (Huntington Beach)
const points = new Map<string, { lat: number | null; lon: number | null }>([
  [id, { lat: 32.8567, lon: -117.2575 }],
  [pacificBeach, { lat: 32.797429, lon: -117.258157 }],
  [crystalPier, { lat: 32.795, lon: -117.257 }],
  [blacks, { lat: 32.887, lon: -117.252 }],
  [other, { lat: 33.655, lon: -118.003 }],
]);
const beachRows = [...points].map(([beachId, point]) => ({ id: beachId, ...point }));
const now = new Date("2026-09-04T03:30:00Z");
const row = { beach_id: id, status: "advisory", total_samples_30d: 16, latest_enterococcus: 220 };
const run = { id: "44444444-4444-4444-8444-444444444444", status: "completed",
  source_identifier: "county-san-diego-dehq-sdbeachinfo", fetched_at: "2026-09-04T03:00:00Z",
  advisory_count: 0, closure_count: 0, warning_count: 0 };
const notice = { beach_id: null, source_site_identifier: "FM-080", advisory_type: "advisory",
  county_latitude: 32.8548, county_longitude: -117.2598 };
// The County site sdbeachinfo assigns to Crystal Pier, 374 m from Pacific Beach.
const crystalPierNotice = { beach_id: crystalPier, source_site_identifier: "32.794500,-117.256200",
  advisory_type: "advisory", county_latitude: 32.7945, county_longitude: -117.2562 };

type ProjectionRow = Parameters<typeof projectCurrentWaterQuality>[0][number];
function project(rows: readonly ProjectionRow[], overrides: Partial<Parameters<typeof projectCurrentWaterQuality>[1]> = {}): ReturnType<typeof projectCurrentWaterQuality<ProjectionRow>> {
  return projectCurrentWaterQuality(rows, { run, notices: [], owners: [], points, now, ...overrides });
}

/** A rain-day run: the County lists far more sites than it ever samples at once. */
function generalAdvisory(extra: Array<typeof notice> = []): { run: typeof run; notices: Array<typeof notice> } {
  const filler = Array.from({ length: COUNTY_GENERAL_ADVISORY_MIN_SITES }, (_, i) => ({
    ...notice, source_site_identifier: `bay-${i}`, county_latitude: 32.7, county_longitude: -117.2 }));
  const notices = [...filler, ...extra];
  return {
    run: { ...run, advisory_count: notices.filter((n) => n.advisory_type === "advisory").length,
      closure_count: notices.filter((n) => n.advisory_type === "closure").length },
    notices,
  };
}

function clientFor(tables: Record<string, unknown>, errorTable?: string): WaterQualityHoldClient {
  const withBeaches: Record<string, unknown> = { beaches: beachRows, ...tables };
  return { from: jest.fn((table: string) => {
    const result = { data: withBeaches[table] ?? [], error: table === errorTable ? { message: "Unavailable" } : null };
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
  it("covers every beach inside the County feed, not only La Jolla Shores", async () => {
    const client = clientFor({ county_beach_advisory_runs: [{ ...run, advisory_count: 1 }],
      county_beach_advisories: [crystalPierNotice] });
    const rows = [pacificBeach, blacks, other].map((beachId) => ({ ...row, beach_id: beachId, status: "good" }));
    const [pb, blacksRow, uncovered] = await currentWaterQuality(rows, client, now);
    expect(pb).toMatchObject({ status: "advisory", county_advisory_status: "advisory", county_advisory_kind: "site" });
    expect(blacksRow).toMatchObject({ status: "unknown", county_advisory_status: "clear" });
    expect(uncovered).toEqual(rows[2]);
  });

  it("limits county owner reads to covered beaches even for a full catalog", async () => {
    const catalog = Array.from({ length: 500 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`);
    const client = clientFor({ county_beach_advisory_runs: [run],
      beaches: [...beachRows, ...catalog.map((beachId) => ({ id: beachId, lat: 21.3, lon: -157.8 }))] });
    const rows = [row, ...catalog.map((beachId) => ({ beach_id: beachId, status: "good" }))];
    const result = await currentWaterQuality(rows, client, now);
    const ownerIndex = jest.mocked(client.from).mock.calls.findIndex(([table]) => table === "water_quality_held_beaches");
    const query = jest.mocked(client.from).mock.results[ownerIndex].value;
    expect(query.in).toHaveBeenCalledWith("beach_id", [id]);
    expect(result[0].county_advisory_status).toBe("clear");
    expect(result.slice(1)).toEqual(rows.slice(1));
  });

  it("leaves rows untouched when beach coordinates cannot be read", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await currentWaterQuality([row], clientFor({ county_beach_advisory_runs: [run] }, "beaches"), now);
    expect(result).toEqual([row]);
    expect(consoleError).toHaveBeenCalledWith("[water-quality:county-coverage-error]", expect.anything());
    consoleError.mockRestore();
  });

  it.each(["good", "advisory"])("does not send sample-derived %s notifications for county-governed beaches", async (status) => {
    const tables = (beachId: string) => ({
      beach_water_quality: [{ ...row, beach_id: beachId, status, previous_status: status === "good" ? "advisory" : "good", status_changed_at: now.toISOString() }],
      county_beach_advisory_runs: [{ ...run, fetched_at: new Date().toISOString() }],
      beaches: [{ id: beachId, name: "Test beach", slug: "test-beach", ...points.get(beachId) }],
      profiles: [{ id: "test-user", home_beach_id: beachId, notif_water_quality: true, is_mock: false, timezone: "America/Los_Angeles" }],
    });
    jest.mocked(enqueueNotification).mockClear();
    const covered = await processWaterQualityAlerts(clientFor(tables(pacificBeach)) as unknown as SupabaseServiceClient);
    expect(covered.notificationsSent).toBe(0);
    expect(enqueueNotification).not.toHaveBeenCalled();
    const control = await processWaterQualityAlerts(clientFor(tables(other)) as unknown as SupabaseServiceClient);
    expect(control.notificationsSent).toBe(1);
    expect(enqueueNotification).toHaveBeenCalledTimes(1);
  });

  it("supersedes old sample status without claiming good water or mutating source data", () => {
    const result = project([row])[0];
    expect(result).toMatchObject({ status: "unknown", county_advisory_status: "clear", county_checked_at: run.fetched_at });
    expect(result).not.toHaveProperty("sample_status");
    expect(result).not.toHaveProperty("county_advisory_kind");
    expect(row.status).toBe("advisory");
  });

  it("never reports good water for a covered beach with no notice", () => {
    expect(project([{ ...row, beach_id: blacks, status: "good" }])[0]).toMatchObject({ status: "unknown", county_advisory_status: "clear" });
  });

  it.each(["advisory", "warning", "closure"])("honors unmatched local %s notices", (type) => {
    const result = project([row], { run: { ...run, [`${type}_count`]: 1 },
      notices: [{ ...notice, advisory_type: type }] })[0];
    expect(result.status).toBe(type === "closure" ? "closure" : "advisory");
    expect(result.county_advisory_kind).toBe("site");
  });

  it("applies a notice to every beach within the match radius, not only the nearest", () => {
    const [pb, pier] = project([{ ...row, beach_id: pacificBeach }, { ...row, beach_id: crystalPier }],
      { run: { ...run, advisory_count: 1 }, notices: [crystalPierNotice] });
    expect(pb.status).toBe("advisory");
    expect(pier.status).toBe("advisory");
  });

  it("checks geography even when a notice is mapped to another beach", () => {
    expect(project([row], { run: { ...run, advisory_count: 1 },
      notices: [{ ...notice, beach_id: other }] })[0].status).toBe("advisory");
  });

  it("does not let a distant notice hold Shores", () => {
    expect(project([row], { run: { ...run, advisory_count: 1 },
      notices: [{ ...notice, county_latitude: 32.6 }] })[0].county_advisory_status).toBe("clear");
  });

  it("matches a beach without coordinates only by its assigned notices", () => {
    const unlocated = new Map(points).set(id, { lat: null, lon: null });
    expect(project([row], { points: unlocated, onlyBeachIds: [id], run: { ...run, advisory_count: 1 }, notices: [notice] })[0].county_advisory_status).toBe("clear");
    expect(project([row], { points: unlocated, onlyBeachIds: [id], run: { ...run, advisory_count: 1 },
      notices: [{ ...notice, beach_id: id }] })[0].county_advisory_status).toBe("advisory");
  });

  it("marks every covered beach with a general advisory when the County lists a county-wide set", () => {
    const { run: rainRun, notices } = generalAdvisory();
    const [shores, blacksRow, uncovered] = project(
      [row, { ...row, beach_id: blacks, status: "good" }, { ...row, beach_id: other, status: "good" }],
      { run: rainRun, notices });
    expect(shores).toMatchObject({ status: "advisory", county_advisory_status: "advisory", county_advisory_kind: "general" });
    expect(blacksRow).toMatchObject({ status: "advisory", county_advisory_status: "advisory", county_advisory_kind: "general" });
    expect(uncovered).toEqual({ ...row, beach_id: other, status: "good" });
  });

  it("keeps a local closure above a general advisory", () => {
    const { run: rainRun, notices } = generalAdvisory([{ ...notice, advisory_type: "closure" }]);
    expect(project([row], { run: rainRun, notices })[0]).toMatchObject({
      status: "closure", county_advisory_status: "closure", county_advisory_kind: "site" });
  });

  it("treats an ordinary sampled-advisory count as site notices only", () => {
    const notices = Array.from({ length: COUNTY_GENERAL_ADVISORY_MIN_SITES - 1 }, (_, i) => ({
      ...notice, source_site_identifier: `bay-${i}`, county_latitude: 32.7, county_longitude: -117.2 }));
    expect(project([{ ...row, beach_id: blacks }], { run: { ...run, advisory_count: notices.length }, notices })[0])
      .toMatchObject({ status: "unknown", county_advisory_status: "clear" });
  });

  it("shows County notices on owner-held beaches but never a County clear", () => {
    expect(project([{ ...row, status: "good" }], { owners: [{ beach_id: id }], run: { ...run, closure_count: 1 },
      notices: [{ ...notice, advisory_type: "closure" }] })[0]).toMatchObject({ status: "closure", county_advisory_status: "closure" });
  });

  it("does not cover an unlocated beach unless a caller lists it explicitly", () => {
    const unlocated = new Map(points).set(other, { lat: null, lon: null });
    const { run: rainRun, notices } = generalAdvisory();
    const uncovered = { ...row, beach_id: other, status: "good" };
    expect(project([uncovered], { points: unlocated, run: rainRun, notices })).toEqual([uncovered]);
    expect(project([uncovered], { points: new Map(), run: rainRun, notices })).toEqual([uncovered]);
    expect(project([uncovered], { points: unlocated, run: rainRun, notices, onlyBeachIds: [other] })[0].county_advisory_kind).toBe("general");
  });

  it("projects onto an unsampled placeholder row", () => {
    const { run: rainRun, notices } = generalAdvisory();
    expect(project([unsampledWaterQualityRow(blacks)], { run: rainRun, notices })[0]).toMatchObject({
      beach_id: blacks, status: "advisory", county_advisory_kind: "general", total_samples_30d: 0, latest_sample_date: null });
    expect(unsampledWaterQualityRow(other)).toMatchObject({ status: "unknown", total_samples_30d: 0 });
  });

  it("preserves manual holds and uncovered beaches", () => {
    expect(project([row], { owners: [{ beach_id: id }] })).toEqual([row]);
    const uncovered = { ...row, beach_id: other };
    expect(project([uncovered])).toEqual([uncovered]);
  });

  it("restricts coverage to the requested beaches when asked", () => {
    expect(project([{ ...row, beach_id: blacks }], { onlyBeachIds: [id] })).toEqual([{ ...row, beach_id: blacks }]);
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
    const [shores, blacksRow, uncovered] = project(
      [row, { ...row, beach_id: blacks }, { ...row, beach_id: other }], { run: snapshot, notices });
    expect(shores).toMatchObject({ status: "advisory", county_advisory_status: "unavailable" });
    expect(blacksRow).toMatchObject({ county_advisory_status: "unavailable" });
    expect(uncovered).not.toHaveProperty("county_advisory_status");
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

  it("does not widen recommendation holds to the newly covered beaches", async () => {
    const { run: rainRun, notices } = generalAdvisory();
    const client = clientFor({
      beach_water_quality: [{ ...row, beach_id: blacks, status: "good", latest_sample_date: now.toISOString() }],
      county_beach_advisory_runs: [rainRun], county_beach_advisories: notices });
    const result = await resolveWaterQualityHolds([{ candidateId: "test", beachId: blacks,
      startsAt: now.toISOString(), endsAt: "2026-09-04T04:30:00Z" }], { client, now });
    expect(result.heldBeachIds).toEqual([]);
  });
});
