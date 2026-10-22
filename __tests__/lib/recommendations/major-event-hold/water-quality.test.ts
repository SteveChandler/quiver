/**
 * @jest-environment node
 */

import { createHash } from "node:crypto";

import {
  CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS,
  resolveWaterQualityHolds,
  supportsCountyRunQuery,
  supportsCountyStreakQuery,
  type WaterQualityHoldClient,
} from "@/lib/recommendations/major-event-hold/water-quality";
import * as currentStatus from "@/lib/services/water-quality/current-status";
import type { MajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/types";
import {
  expectConsoleErrors,
  expectConsoleWarnings,
} from "@/__tests__/setup/test-utils";

jest.mock("@/lib/services/water-quality/current-status", () => {
  const actual = jest.requireActual("@/lib/services/water-quality/current-status");
  return { ...actual, currentWaterQuality: jest.fn(actual.currentWaterQuality) };
});

const BEACH_A = "11111111-1111-4111-8111-111111111111";
const BEACH_B = "22222222-2222-4222-8222-222222222222";
const BEACH_C = "33333333-3333-4333-8333-333333333333";

function candidate(beachId: string): MajorEventHoldCandidate {
  return {
    candidateId: `candidate:${beachId}`,
    beachId,
    startsAt: "2026-08-13T10:00:00.000Z",
    endsAt: "2026-08-13T11:00:00.000Z",
  };
}

function clientFor(args: {
  ownerRows?: unknown;
  qualityRows?: unknown;
  liveRunRows?: unknown;
  liveRows?: unknown;
  beachRows?: unknown;
  beachError?: unknown;
  rainEventRows?: unknown;
  rainEventError?: unknown;
  ownerError?: unknown;
  qualityError?: unknown;
  liveError?: unknown;
}): WaterQualityHoldClient {
  return {
    from: jest.fn((table) => {
      const result: { data: unknown; error: unknown } =
        table === "water_quality_held_beaches"
          ? { data: args.ownerRows ?? [], error: args.ownerError ?? null }
          : table === "beach_water_quality"
            ? { data: args.qualityRows ?? [], error: args.qualityError ?? null }
            : table === "county_beach_advisory_runs"
              ? {
                  data:
                    args.liveRunRows ?? [
                      {
                        id: "44444444-4444-4444-8444-444444444444",
                        fetched_at: new Date().toISOString(),
                        status: "completed",
                        advisory_count: 0,
                        source_identifier: "county-san-diego-dehq-sdbeachinfo",
                      },
                    ],
                  error: args.liveError ?? null,
                }
              : table === "beaches"
                ? { data: args.beachRows ?? [], error: args.beachError ?? null }
                : table === "rain_advisory_events"
                  ? { data: args.rainEventRows ?? [], error: args.rainEventError ?? null }
                  : { data: args.liveRows ?? [], error: args.liveError ?? null };
      type MockQuery = {
        in: () => PromiseLike<typeof result>;
        eq: () => MockQuery;
        order: () => MockQuery;
        limit: () => MockQuery;
        then: <TResult1 = typeof result, TResult2 = never>(
          onfulfilled?:
            | ((value: typeof result) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) => PromiseLike<TResult1 | TResult2>;
      };
      const query: MockQuery = {
        in: jest.fn(async () => result),
        eq: jest.fn(() => query),
        order: jest.fn(() => query),
        limit: jest.fn(() => query),
        then: (onfulfilled, onrejected) =>
          Promise.resolve(result).then(onfulfilled, onrejected),
      };
      return { select: jest.fn(() => query) };
    }),
  } as unknown as WaterQualityHoldClient;
}

describe("water-quality recommendation holds", () => {
  it("keeps run-query clients usable when they cannot answer streak queries", () => {
    const query = clientFor({}).from("county_beach_advisory_runs").select("id");
    expect(supportsCountyRunQuery(query)).toBe(true);
    expect(supportsCountyStreakQuery(query)).toBe(false);
  });

  it.each([
    [0, "county-general:dormant"],
    [86, "county-general:unknown"],
  ])("distinguishes the County general snapshot for advisory_count=%i", async (advisoryCount, generalSnapshot) => {
    const checkedAt = "2026-10-15T20:00:00Z";
    const result = await resolveWaterQualityHolds([candidate(BEACH_A)], {
      now: new Date("2026-10-15T20:30:00Z"),
      client: clientFor({ liveRunRows: [{ id: "44444444-4444-4444-8444-444444444444", fetched_at: checkedAt,
        status: "completed", advisory_count: advisoryCount, source_identifier: "county-san-diego-dehq-sdbeachinfo" }] }),
    });
    const snapshot = [`${BEACH_A}:fallback:allow`, `county-live:fresh:${checkedAt}`, generalSnapshot, "county-live:held:"];
    expect(result.state).toBe("resolved");
    expect(result.epoch).toBe(createHash("sha256").update(`water-quality:v2|${snapshot.sort().join("|")}`).digest("hex"));
  });

  it.each([false, true])("bounds catalog queries and preserves failure status (failed batch: %s)", async (failBatch) => {
    const ids = Array.from({ length: 250 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`);
    const client = clientFor({});
    const originalFrom = client.from;
    const batches: Record<string, string[][]> = {};
    client.from = (table) => {
      const original = originalFrom(table);
      if (table !== "water_quality_held_beaches" && table !== "beach_water_quality") return original;
      return { select: (columns) => {
        const query = original.select(columns);
        query.in = async (_column, batch) => {
          (batches[table] ??= []).push([...batch]);
          if (batch.length > 100 || (failBatch && table === "beach_water_quality" && batch.includes(ids[150]))) {
            return { data: null, error: { message: "batch unavailable" } };
          }
          return { data: table === "water_quality_held_beaches" ? batch.map((beach_id) => ({ beach_id })) : [], error: null };
        };
        return query;
      } };
    };
    const check = async () => {
      const result = await resolveWaterQualityHolds(ids.map(candidate), { client });
      expect(result.state).toBe(failBatch ? "unresolved" : "resolved");
      expect(result.heldBeachIds).toEqual(ids);
      expect(batches.water_quality_held_beaches.map((batch) => batch.length)).toEqual([100, 100, 50]);
      expect(batches.beach_water_quality.every((batch) => batch.length <= 100)).toBe(true);
    };
    await check();
    if (failBatch) expectConsoleErrors([/\[water-quality-hold:query-error\]/]);
  });

  it("starts live county holds while current sample projection is pending", async () => {
    const now = new Date();
    const sample = { beach_id: BEACH_A, status: "advisory", total_samples_30d: 1, latest_sample_date: now.toISOString() };
    let release!: (rows: typeof sample[]) => void;
    let started!: () => void;
    const pending = new Promise<typeof sample[]>((resolve) => { release = resolve; });
    const projectionStarted = new Promise<void>((resolve) => { started = resolve; });
    jest.mocked(currentStatus.currentWaterQuality).mockImplementationOnce(() => {
      started();
      return pending;
    });
    const client = clientFor({
      qualityRows: [sample],
      liveRows: [{ beach_id: BEACH_B, advisory_type: "closure", source_site_identifier: "county-b" }],
    });
    const result = resolveWaterQualityHolds([candidate(BEACH_A), candidate(BEACH_B)], { client, now });
    try {
      await projectionStarted;
      expect(client.from).toHaveBeenCalledWith("county_beach_advisory_runs");
    } finally {
      release([sample]);
    }
    await expect(result).resolves.toMatchObject({
      state: "resolved",
      heldBeachIds: [BEACH_A, BEACH_B],
      waterQualityStatusByBeachId: { [BEACH_A]: "advisory", [BEACH_B]: "closure" },
    });
  });

  it("ships the five-beach seed manifest, including Silver Strand", () => {
    expect(CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS).toHaveLength(5);
    expect(CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS).toContain(
      "94f1010b-c71f-4025-bda1-c26ed9467c85",
    );
  });

  it("treats owner holds and sampled advisories/closures as held", async () => {
    const resolution = await resolveWaterQualityHolds(
      [candidate(BEACH_A), candidate(BEACH_B), candidate(BEACH_C)],
      {
        client: clientFor({
          ownerRows: [{ beach_id: BEACH_A }],
          qualityRows: [
            { beach_id: BEACH_A, status: "good", total_samples_30d: 1 },
            { beach_id: BEACH_B, status: "advisory", total_samples_30d: 2, latest_sample_date: new Date().toISOString() },
            { beach_id: BEACH_C, status: "closure", total_samples_30d: 1, latest_sample_date: new Date().toISOString() },
          ],
        }),
      },
    );

    expect(resolution.state).toBe("resolved");
    expect(resolution.heldBeachIds).toEqual([BEACH_A, BEACH_B, BEACH_C]);
  });

  it("starts owner and sampled water-quality reads concurrently", async () => {
    type DeferredQueryResult = { data: unknown; error: unknown };
    type DeferredQuery = {
      in: () => PromiseLike<DeferredQueryResult>;
      eq: (column: string, value: string) => DeferredQuery;
      order: (
        column: string,
        options?: { ascending?: boolean },
      ) => DeferredQuery;
      limit: (count: number) => DeferredQuery;
      then<TResult1 = DeferredQueryResult, TResult2 = never>(
        onfulfilled?:
          | ((
              value: DeferredQueryResult,
            ) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | null,
      ): PromiseLike<TResult1 | TResult2>;
    };
    const startedTables: string[] = [];
    let resolveOwnerQuery!: (value: DeferredQueryResult) => void;
    let resolveQualityQuery!: (value: DeferredQueryResult) => void;
    const ownerQuery = new Promise<DeferredQueryResult>(
      (resolve) => {
        resolveOwnerQuery = resolve;
      },
    );
    const qualityQuery = new Promise<DeferredQueryResult>(
      (resolve) => {
        resolveQualityQuery = resolve;
      },
    );
    const client: WaterQualityHoldClient = {
      from: jest.fn((table) => {
        const result =
          table === "water_quality_held_beaches"
            ? ownerQuery
            : table === "beach_water_quality"
              ? qualityQuery
              : table === "county_beach_advisory_runs"
                ? Promise.resolve({
                    data: [
                      {
                        id: "44444444-4444-4444-8444-444444444444",
                        fetched_at: new Date().toISOString(),
                      },
                    ],
                    error: null,
                  })
              : Promise.resolve({ data: [], error: null });
        const query: DeferredQuery = {
          in: jest.fn(() => {
            startedTables.push(table);
            return result;
          }),
          eq: jest.fn(() => query),
          order: jest.fn(() => query),
          limit: jest.fn(() => query),
          then: <TResult1 = DeferredQueryResult, TResult2 = never>(
            onfulfilled?:
              | ((
                  value: DeferredQueryResult,
                ) => TResult1 | PromiseLike<TResult1>)
              | null,
            onrejected?:
              | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
              | null,
          ) => Promise.resolve(result).then(onfulfilled, onrejected),
        };
        return { select: jest.fn(() => query) };
      }),
    } as unknown as WaterQualityHoldClient;

    const resolutionPromise = resolveWaterQualityHolds([candidate(BEACH_A)], {
      client,
    });

    expect(startedTables).toEqual([
      "water_quality_held_beaches",
      "beach_water_quality",
    ]);

    resolveOwnerQuery({ data: [], error: null });
    resolveQualityQuery({ data: [], error: null });
    await expect(resolutionPromise).resolves.toMatchObject({
      state: "resolved",
      heldBeachIds: [],
    });
  });

  it("fails open on a missing owner table without waiting for sampled quality", async () => {
    type QueryResult = { data: unknown; error: unknown };
    type Query = {
      in: () => PromiseLike<QueryResult>;
      eq: () => Query;
      order: () => Query;
      limit: () => Query;
      then<TResult1 = QueryResult, TResult2 = never>(
        onfulfilled?:
          | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | null,
      ): PromiseLike<TResult1 | TResult2>;
    };
    let rejectQuality!: (reason: unknown) => void;
    const qualityQuery = new Promise<QueryResult>((_, reject) => {
      rejectQuality = reject;
    });
    const client: WaterQualityHoldClient = {
      from: jest.fn((table) => {
        const result: PromiseLike<QueryResult> =
          table === "water_quality_held_beaches"
            ? Promise.resolve({ data: [], error: { code: "42P01" } })
            : table === "beach_water_quality"
              ? qualityQuery
              : Promise.resolve({ data: [], error: null });
        const query: Query = {
          in: jest.fn(() => result),
          eq: jest.fn(() => query),
          order: jest.fn(() => query),
          limit: jest.fn(() => query),
          then: (onfulfilled, onrejected) =>
            Promise.resolve(result).then(onfulfilled, onrejected),
        };
        return { select: jest.fn(() => query) };
      }),
    } as unknown as WaterQualityHoldClient;

    const resolution = await resolveWaterQualityHolds([candidate(BEACH_A)], {
      client,
    });
    expectConsoleWarnings([/\[water-quality-hold:table-missing\]/]);

    expect(resolution).toMatchObject({ state: "resolved", heldBeachIds: [] });
    rejectQuality(new Error("sampled lookup failed"));
    await Promise.resolve();
  });

  it("allows unknown or unsampled status but excludes every beach on lookup failure", async () => {
    const allowed = await resolveWaterQualityHolds([candidate(BEACH_A)], {
      client: clientFor({
        qualityRows: [{ beach_id: BEACH_A, status: "unknown", total_samples_30d: 0 }],
      }),
    });
    const failed = await resolveWaterQualityHolds([candidate(BEACH_A)], {
      client: clientFor({ qualityError: new Error("database unavailable") }),
    });
    expectConsoleErrors([/\[water-quality-hold:query-error\]/]);

    expect(allowed).toMatchObject({ state: "resolved", heldBeachIds: [] });
    expect(failed).toMatchObject({ state: "unresolved", heldBeachIds: [] });
  });

  it("adds a fresh County closure to the chronic owner hold", async () => {
    const resolution = await resolveWaterQualityHolds([candidate(BEACH_A), candidate(BEACH_B)], {
      client: clientFor({
        ownerRows: [{ beach_id: BEACH_A }],
        qualityRows: [],
        liveRows: [
          {
            beach_id: BEACH_B,
            advisory_type: "closure",
            source_site_identifier: "32.700000,-117.200000",
          },
        ],
      }),
      now: new Date(),
    });

    expect(resolution).toMatchObject({
      state: "resolved",
      heldBeachIds: [BEACH_A, BEACH_B],
    });
  });

  it("returns closure when sampled and County hold sources disagree", async () => {
    const resolution = await resolveWaterQualityHolds([candidate(BEACH_A)], {
      client: clientFor({
        qualityRows: [
          {
            beach_id: BEACH_A,
            status: "advisory",
            total_samples_30d: 2,
          },
        ],
        liveRows: [
          {
            beach_id: BEACH_A,
            advisory_type: "closure",
            source_site_identifier: "32.700000,-117.200000",
          },
        ],
      }),
      now: new Date(),
    });

    expect(resolution).toMatchObject({
      state: "resolved",
      heldBeachIds: [BEACH_A],
      waterQualityStatusByBeachId: {
        [BEACH_A]: "closure",
      },
    });
  });

  const STALE_NOW = new Date("2026-08-14T01:30:00.000Z");
  const STALE_RUN = [
    {
      id: "44444444-4444-4444-8444-444444444444",
      fetched_at: "2026-08-13T22:00:00.000Z",
      status: "completed",
      source_identifier: "county-san-diego-dehq-sdbeachinfo",
    },
  ];
  // Ocean Beach Pier and Pacific Beach sit in San Diego County; Huntington Beach Pier does not.
  const SAN_DIEGO_A = { id: BEACH_A, lat: 32.747, lon: -117.254 };
  const SAN_DIEGO_B = { id: BEACH_B, lat: 32.797, lon: -117.258 };
  const ORANGE_C = { id: BEACH_C, lat: 33.655, lon: -118.004 };

  // 2026-10-02: one stale San Diego County feed withheld every pick statewide.
  it("makes only County-covered beaches unknown when the County snapshot is older than two hours", async () => {
    const client = clientFor({
      ownerRows: [{ beach_id: BEACH_A }],
      qualityRows: [],
      liveRunRows: STALE_RUN,
      beachRows: [SAN_DIEGO_A, SAN_DIEGO_B, ORANGE_C],
    });
    const resolution = await resolveWaterQualityHolds(
      [candidate(BEACH_A), candidate(BEACH_B), candidate(BEACH_C)],
      { client, now: STALE_NOW },
    );

    expect(resolution.state).toBe("resolved");
    expect(resolution.heldBeachIds).toEqual([BEACH_A]);
    expect(resolution.unverifiedBeachIds).toEqual([BEACH_B]);
    // Unknown is not a closure: nothing labels the unverified beach.
    expect(resolution.waterQualityStatusByBeachId).not.toHaveProperty(BEACH_B);
    expect(resolution.waterQualityEvidenceByBeachId ?? {}).not.toHaveProperty(BEACH_B);
  });

  it("fails closed for a beach whose coordinates are missing while the County snapshot is stale", async () => {
    const resolution = await resolveWaterQualityHolds([candidate(BEACH_B), candidate(BEACH_C)], {
      client: clientFor({ liveRunRows: STALE_RUN, beachRows: [ORANGE_C] }),
      now: STALE_NOW,
    });

    expect(resolution.state).toBe("resolved");
    expect(resolution.unverifiedBeachIds).toEqual([BEACH_B]);
  });

  it("keeps the whole resolution unresolved when County coverage cannot be read", async () => {
    const resolution = await resolveWaterQualityHolds([candidate(BEACH_A), candidate(BEACH_C)], {
      client: clientFor({
        ownerRows: [{ beach_id: BEACH_A }],
        liveRunRows: STALE_RUN,
        beachError: { message: "beaches unavailable" },
      }),
      now: STALE_NOW,
    });

    expect(resolution.state).toBe("unresolved");
    expect(resolution.heldBeachIds).toEqual([BEACH_A]);
    expectConsoleErrors([/\[water-quality-hold:county-coverage-error\]/]);
  });

  it("does not read beach coordinates while the County snapshot is fresh", async () => {
    const client = clientFor({ beachRows: [SAN_DIEGO_A] });
    const resolution = await resolveWaterQualityHolds([candidate(BEACH_A)], { client });

    expect(resolution.state).toBe("resolved");
    expect(resolution.unverifiedBeachIds ?? []).toEqual([]);
    expect((client.from as jest.Mock).mock.calls.map(([table]) => table)).not.toContain("beaches");
  });

  it("uses live County closure evidence for an owner-held beach", async () => {
    const beachId = CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS[0];
    const checkedAt = "2026-10-15T20:00:00Z";
    const result = await resolveWaterQualityHolds([candidate(beachId)], {
      now: new Date("2026-10-15T20:30:00Z"),
      client: clientFor({
        ownerRows: [{ beach_id: beachId }],
        qualityRows: [{ beach_id: beachId, status: "advisory", total_samples_30d: 8, latest_sample_date: "2026-09-01" }],
        liveRunRows: [{ id: "44444444-4444-4444-8444-444444444444", fetched_at: checkedAt,
          status: "completed", advisory_count: 0, source_identifier: "county-san-diego-dehq-sdbeachinfo" }],
        liveRows: [{ beach_id: beachId, advisory_type: "closure", source_site_identifier: "imperial-beach" }],
      }),
    });

    expect(result.state).toBe("resolved");
    expect(result.heldBeachIds).toEqual([beachId]);
    expect(result.waterQualityStatusByBeachId).toEqual({ [beachId]: "closure" });
    expect(result.waterQualityEvidenceByBeachId).toEqual({
      [beachId]: { source: "county", countyKind: "site", checkedAt },
    });
  });

  it("retains an owner-held beach's stale sample advisory status without a County notice", async () => {
    const beachId = CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS[0];
    const result = await resolveWaterQualityHolds([candidate(beachId)], {
      now: new Date("2026-10-15T20:30:00Z"),
      client: clientFor({
        ownerRows: [{ beach_id: beachId }],
        qualityRows: [{ beach_id: beachId, status: "advisory", total_samples_30d: 8, latest_sample_date: "2026-09-01" }],
        liveRunRows: [{ id: "44444444-4444-4444-8444-444444444444", fetched_at: "2026-10-15T20:00:00Z",
          status: "completed", advisory_count: 0, source_identifier: "county-san-diego-dehq-sdbeachinfo" }],
        liveRows: [],
      }),
    });

    expect(result.state).toBe("resolved");
    expect(result.heldBeachIds).toEqual([beachId]);
    expect(result.waterQualityStatusByBeachId).toEqual({ [beachId]: "advisory" });
    expect(result.waterQualityEvidenceByBeachId).toEqual({ [beachId]: { source: "hold" } });
  });
});

 test("preserves the actual sample date and distinguishes live county evidence", async () => {
  const sampleDate = new Date().toISOString();
  const result = await resolveWaterQualityHolds([candidate(BEACH_A), candidate(BEACH_B)], { client: clientFor({ qualityRows: [{ beach_id: BEACH_A, status: "advisory", total_samples_30d: 8, latest_sample_date: sampleDate }], liveRows: [{ beach_id: BEACH_B, advisory_type: "advisory", source_site_identifier: "site-b" }] }) });
  expect(result.waterQualityEvidenceByBeachId).toMatchObject({ [BEACH_A]: { source: "sample", sampleDate }, [BEACH_B]: { source: "county", countyKind: "site", checkedAt: expect.any(String) } });
  expect(result.heldBeachIds).toEqual([BEACH_A, BEACH_B]);
});

 test.each([7, 14, 30])("does not hold a beach for a %i-day-old sample, but retains county and owner holds", async (days) => {
  const now = new Date();
  const latest_sample_date = new Date(now.getTime() - days * 86400000).toISOString();
  const result = await resolveWaterQualityHolds([candidate(BEACH_A), candidate(BEACH_B), candidate(BEACH_C)], {
    now, client: clientFor({
      qualityRows: [BEACH_A, BEACH_B, BEACH_C].map(beach_id => ({ beach_id, status: "advisory", total_samples_30d: 8, latest_sample_date })),
      ownerRows: [{ beach_id: BEACH_C }],
      liveRows: [{ beach_id: BEACH_B, advisory_type: "closure", source_site_identifier: "site-b" }],
    }),
  });
  expect(result.heldBeachIds).toEqual([BEACH_B, BEACH_C]);
  expect(result.waterQualityEvidenceByBeachId).toMatchObject({ [BEACH_A]: { source: "sample", sampleDate: latest_sample_date }, [BEACH_B]: { source: "county", countyKind: "site", checkedAt: expect.any(String) }, [BEACH_C]: { source: "hold" } });
  expect(result.waterQualityStatusByBeachId).not.toHaveProperty(BEACH_A);
});

describe("rain runoff holds", () => {
  // Oct 22 2026: 0.23 in at KSAN overnight; the County had not posted a general advisory by the 6 AM Daily Call.
  const now = new Date("2026-10-22T13:08:00Z");
  const solana = { id: BEACH_A, lat: 32.991, lon: -117.272 };
  const huntington = { id: BEACH_B, lat: 33.655, lon: -118.005 };
  const santaCruz = { id: BEACH_C, lat: 36.96, lon: -122.02 };
  const fresh = [{ id: "44444444-4444-4444-8444-444444444444", fetched_at: "2026-10-22T13:00:43Z",
    status: "completed", advisory_count: 7, source_identifier: "county-san-diego-dehq-sdbeachinfo" }];
  const gaugeEvent = (overrides: Record<string, unknown> = {}) => ({
    id: "55555555-5555-4555-8555-555555555555", region: "san_diego_gauges", source: "metar_runoff",
    status: "active", started_at: "2026-10-22T12:00:00Z", last_rain_at: "2026-10-22T11:00:00Z",
    expires_at: "2026-10-25T11:00:00Z", ended_at: null, end_reason: null,
    sources: { metar: { stations: ["KSAN"], total_in: 0.23 } },
    created_at: "2026-10-22T12:00:00Z", updated_at: "2026-10-22T12:00:00Z", ...overrides,
  });

  it("holds a San Diego beach on its own gauges before the County posts, until 72 hours after the rain", async () => {
    const result = await resolveWaterQualityHolds([candidate(BEACH_A), candidate(BEACH_C)], {
      now, client: clientFor({ liveRunRows: fresh, beachRows: [solana, santaCruz], rainEventRows: [gaugeEvent()] }),
    });
    expect(result.state).toBe("resolved");
    expect(result.heldBeachIds).toEqual([BEACH_A]);
    expect(result.waterQualityStatusByBeachId).toEqual({ [BEACH_A]: "advisory" });
    expect(result.heldUntilByBeachId).toEqual({ [BEACH_A]: "2026-10-25T11:00:00Z" });
    expect(result.waterQualityEvidenceByBeachId?.[BEACH_A]).toEqual({ source: "rain", rainAdvisory: {
      startedAt: "2026-10-22T12:00:00Z", lastRainAt: "2026-10-22T11:00:00Z", expiresAt: "2026-10-25T11:00:00Z" } });
  });

  it("reads each region's own event and ignores the County's and lapsed ones", async () => {
    const county = gaugeEvent({ id: "66666666-6666-4666-8666-666666666666", region: "san_diego",
      source: "county_general", last_rain_at: null, sources: {} });
    const lapsed = gaugeEvent({ id: "77777777-7777-4777-8777-777777777777", region: "huntington_newport",
      expires_at: "2026-10-22T13:00:00Z", last_rain_at: "2026-10-19T13:00:00Z" });
    const result = await resolveWaterQualityHolds([candidate(BEACH_A), candidate(BEACH_B)], {
      now, client: clientFor({ liveRunRows: fresh, beachRows: [solana, huntington], rainEventRows: [county, lapsed] }),
    });
    expect(result.heldBeachIds).toEqual([]);
    expect(result).not.toHaveProperty("heldUntilByBeachId");
  });

  it("leaves a beach another source holds on that source's evidence", async () => {
    const result = await resolveWaterQualityHolds([candidate(BEACH_A)], {
      now, client: clientFor({ ownerRows: [{ beach_id: BEACH_A }], liveRunRows: fresh, beachRows: [solana],
        rainEventRows: [gaugeEvent()] }),
    });
    expect(result.waterQualityEvidenceByBeachId?.[BEACH_A]).toEqual({ source: "hold" });
    expect(result).not.toHaveProperty("heldUntilByBeachId");
  });

  it("does not read coordinates when no rain event is active", async () => {
    const client = clientFor({ liveRunRows: fresh, beachRows: [solana] });
    const result = await resolveWaterQualityHolds([candidate(BEACH_A)], { now, client });
    expect(result.heldBeachIds).toEqual([]);
    expect((client.from as jest.Mock).mock.calls.map(([table]) => table)).not.toContain("beaches");
  });

  it("holds nothing on rain when beach coordinates cannot be read", async () => {
    const result = await resolveWaterQualityHolds([candidate(BEACH_A), candidate(BEACH_C)], {
      now, client: clientFor({ liveRunRows: fresh, beachError: { message: "down" }, rainEventRows: [gaugeEvent()] }),
    });
    expect(result.state).toBe("resolved");
    expect(result.heldBeachIds).toEqual([]);
    expect(result).not.toHaveProperty("unverifiedBeachIds");
    expectConsoleErrors([/rain-coverage-error/]);
  });

  it("withholds only gauged beaches when the events cannot be read", async () => {
    const result = await resolveWaterQualityHolds([candidate(BEACH_A), candidate(BEACH_C)], {
      now, client: clientFor({ liveRunRows: fresh, beachRows: [solana, santaCruz], rainEventError: { message: "down" } }),
    });
    expect(result.state).toBe("resolved");
    expect(result.heldBeachIds).toEqual([]);
    expect(result.unverifiedBeachIds).toEqual([BEACH_A]);
    expectConsoleErrors([/rain-events-unavailable/]);
  });
});
