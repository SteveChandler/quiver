/**
 * @jest-environment node
 */

import {
  STORY_SENTINEL_REGION,
  checkWeekScoutStoryStaleness,
  supabaseStoryStalenessReads,
  type StoryStalenessReads,
} from "@/lib/monitoring/week-scout-story-staleness";

// 08:15 PST on 2026-11-14 is 16:15 UTC, the cron's run time.
const NOW = new Date("2026-11-14T16:15:00.000Z");
const LA = "America/Los_Angeles";

const REGIONS = [
  { region: "San Diego", timezone: LA },
  { region: "Orange County", timezone: LA },
  { region: "Oahu", timezone: "Pacific/Honolulu" },
  { region: "Jersey Shore", timezone: "America/New_York" },
];

/** Reads where each listed region has an edition on the given local date. */
function reads(
  regions: Array<{ region: string; timezone: string }>,
  editions: Record<string, string>,
): StoryStalenessReads & { asked: Array<{ region: string; editionDate: string }> } {
  const asked: Array<{ region: string; editionDate: string }> = [];
  return {
    asked,
    activeRegions: async () => regions,
    hasEdition: async (region, editionDate) => {
      asked.push({ region, editionDate });
      return editions[region] === editionDate;
    },
  };
}

const allFresh = (date = "2026-11-14"): Record<string, string> =>
  Object.fromEntries(REGIONS.map(({ region }) => [region, date]));

describe("checkWeekScoutStoryStaleness", () => {
  it("is healthy when every active region has today's edition", async () => {
    const result = await checkWeekScoutStoryStaleness(reads(REGIONS, allFresh()), NOW);

    expect(result).toEqual({
      healthy: true,
      activeRegions: 4,
      freshRegions: 4,
      staleRegions: [],
    });
  });

  it("stays healthy with one stale region that is not San Diego, and names it", async () => {
    const editions = allFresh();
    delete editions["Jersey Shore"];

    const result = await checkWeekScoutStoryStaleness(reads(REGIONS, editions), NOW);

    expect(result).toEqual({
      healthy: true,
      activeRegions: 4,
      freshRegions: 3,
      staleRegions: ["Jersey Shore"],
    });
  });

  it("is red when only San Diego is stale", async () => {
    const editions = allFresh();
    delete editions["San Diego"];

    const result = await checkWeekScoutStoryStaleness(reads(REGIONS, editions), NOW);

    expect(result).toMatchObject({ healthy: false, reason: "sentinel_stale", staleRegions: ["San Diego"] });
    expect(!result.healthy && result.detail).toContain("San Diego has no edition for 2026-11-14");
  });

  it("checks San Diego even when it is not on the active list", async () => {
    const others = REGIONS.filter(({ region }) => region !== STORY_SENTINEL_REGION);
    const editions = allFresh();
    delete editions["San Diego"];

    const fake = reads(others, editions);
    const result = await checkWeekScoutStoryStaleness(fake, NOW);

    expect(fake.asked).toContainEqual({ region: "San Diego", editionDate: "2026-11-14" });
    expect(result).toMatchObject({ healthy: false, reason: "sentinel_stale", staleRegions: ["San Diego"] });
    expect(!result.healthy && result.detail).toContain("3 of 3 active regions");
  });

  it("names an off-list San Diego among the missing regions when too few regions are fresh", async () => {
    const others = REGIONS.filter(({ region }) => region !== STORY_SENTINEL_REGION);

    const result = await checkWeekScoutStoryStaleness(reads(others, { Oahu: "2026-11-14" }), NOW);

    expect(result).toMatchObject({
      healthy: false,
      reason: "too_few_editions",
      staleRegions: ["Jersey Shore", "Orange County", "San Diego"],
    });
    expect(!result.healthy && result.detail).toBe(
      "1 of 3 active regions have today's edition; missing: Jersey Shore, Orange County, San Diego",
    );
  });

  it("is red when fewer than half of the active regions have today's edition, listing the count and the missing regions", async () => {
    const result = await checkWeekScoutStoryStaleness(reads(REGIONS, { "San Diego": "2026-11-14" }), NOW);

    expect(result).toMatchObject({
      healthy: false,
      reason: "too_few_editions",
      staleRegions: ["Jersey Shore", "Oahu", "Orange County"],
    });
    expect(!result.healthy && result.detail).toBe(
      "1 of 4 active regions have today's edition; missing: Jersey Shore, Oahu, Orange County",
    );
  });

  it("stays healthy at exactly half", async () => {
    const result = await checkWeekScoutStoryStaleness(
      reads(REGIONS, { "San Diego": "2026-11-14", Oahu: "2026-11-14" }),
      NOW,
    );

    expect(result).toMatchObject({ healthy: true, freshRegions: 2, staleRegions: ["Jersey Shore", "Orange County"] });
  });

  it("is red when no region has an edition today, as after the worker stops", async () => {
    // Yesterday's editions do not count: the server serves only today's.
    const result = await checkWeekScoutStoryStaleness(reads(REGIONS, allFresh("2026-11-13")), NOW);

    expect(result).toMatchObject({ healthy: false, reason: "too_few_editions" });
    expect(!result.healthy && result.detail).toMatch(/^0 of 4 active regions/);
  });

  it("names a region with no rows at all as stale", async () => {
    const regions = [...REGIONS, { region: "Santa Cruz", timezone: LA }];

    const result = await checkWeekScoutStoryStaleness(reads(regions, allFresh()), NOW);

    expect(result).toEqual({ healthy: true, activeRegions: 5, freshRegions: 4, staleRegions: ["Santa Cruz"] });
  });

  it("asks for each region's own local date", async () => {
    // 05:30 UTC on Nov 15 is 00:30 Nov 15 in New York but still Nov 14 in Los Angeles and Honolulu.
    const at = new Date("2026-11-15T05:30:00.000Z");
    const fake = reads(REGIONS, {});

    await checkWeekScoutStoryStaleness(fake, at);

    expect(fake.asked).toEqual(expect.arrayContaining([
      { region: "San Diego", editionDate: "2026-11-14" },
      { region: "Oahu", editionDate: "2026-11-14" },
      { region: "Jersey Shore", editionDate: "2026-11-15" },
    ]));
  });

  it("is red when the active region list is empty", async () => {
    const result = await checkWeekScoutStoryStaleness(reads([], {}), NOW);

    expect(result).toMatchObject({ healthy: false, reason: "no_active_regions" });
  });

  it("is red when the region read fails", async () => {
    const fake: StoryStalenessReads = {
      activeRegions: async () => { throw new Error("story_regions_read_failed"); },
      hasEdition: async () => true,
    };

    const result = await checkWeekScoutStoryStaleness(fake, NOW);

    expect(result).toMatchObject({ healthy: false, reason: "read_failed" });
    expect(!result.healthy && result.detail).toContain("story_regions_read_failed");
  });

  it("is red when an edition read fails", async () => {
    const fake: StoryStalenessReads = {
      activeRegions: async () => REGIONS,
      hasEdition: async (region) => {
        if (region === "Oahu") throw new Error("story_edition_read_failed");
        return true;
      },
    };

    const result = await checkWeekScoutStoryStaleness(fake, NOW);

    expect(result).toMatchObject({ healthy: false, reason: "read_failed" });
  });
});

