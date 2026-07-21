import { readFileSync } from "node:fs";

import {
  createSupabaseMajorEventHoldCacheInvalidationStore,
  invalidateMajorEventHoldTransitions,
  type MajorEventHoldCacheInvalidationStore,
  type MajorEventHoldCacheScope,
} from "@/lib/recommendations/major-event-hold/cache-invalidation";

const BEACH_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_BEACH_ID = "00000000-0000-4000-8000-000000000002";
const HOLD_ID = "00000000-0000-4000-8000-000000000003";
const RECORD_ID = "00000000-0000-4000-8000-000000000004";
const SUPERSEDED_RECORD_ID = "00000000-0000-4000-8000-000000000005";

function transition(
  overrides: Partial<MajorEventHoldCacheScope> = {},
): MajorEventHoldCacheScope {
  return {
    recordId: RECORD_ID,
    holdId: HOLD_ID,
    transition: "activation",
    regionKeys: ["los-angeles"],
    scopeBeachIds: [BEACH_ID],
    supersedesRecordId: null,
    ...overrides,
  };
}

function beachMetadata(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    slug: id === BEACH_ID ? "ocean-beach" : "steamer-lane",
    city: id === BEACH_ID ? "San Diego" : "Santa Cruz",
    state: "CA",
    country: "USA",
    lat: id === BEACH_ID ? 32.8 : 36.96,
    deleted_at: null,
    ...overrides,
  };
}

