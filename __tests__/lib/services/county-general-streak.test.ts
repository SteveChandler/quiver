/** @jest-environment node */
import { resolveCountyGeneralAdvisory } from "@/lib/services/county-beach-advisories/general-streak";
import type { WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";
import { resolveWaterQualityHolds } from "@/lib/recommendations/major-event-hold/water-quality";
import { currentWaterQuality } from "@/lib/services/water-quality/current-status";

const source = "county-san-diego-dehq-sdbeachinfo";
const baseline = { id: "11111111-1111-4111-8111-111111111111", fetched_at: "2026-10-11T13:30:43Z", advisory_count: 7, status: "completed", source_identifier: source };
const first = { ...baseline, id: "22222222-2222-4222-8222-222222222222", fetched_at: "2026-10-11T14:00:43Z", advisory_count: 86 };
const latest = { ...first, id: "33333333-3333-4333-8333-333333333333", fetched_at: "2026-10-14T20:00:43Z", closure_count: 10, warning_count: 0 };

function clientFor(runs: unknown[], notices: unknown[] = [], fail = false, extras: Record<string, unknown[]> = {}): WaterQualityHoldClient {
  return { from: jest.fn((table: string) => {
    let rows = table === "county_beach_advisory_runs" ? runs : table === "county_beach_advisories" ? notices : extras[table] ?? [];
    const result = () => ({ data: rows, error: fail ? new Error("read failed") : null });
    let query: {
      select: jest.Mock; eq: jest.Mock; lt: jest.Mock; gt: jest.Mock;
      order: jest.Mock; limit: jest.Mock; in: jest.Mock;
      then: (resolve: (value: { data: unknown[]; error: unknown }) => unknown) => Promise<unknown>;
    };
    query = {
      select: jest.fn(() => query),
      eq: jest.fn((key: string, value: unknown) => { rows = rows.filter((row) => (row as Record<string, unknown>)[key] === value); return query; }),
      lt: jest.fn((key: string, value: string | number) => { rows = rows.filter((row) => (row as Record<string, string | number>)[key] < value); return query; }),
      gt: jest.fn((key: string, value: string) => { rows = rows.filter((row) => (row as Record<string, string>)[key] > value); return query; }),
      order: jest.fn((key: string, options: { ascending: boolean }) => { rows = [...rows].sort((a, b) => String((a as Record<string, unknown>)[key]).localeCompare(String((b as Record<string, unknown>)[key])) * (options.ascending ? 1 : -1)); return query; }),
      limit: jest.fn((count: number) => { rows = rows.slice(0, count); return query; }),
      in: jest.fn(async (key: string, values: string[]) => { rows = rows.filter((row) => values.includes(String((row as Record<string, unknown>)[key]))); return result(); }),
      then: (resolve: (value: { data: unknown[]; error: unknown }) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  }) } as unknown as WaterQualityHoldClient;
}

const sites = [
  { run_id: baseline.id, advisory_type: "advisory", source_site_identifier: "shipwrecks" },
  ...Array.from({ length: 6 }, (_, index) => ({ run_id: baseline.id, advisory_type: "advisory", source_site_identifier: `site-${index}` })),
  { run_id: baseline.id, advisory_type: "closure", source_site_identifier: "closure" },
];

describe("County general advisory streak", () => {
  it("does no reads for a dormant run", async () => {
    const client = clientFor([]);
    expect(await resolveCountyGeneralAdvisory(client, { ...latest, advisory_count: 7 }, new Date())).toEqual({ general: false, expired: false, streakStartedAt: null, siteIdentifiers: null });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("keeps the advisory within 72 hours and expires exactly at 72 hours", async () => {
    const client = clientFor([baseline, first, latest], sites);
    const before = await resolveCountyGeneralAdvisory(client, latest, new Date("2026-10-12T20:00:00Z"));
    expect(before).toMatchObject({ general: true, expired: false, streakStartedAt: first.fetched_at });
    expect(before.siteIdentifiers?.has("shipwrecks")).toBe(true);
    expect(before.siteIdentifiers?.size).toBe(7);
    expect((await resolveCountyGeneralAdvisory(client, latest, new Date("2026-10-14T14:00:43Z"))).expired).toBe(true);
  });

  it("ignores failed runs and resets after a completed sub-threshold run", async () => {
    const failed = { ...first, id: "44444444-4444-4444-8444-444444444444", status: "failed", fetched_at: "2026-10-12T10:00:00Z", advisory_count: 0 };
    expect((await resolveCountyGeneralAdvisory(clientFor([baseline, first, failed, latest], sites), latest, new Date("2026-10-14T14:00:43Z"))).streakStartedAt).toBe(first.fetched_at);
    const reset = { ...failed, status: "completed", fetched_at: "2026-10-13T10:00:00Z" };
    expect((await resolveCountyGeneralAdvisory(clientFor([baseline, first, reset, latest], sites), latest, new Date("2026-10-14T20:00:43Z"))).streakStartedAt).toBe(latest.fetched_at);
  });

  it("keeps every advisory active on a baseline error or missing baseline", async () => {
    for (const client of [clientFor([baseline, first, latest], sites, true), clientFor([first, latest], sites),
      clientFor([baseline, first, latest], sites.slice(0, 1))]) {
      expect(await resolveCountyGeneralAdvisory(client, latest, new Date("2026-10-15T00:00:00Z"))).toEqual({ general: true, expired: false, streakStartedAt: null, siteIdentifiers: null });
    }
  });
});

const shores = "d291411d-d331-4bf1-ad1a-302da3c69de0";
const shipwrecks = "5e8d07ff-786c-4b7e-ab19-53d2b3774e23";
const closedBeach = "55555555-5555-4555-8555-555555555555";

function regressionClient(run: typeof latest): WaterQualityHoldClient {
  const advisory = (index: number) => ({ run_id: run.id, advisory_type: "advisory", source_site_identifier: index === 0 ? "shipwrecks" : `general-${index}`,
    beach_id: index === 0 ? shipwrecks : index === 7 ? shores : null,
    county_latitude: index === 0 ? 33.05 : index === 7 ? 32.857 : 32.65,
    county_longitude: index === 0 ? -117.29 : index === 7 ? -117.257 : -117.2 });
  const notices = [
    ...Array.from({ length: 86 }, (_, index) => advisory(index)),
    ...Array.from({ length: 10 }, (_, index) => ({ ...advisory(index + 100), advisory_type: "closure", beach_id: index === 0 ? closedBeach : null,
      county_latitude: index === 0 ? 32.8 : 32.65, county_longitude: index === 0 ? -117.25 : -117.2 })),
    ...Array.from({ length: 7 }, (_, index) => ({ ...advisory(index), run_id: baseline.id })),
  ];
  return clientFor([baseline, first, run], notices, false, {
    beaches: [{ id: shores, lat: 32.857, lon: -117.257 }, { id: shipwrecks, lat: 33.05, lon: -117.29 }, { id: closedBeach, lat: 32.8, lon: -117.25 }],
    beach_water_quality: [shores, shipwrecks, closedBeach].map((beach_id) => ({ beach_id, status: "unknown", total_samples_30d: 0, latest_sample_date: null })),
  });
}

it.each([
  [new Date("2026-10-14T20:30:43Z"), latest, false],
  [new Date("2026-10-12T20:00:00Z"), { ...latest, fetched_at: "2026-10-12T19:30:43Z" }, true],
])("projects and holds the 86-advisory County fixture at %s", async (now, run, generalActive) => {
  const client = regressionClient(run);
  const rows = [shores, shipwrecks, closedBeach].map((beach_id) => ({ beach_id, status: "unknown", total_samples_30d: 0 }));
  const projected = await currentWaterQuality(rows, client, now);
  expect(projected[0].county_advisory_status).toBe(generalActive ? "advisory" : undefined);
  expect(projected[0].status).toBe(generalActive ? "advisory" : "unknown");
  expect(projected[1]).toMatchObject({ county_advisory_status: "advisory", county_advisory_kind: "site" });
  expect(projected[2]).toMatchObject({ county_advisory_status: "closure", county_advisory_kind: "site" });
  const resolution = await resolveWaterQualityHolds([shores, shipwrecks, closedBeach].map((beachId) => ({ candidateId: beachId,
    beachId, startsAt: now.toISOString(), endsAt: new Date(now.getTime() + 3600000).toISOString() })), { client, now });
  expect(resolution.state).toBe("resolved");
  expect(resolution.heldBeachIds).toEqual(generalActive ? [shipwrecks, closedBeach, shores].sort() : [shipwrecks, closedBeach].sort());
  expect(resolution.waterQualityEvidenceByBeachId?.[shipwrecks]).toMatchObject({ source: "county", countyKind: "site", checkedAt: run.fetched_at });
  expect(resolution.waterQualityEvidenceByBeachId?.[closedBeach]).toMatchObject({ source: "county", countyKind: "site", checkedAt: run.fetched_at });
  if (generalActive) expect(resolution.waterQualityEvidenceByBeachId?.[shores]).toMatchObject({ source: "county", countyKind: "general" });
});

it("changes the hold epoch at the 72-hour boundary without a new County run", async () => {
  const client = regressionClient({ ...latest, fetched_at: "2026-10-14T13:30:43Z" });
  const candidates = [shores].map((beachId) => ({ candidateId: beachId, beachId,
    startsAt: "2026-10-14T14:00:00Z", endsAt: "2026-10-14T15:00:00Z" }));
  const before = await resolveWaterQualityHolds(candidates, { client, now: new Date("2026-10-14T14:00:42Z") });
  const after = await resolveWaterQualityHolds(candidates, { client, now: new Date("2026-10-14T14:00:43Z") });
  expect(before.heldBeachIds).toContain(shores);
  expect(after.heldBeachIds).not.toContain(shores);
  expect(after.epoch).not.toBe(before.epoch);
});