describe("supabaseStoryStalenessReads", () => {
  function client(result: { data: unknown; error: { message: string } | null }) {
    const calls: Array<[string, ...unknown[]]> = [];
    const chain = {
      select: (cols: string) => { calls.push(["select", cols]); return chain; },
      eq: (col: string, value: unknown) => { calls.push(["eq", col, value]); return chain; },
      in: (col: string, values: unknown[]) => { calls.push(["in", col, values]); return chain; },
      limit: (n: number) => { calls.push(["limit", n]); return Promise.resolve(result); },
    };
    return {
      calls,
      client: {
        from: (table: string) => { calls.push(["from", table]); return chain; },
        rpc: jest.fn(),
      },
    };
  }

  it("reads one row of the region's written edition for that exact date, without writing", async () => {
    const fake = client({ data: [{ region: "Oahu" }], error: null });

    const found = await supabaseStoryStalenessReads(fake.client as never).hasEdition("Oahu", "2026-11-14");

    expect(found).toBe(true);
    expect(fake.calls).toEqual([
      ["from", "week_scout_story_editions"],
      ["select", "region"],
      ["eq", "region", "Oahu"],
      ["eq", "edition_date", "2026-11-14"],
      // A -1 edition carries no written sentences, so the server does not serve it.
      ["in", "generation_version", ["week-scout-story-2", "week-scout-story-3"]],
      ["limit", 1],
    ]);
  });

  it("reports no edition when no row comes back", async () => {
    const fake = client({ data: [], error: null });

    await expect(supabaseStoryStalenessReads(fake.client as never).hasEdition("Oahu", "2026-11-14")).resolves.toBe(false);
  });

  it("throws on a read error instead of reporting a stale region", async () => {
    const fake = client({ data: null, error: { message: "boom" } });

    await expect(supabaseStoryStalenessReads(fake.client as never).hasEdition("Oahu", "2026-11-14"))
      .rejects.toThrow("story_edition_read_failed");
  });
});
