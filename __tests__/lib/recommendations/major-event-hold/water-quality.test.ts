/**
 * @jest-environment node
 */

import {
  CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS,
  resolveWaterQualityHolds,
  type WaterQualityHoldClient,
} from "@/lib/recommendations/major-event-hold/water-quality";
import type { MajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/types";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

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
                        source_identifier: "county-san-diego-dehq-sdbeachinfo",
                      },
                    ],
                  error: args.liveError ?? null,
                }
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
            { beach_id: BEACH_B, status: "advisory", total_samples_30d: 2 },
            { beach_id: BEACH_C, status: "closure", total_samples_30d: 1 },
          ],
        }),
      },
    );

    expect(resolution.state).toBe("resolved");
    expect(resolution.heldBeachIds).toEqual([BEACH_A, BEACH_B, BEACH_C]);
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

  it("treats a County snapshot older than two hours as unavailable", async () => {
    const now = new Date("2026-08-14T01:30:00.000Z");
    const resolution = await resolveWaterQualityHolds([candidate(BEACH_A), candidate(BEACH_B)], {
      client: clientFor({
        ownerRows: [{ beach_id: BEACH_A }],
        qualityRows: [],
        liveRunRows: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            fetched_at: "2026-08-13T22:00:00.000Z",
            status: "completed",
            source_identifier: "county-san-diego-dehq-sdbeachinfo",
          },
        ],
      }),
      now,
    });

    expect(resolution.state).toBe("unresolved");
    expect(resolution.heldBeachIds).toEqual([BEACH_A]);
  });
});
