/** @jest-environment node */
import { syncCountyRainAdvisory, syncMetarRainAdvisories } from "@/lib/services/water-quality/rain-advisory-events-sync";
import type { RainAdvisoryEvent } from "@/lib/services/water-quality/rain-advisory-events";

const now = new Date("2026-10-17T18:00:00Z");
const wet = { region: "huntington_newport", windowEnd: now.toISOString(), totalIn: 0.4,
  lastRainAt: "2026-10-17T17:00:00Z", dryConfirmed: false, stations: ["KLGB", "KSNA"] };
const active: RainAdvisoryEvent = { id: "11111111-1111-4111-8111-111111111111", region: wet.region,
  source: "metar_runoff", status: "active", started_at: "2026-10-12T18:00:00Z",
  last_rain_at: "2026-10-12T17:00:00Z", expires_at: "2026-10-15T17:00:00Z",
  ended_at: null, end_reason: null, sources: {}, created_at: "2026-10-12T18:00:00Z",
  updated_at: "2026-10-12T18:00:00Z" };

function fakeClient(event: RainAdvisoryEvent | null, readError: unknown = null, insertError: unknown = null) {
  const filters: Array<[string, string]> = [];
  const writes: Array<Record<string, unknown>> = [];
  const from = jest.fn(() => {
    let operation: "read" | "insert" | "update" = "read";
    let values: Record<string, unknown> = {};
    const query: {
      select: jest.Mock; eq: jest.Mock; order: jest.Mock; limit: jest.Mock;
      insert: jest.Mock; update: jest.Mock; single: jest.Mock;
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
    } = {
      select: jest.fn(() => query),
      eq: jest.fn((key: string, value: string) => { filters.push([key, value]); return query; }),
      order: jest.fn(() => query), limit: jest.fn(() => query),
      insert: jest.fn((input: Record<string, unknown>) => { operation = "insert"; values = input; writes.push(input); return query; }),
      update: jest.fn((input: Record<string, unknown>) => { operation = "update"; values = input; writes.push(input); return query; }),
      single: jest.fn(async () => ({ data: insertError ? null : { id: active.id }, error: insertError })),
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
        const response = operation === "read" ? { data: event ? [event] : [], error: readError }
          : { data: [values], error: null };
        return Promise.resolve(response).then(resolve);
      },
    };
    return query;
  });
  return { client: { from }, filters, writes };
}

it("returns table_missing for either database code and treats concurrent inserts as no-ops", async () => {
  for (const code of ["42P01", "PGRST205"]) {
    const missing = fakeClient(null, { code });
    await expect(syncMetarRainAdvisories(missing.client, [wet], now)).resolves.toEqual({ status: "table_missing" });
    expect(missing.writes).toEqual([]);
  }
  const concurrent = fakeClient(null, null, { code: "23505" });
  await expect(syncMetarRainAdvisories(concurrent.client, [wet], now)).resolves.toEqual({
    status: "ok", opened: [], extended: [], ended: [],
  });
});

it("ends a County event only after a completed sub-threshold run", async () => {
  const county = fakeClient({ ...active, region: "san_diego", source: "county_general" });
  const result = await syncCountyRainAdvisory(county.client, { id: active.id,
    fetched_at: now.toISOString(), advisory_count: 0 }, now);
  expect(result).toMatchObject({ status: "ok", ended: [{ id: active.id, region: "san_diego" }] });
  expect(county.filters).toContainEqual(["status", "active"]);
  expect(county.writes[0]).toMatchObject({ status: "ended", end_reason: "county_lifted" });
});

it("conditions extend and end writes on an active status", async () => {
  const extended = fakeClient(active);
  expect(await syncMetarRainAdvisories(extended.client, [wet], now)).toMatchObject({ status: "ok",
    extended: [{ id: active.id, region: active.region }] });
  expect(extended.filters).toContainEqual(["status", "active"]);
  expect(extended.writes[0]).toMatchObject({ last_rain_at: wet.lastRainAt,
    expires_at: "2026-10-20T17:00:00.000Z" });
  const ending = fakeClient(active);
  expect(await syncMetarRainAdvisories(ending.client, [{ ...wet, totalIn: 0, lastRainAt: null,
    dryConfirmed: true }], now)).toMatchObject({ status: "ok", ended: [{ id: active.id }] });
  expect(ending.filters).toContainEqual(["status", "active"]);
  expect(ending.writes[0]).toMatchObject({ status: "ended", end_reason: "dry_72h" });
});
