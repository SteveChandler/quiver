/**
 * @jest-environment node
 */

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { runWithWaterQualityReadScope } from "@/lib/recommendations/major-event-hold/read-scope";
import {
  resolveWaterQualityHolds,
  type WaterQualityHoldClient,
} from "@/lib/recommendations/major-event-hold/water-quality";
import { rankBeaches } from "@/lib/recommendations/selection";
import { currentWaterQuality } from "@/lib/services/water-quality/current-status";
import type { MajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/types";
import {
  expectConsoleErrors,
  expectConsoleWarnings,
} from "@/__tests__/setup/test-utils";

const OWNER_HELD = "11111111-1111-4111-8111-111111111111";
const SAMPLE_HELD = "22222222-2222-4222-8222-222222222222";
const CLEAN = "33333333-3333-4333-8333-333333333333";
// The beach the County projection covers (current-status COVERAGE).
const COUNTY_COVERED = "d291411d-d331-4bf1-ad1a-302da3c69de0";
const RUN_ID = "44444444-4444-4444-8444-444444444444";

type Result = { data: unknown; error: unknown };
type Responder = (table: string, call: number) => Result | undefined;

interface RecordingClient {
  client: WaterQualityHoldClient;
  executions: Record<string, number>;
}

function recordingClient(options: {
  fetchedAt?: string;
  sampleDate?: string;
  respond?: Responder;
} = {}): RecordingClient {
  const executions: Record<string, number> = {};
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();
  const sampleDate = options.sampleDate ?? new Date().toISOString().slice(0, 10);
  const defaults: Record<string, unknown> = {
    water_quality_held_beaches: [{ beach_id: OWNER_HELD }],
    beach_water_quality: [
      { beach_id: SAMPLE_HELD, status: "advisory", total_samples_30d: 4, latest_sample_date: sampleDate },
      { beach_id: CLEAN, status: "good", total_samples_30d: 4, latest_sample_date: sampleDate },
      { beach_id: COUNTY_COVERED, status: "good", total_samples_30d: 4, latest_sample_date: sampleDate },
    ],
    county_beach_advisory_runs: [{
      id: RUN_ID,
      status: "completed",
      source_identifier: "county-san-diego-dehq-sdbeachinfo",
      fetched_at: fetchedAt,
      advisory_count: 0,
      closure_count: 0,
      warning_count: 0,
    }],
    county_beach_advisories: [],
    beaches: [],
  };

  const client = {
    from: (table: string) => ({
      select: () => {
        let beachIds: string[] | null = null;
        const query = {
          eq: () => query,
          order: () => query,
          limit: () => query,
          in: (_column: string, values: readonly string[]) => {
            beachIds = values.map((value) => value.toLowerCase());
            return query;
          },
          then: <T1 = Result, T2 = never>(
            onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
            onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
          ): Promise<T1 | T2> => {
            executions[table] = (executions[table] ?? 0) + 1;
            const custom = options.respond?.(table, executions[table]);
            const rows = defaults[table] as Array<{ beach_id?: string }>;
            const result = custom ?? {
              data: beachIds === null
                ? rows
                : rows.filter((row) => row.beach_id !== undefined && beachIds!.includes(row.beach_id)),
              error: null,
            };
            return Promise.resolve(result).then(onfulfilled, onrejected);
          },
        };
        return query;
      },
    }),
  } as unknown as WaterQualityHoldClient;

  return { client, executions };
}

function useServiceClient(client: WaterQualityHoldClient): void {
  jest.mocked(createSupabaseServiceRoleClient).mockReturnValue(
    client as unknown as ReturnType<typeof createSupabaseServiceRoleClient>,
  );
}

const POOL = [OWNER_HELD, SAMPLE_HELD, CLEAN, COUNTY_COVERED];

/** The order /api/surf/call resolves holds in: pool, discovery ranking, decision. */
async function surfCallShapedResolution(): Promise<string[][]> {
  const rank = async (ids: string[]) =>
    (await rankBeaches(ids.map((id) => ({ id })), { compare: () => 0 })).map(({ id }) => id);
  const pool = await rank(POOL);
  await currentWaterQuality([{ beach_id: COUNTY_COVERED, status: "good" }]);
  const discovery = await rank([SAMPLE_HELD, CLEAN, COUNTY_COVERED]);
  const decision = await rank([CLEAN]);
  return [pool, discovery, decision];
}

function holdCandidate(beachId: string): MajorEventHoldCandidate {
  return {
    candidateId: `candidate:${beachId}`,
    beachId,
    startsAt: "2026-10-05T10:00:00.000Z",
    endsAt: "2026-10-05T11:00:00.000Z",
  };
}

describe("water-quality hold read scope", () => {
  beforeEach(() => {
    jest.mocked(createSupabaseServiceRoleClient).mockReset();
  });

  it("reads each hold table once per request across every layer", async () => {
    const { client, executions } = recordingClient();
    useServiceClient(client);

    const ranked = await runWithWaterQualityReadScope(surfCallShapedResolution);

    expect(ranked).toEqual([
      [CLEAN, COUNTY_COVERED],
      [CLEAN, COUNTY_COVERED],
      [CLEAN],
    ]);
    expect(executions.water_quality_held_beaches).toBe(1);
    expect(executions.beach_water_quality).toBe(1);
    expect(executions.county_beach_advisories).toBe(1);
    // The live hold needs the latest completed run; the County projection must
    // not fall back past a failed run, so it reads the latest run of any status.
    expect(executions.county_beach_advisory_runs).toBe(2);
  });

  it("reads the County run once when no County-projected beach is in play", async () => {
    const { client, executions } = recordingClient();
    useServiceClient(client);

    await runWithWaterQualityReadScope(async () => {
      for (const ids of [[OWNER_HELD, SAMPLE_HELD, CLEAN], [SAMPLE_HELD, CLEAN], [CLEAN]]) {
        await rankBeaches(ids.map((id) => ({ id })), { compare: () => 0 });
      }
    });

    expect(executions).toEqual({
      water_quality_held_beaches: 1,
      beach_water_quality: 1,
      county_beach_advisory_runs: 1,
      county_beach_advisories: 1,
    });
  });

  it("keeps the pre-scope read counts outside a scope", async () => {
    const { client, executions } = recordingClient();
    useServiceClient(client);

    const ranked = await surfCallShapedResolution();

    expect(ranked[0]).toEqual([CLEAN, COUNTY_COVERED]);
    expect(executions).toMatchObject({
      water_quality_held_beaches: 6,
      beach_water_quality: 3,
      county_beach_advisory_runs: 6,
      county_beach_advisories: 6,
    });
  });

  it("never shares reads across requests, including concurrent ones", async () => {
    const { client, executions } = recordingClient();
    useServiceClient(client);

    await runWithWaterQualityReadScope(surfCallShapedResolution);
    await Promise.all([
      runWithWaterQualityReadScope(surfCallShapedResolution),
      runWithWaterQualityReadScope(surfCallShapedResolution),
    ]);

    expect(executions.water_quality_held_beaches).toBe(3);
    expect(executions.beach_water_quality).toBe(3);
    expect(executions.county_beach_advisories).toBe(3);
  });

  it("retries a failed read instead of sharing the failure", async () => {
    const { client, executions } = recordingClient({
      respond: (table, call) =>
        table === "water_quality_held_beaches" && call === 1
          ? { data: null, error: { message: "upstream unavailable" } }
          : undefined,
    });
    useServiceClient(client);

    const ranked = await runWithWaterQualityReadScope(surfCallShapedResolution);

    // The failed pool read fails open, as before; the next layer re-reads and
    // the held beaches are still excluded from what gets recommended.
    expect(ranked[0]).toEqual(POOL);
    expect(ranked[1]).toEqual([CLEAN, COUNTY_COVERED]);
    // Failed pool read, then a fresh read for the County projection and one for
    // the discovery set it did not cover. The failure was never served again.
    expect(executions.water_quality_held_beaches).toBe(3);
    expectConsoleErrors([/water-quality-hold:query-error/]);
    expectConsoleWarnings([/resolver_returned_unresolved|Water-quality probe/i]);
  });

  it("still fails closed on an unexpected row when serving a subset", async () => {
    const stray = "55555555-5555-4555-8555-555555555555";
    const { client } = recordingClient({
      respond: (table) =>
        table === "water_quality_held_beaches"
          ? { data: [{ beach_id: OWNER_HELD }, { beach_id: stray }], error: null }
          : undefined,
    });
    const [superset, subset] = await runWithWaterQualityReadScope(async () => [
      await resolveWaterQualityHolds(POOL.map(holdCandidate), { client }),
      await resolveWaterQualityHolds([CLEAN].map(holdCandidate), { client }),
    ]);

    expect(superset.state).toBe("unresolved");
    expect(subset.state).toBe("unresolved");
    expectConsoleErrors([/water-quality-hold:invalid-row/]);
  });

  it("does not reuse a read for beaches it did not cover", async () => {
    const { client, executions } = recordingClient();
    const outside = "66666666-6666-4666-8666-666666666666";

    await runWithWaterQualityReadScope(async () => {
      await resolveWaterQualityHolds([CLEAN].map(holdCandidate), { client });
      await resolveWaterQualityHolds([CLEAN, outside].map(holdCandidate), { client });
    });

    expect(executions.water_quality_held_beaches).toBe(2);
    expect(executions.beach_water_quality).toBe(2);
  });

  it("resolves the same holds in and out of a scope, including a stale County feed", async () => {
    const stale = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    for (const fetchedAt of [new Date().toISOString(), stale]) {
      const unscoped = await resolveWaterQualityHolds(POOL.map(holdCandidate), {
        client: recordingClient({ fetchedAt }).client,
      });
      const scoped = await runWithWaterQualityReadScope(() =>
        resolveWaterQualityHolds(POOL.map(holdCandidate), {
          client: recordingClient({ fetchedAt }).client,
        }),
      );
      expect(scoped).toEqual(unscoped);
      expect(scoped.heldBeachIds).toEqual([OWNER_HELD, SAMPLE_HELD]);
      expect(scoped.unverifiedBeachIds).toEqual(
        fetchedAt === stale ? [CLEAN, COUNTY_COVERED] : undefined,
      );
    }
  });
});