function store(
  overrides: Partial<MajorEventHoldCacheInvalidationStore> = {},
): MajorEventHoldCacheInvalidationStore {
  return {
    loadBeachMetadata: jest.fn().mockResolvedValue([beachMetadata(BEACH_ID)]),
    loadHoldScopeByRecordId: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function queryResult(data: unknown) {
  const builder: Record<string, jest.Mock | unknown> = {};
  for (const method of ["select", "eq", "in", "is", "order", "limit"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data, error: null }).then(resolve);
  return builder;
}

const SAN_DIEGO_PATHS = [
  "/beach/ocean-beach",
  "/best-time-to-surf/san-diego",
  "/ca/san-diego/ocean-beach",
  "/beginner/ca",
  "/beginner/san-diego",
  "/dawn-patrol/ca",
  "/dawn-patrol/san-diego",
  "/least-crowded/ca",
  "/least-crowded/san-diego",
  "/longboard/ca",
  "/longboard/san-diego",
  "/sunset/ca",
  "/sunset/san-diego",
  "/tide/ca",
  "/tide/san-diego",
  "/water-temp/ca",
  "/water-temp/san-diego",
  "/forecast/los-angeles",
  "/forecast/san-diego",
  "/forecast/southern-california",
].sort();

const SANTA_CRUZ_PATHS = [
  "/beach/steamer-lane",
  "/best-time-to-surf/santa-cruz",
  "/ca/santa-cruz/steamer-lane",
  "/beginner/ca",
  "/beginner/santa-cruz",
  "/dawn-patrol/ca",
  "/dawn-patrol/santa-cruz",
  "/least-crowded/ca",
  "/least-crowded/santa-cruz",
  "/longboard/ca",
  "/longboard/santa-cruz",
  "/sunset/ca",
  "/sunset/santa-cruz",
  "/tide/ca",
  "/tide/santa-cruz",
  "/water-temp/ca",
  "/water-temp/santa-cruz",
  "/forecast/northern-california",
  "/forecast/santa-cruz",
];

describe("major-event hold cache invalidation", () => {
  it.each(["activation", "extension", "cancellation"] as const)(
    "invalidates the exact concrete paths for a confirmed %s",
    async (transitionName) => {
      const cacheStore = store();
      const revalidatePath = jest.fn();

      const paths = await invalidateMajorEventHoldTransitions(
        [
          transition({
            transition: transitionName,
            supersedesRecordId:
              transitionName === "activation" ? null : SUPERSEDED_RECORD_ID,
          }),
        ],
        { store: cacheStore, revalidatePath },
      );

      expect(paths).toEqual(SAN_DIEGO_PATHS);
      expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual(
        SAN_DIEGO_PATHS,
      );
      expect(cacheStore.loadBeachMetadata).toHaveBeenCalledWith([BEACH_ID]);
      expect(cacheStore.loadHoldScopeByRecordId).not.toHaveBeenCalled();
    },
  );

  it("invalidates the exact superseded old scope unioned with the replacement scope", async () => {
    const cacheStore = store({
      loadBeachMetadata: jest
        .fn()
        .mockResolvedValue([
          beachMetadata(BEACH_ID),
          beachMetadata(SECOND_BEACH_ID),
        ]),
      loadHoldScopeByRecordId: jest.fn().mockResolvedValue({
        record_id: SUPERSEDED_RECORD_ID,
        hold_id: HOLD_ID,
        region_keys: ["san-diego"],
        scope_beach_ids: [BEACH_ID],
      }),
    });
    const revalidatePath = jest.fn();

    const paths = await invalidateMajorEventHoldTransitions(
      [
        transition({
          transition: "replacement",
          regionKeys: ["northern-california"],
          scopeBeachIds: [SECOND_BEACH_ID],
          supersedesRecordId: SUPERSEDED_RECORD_ID,
        }),
      ],
      { store: cacheStore, revalidatePath },
    );

    expect(cacheStore.loadHoldScopeByRecordId).toHaveBeenCalledWith(
      SUPERSEDED_RECORD_ID,
    );
    expect(cacheStore.loadBeachMetadata).toHaveBeenCalledWith([
      BEACH_ID,
      SECOND_BEACH_ID,
    ]);
    expect(paths).toEqual(
      [
        ...new Set([
          ...SAN_DIEGO_PATHS.filter((path) => path !== "/forecast/los-angeles"),
          ...SANTA_CRUZ_PATHS,
        ]),
      ].sort(),
    );
    expect(paths.filter((path) => path === "/forecast/san-diego")).toHaveLength(
      1,
    );
    expect(revalidatePath).toHaveBeenCalledTimes(paths.length);
  });

  it("deduplicates beach, city/state collisions, overlapping regions, and repeated accepted records", async () => {
    const collidingBeach = beachMetadata(BEACH_ID, {
      slug: "state-city",
      city: "CA",
      lat: 33.7,
    });
    const cacheStore = store({
      loadBeachMetadata: jest.fn().mockResolvedValue([collidingBeach]),
    });
    const revalidatePath = jest.fn();

    const paths = await invalidateMajorEventHoldTransitions(
      [
        transition({ regionKeys: ["southern-california"] }),
        transition({
          recordId: "00000000-0000-4000-8000-000000000006",
          regionKeys: ["southern-california"],
        }),
      ],
      { store: cacheStore, revalidatePath },
    );

    expect(cacheStore.loadBeachMetadata).toHaveBeenCalledWith([BEACH_ID]);
    expect(paths.filter((path) => path === "/beginner/ca")).toHaveLength(1);
    expect(
      paths.filter((path) => path === "/forecast/southern-california"),
    ).toHaveLength(1);
    expect(new Set(paths).size).toBe(paths.length);
    expect(revalidatePath).toHaveBeenCalledTimes(paths.length);
  });

  it("uses the collision-aware canonical intent city slug", async () => {
    const cacheStore = store({
      loadBeachMetadata: jest.fn().mockResolvedValue([
        beachMetadata(BEACH_ID, {
          slug: "long-beach-break",
          city: "Long Beach",
          state: "CA",
          lat: 33.77,
        }),
      ]),
    });

    const paths = await invalidateMajorEventHoldTransitions([transition()], {
      store: cacheStore,
      revalidatePath: jest.fn(),
    });

    expect(paths).toContain("/beginner/long-beach-ca");
    expect(paths).not.toContain("/beginner/long-beach");
    expect(paths).toContain("/ca/long-beach/long-beach-break");
  });

  it("invalidates every cached collision-aware best-time city page in scope", async () => {
    const cacheStore = store({
      loadBeachMetadata: jest.fn().mockResolvedValue([
        beachMetadata(BEACH_ID, {
          slug: "long-beach-break",
          city: "Long Beach",
          state: "CA",
          lat: 33.77,
        }),
        beachMetadata(SECOND_BEACH_ID),
      ]),
    });
    const revalidatePath = jest.fn();

    const paths = await invalidateMajorEventHoldTransitions(
      [
        transition({
          regionKeys: [],
          scopeBeachIds: [BEACH_ID, SECOND_BEACH_ID],
        }),
      ],
      { store: cacheStore, revalidatePath },
    );

    const bestTimePaths = paths.filter((path) =>
      path.startsWith("/best-time-to-surf/"),
    );
    expect(bestTimePaths).toEqual([
      "/best-time-to-surf/long-beach-ca",
      "/best-time-to-surf/santa-cruz",
    ]);
    expect(
      revalidatePath.mock.calls
        .map(([path]) => path)
        .filter((path) => path.startsWith("/best-time-to-surf/")),
    ).toEqual(bestTimePaths);
    expect(paths).not.toContain("/best-time-to-surf/long-beach");
  });

  it("does nothing when no append was accepted", async () => {
    const cacheStore = store();
    const revalidatePath = jest.fn();

    await expect(
      invalidateMajorEventHoldTransitions([], {
        store: cacheStore,
        revalidatePath,
      }),
    ).resolves.toEqual([]);

    expect(cacheStore.loadBeachMetadata).not.toHaveBeenCalled();
    expect(cacheStore.loadHoldScopeByRecordId).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", []],
    ["truncated", [beachMetadata(BEACH_ID)]],
    ["duplicated", [beachMetadata(BEACH_ID), beachMetadata(BEACH_ID)]],
    [
      "unexpected",
      [
        beachMetadata(BEACH_ID),
        beachMetadata("00000000-0000-4000-8000-000000000099"),
      ],
    ],
    ["invalid", [beachMetadata(BEACH_ID, { slug: "../escape" })]],
  ])("fails before invalidation for %s beach metadata", async (_name, rows) => {
    const cacheStore = store({
      loadBeachMetadata: jest.fn().mockResolvedValue(rows),
    });
    const revalidatePath = jest.fn();
    const records =
      _name === "truncated"
        ? [
            transition({
              scopeBeachIds: [BEACH_ID, SECOND_BEACH_ID],
            }),
          ]
        : [transition()];

    await expect(
      invalidateMajorEventHoldTransitions(records, {
        store: cacheStore,
        revalidatePath,
      }),
    ).rejects.toMatchObject({ code: "cache_invalidation_failed" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("fails before beach loading or invalidation when the exact superseded record is unavailable", async () => {
    const cacheStore = store({
      loadHoldScopeByRecordId: jest.fn().mockResolvedValue(null),
    });
    const revalidatePath = jest.fn();

    await expect(
      invalidateMajorEventHoldTransitions(
        [
          transition({
            transition: "replacement",
            supersedesRecordId: SUPERSEDED_RECORD_ID,
          }),
        ],
        { store: cacheStore, revalidatePath },
      ),
    ).rejects.toMatchObject({ code: "cache_invalidation_failed" });
    expect(cacheStore.loadBeachMetadata).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("surfaces a revalidation throw as a post-persistence invalidation failure", async () => {
    const cacheStore = store();
    const revalidatePath = jest.fn(() => {
      throw new Error("cache backend unavailable");
    });

    await expect(
      invalidateMajorEventHoldTransitions([transition()], {
        store: cacheStore,
        revalidatePath,
      }),
    ).rejects.toMatchObject({ code: "cache_invalidation_failed" });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("loads complete beach metadata and the superseded scope by exact record id", async () => {
    const beachRow = beachMetadata(BEACH_ID);
    const holdRow = {
      record_id: SUPERSEDED_RECORD_ID,
      hold_id: HOLD_ID,
      region_keys: [],
      scope_beach_ids: [BEACH_ID],
    };
    const beachQuery = queryResult([beachRow]);
    const holdQuery = queryResult([holdRow]);
    const from = jest.fn((table: string) =>
      table === "beaches" ? beachQuery : holdQuery,
    );
    const cacheStore = createSupabaseMajorEventHoldCacheInvalidationStore({
      from,
    });

    await expect(cacheStore.loadBeachMetadata([BEACH_ID])).resolves.toEqual([
      beachRow,
    ]);
    await expect(
      cacheStore.loadHoldScopeByRecordId(SUPERSEDED_RECORD_ID),
    ).resolves.toEqual(holdRow);

    expect(beachQuery.select).toHaveBeenCalledWith(
      "id,slug,city,state,country,lat,deleted_at",
    );
    expect(beachQuery.in).toHaveBeenCalledWith("id", [BEACH_ID]);
    expect(beachQuery.is).toHaveBeenCalledWith("deleted_at", null);
    expect(beachQuery.limit).toHaveBeenCalledWith(2);
    expect(holdQuery.select).toHaveBeenCalledWith(
      "record_id,hold_id,region_keys,scope_beach_ids",
    );
    expect(holdQuery.eq).toHaveBeenCalledWith(
      "record_id",
      SUPERSEDED_RECORD_ID,
    );
    expect(holdQuery.limit).toHaveBeenCalledWith(2);
  });

  it("never uses a global beaches tag", () => {
    const source = readFileSync(
      "lib/recommendations/major-event-hold/cache-invalidation.ts",
      "utf8",
    );

    expect(source).not.toContain("revalidateTag");
  });
});
