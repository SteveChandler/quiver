const mockCurrent = jest.fn();
const mockRain = jest.fn();
jest.mock("@/lib/services/water-quality/current-status", () => ({
  ...jest.requireActual("@/lib/services/water-quality/current-status"),
  currentWaterQuality: (...args: unknown[]) => mockCurrent(...args),
}));
jest.mock("@/lib/services/water-quality/rainfall-runoff-read", () => ({
  withRainfallNotice: (...args: unknown[]) => mockRain(...args),
}));

import { clearRegionWaterNoticeCache, loadRegionWaterNotice, waterSentence, withWaterSentence,
  type RegionWaterNotice } from "../week-scout-glance-water";

const LA = "America/Los_Angeles";
// Saturday Nov 14, 2026, 21:45 PT.
const now = new Date("2026-11-15T05:45:00Z");
const today = "2026-11-14";
const RUNOFF = "runoff raises bacteria near storm drains, creeks and river mouths";

describe("waterSentence", () => {
  const notice = (rain: RegionWaterNotice["rain"], closedBeaches: string[] = []): RegionWaterNotice => ({ rain, closedBeaches });

  it("says the County advisory, its end and a closure in one sentence (mock A)", () => {
    expect(waterSentence(notice({ county: true, endsAt: "2026-11-17T12:00:00Z" }, ["Tijuana Sloughs"]), today, LA))
      .toBe(`County rain advisory until early Tuesday if it stays dry: ${RUNOFF}, and Tijuana Sloughs is closed.`);
  });

  it("says a gauge advisory without the County (mock B)", () => {
    expect(waterSentence(notice({ county: false, endsAt: "2026-11-17T10:00:00Z" }), today, LA))
      .toBe(`Rain advisory until early Tuesday if it stays dry: ${RUNOFF}.`);
  });

  it("says a closure alone on a dry week (mock C)", () => {
    expect(waterSentence(notice(null, ["Tijuana Sloughs"]), today, LA)).toBe("Tijuana Sloughs is closed for water quality.");
    expect(waterSentence(notice(null, ["Imperial Beach", "Tijuana Sloughs"]), today, LA))
      .toBe("Imperial Beach and Tijuana Sloughs are closed for water quality.");
    expect(waterSentence(notice(null, ["A", "B", "C"]), today, LA)).toBe("3 beaches are closed for water quality.");
  });

  it("says nothing when nothing is active (mock D)", () => {
    expect(waterSentence(notice(null), today, LA)).toBeNull();
  });

  it("words today's and tomorrow's ends as the glance does", () => {
    expect(waterSentence(notice({ county: false, endsAt: "2026-11-15T07:00:00Z" }), today, LA))
      .toBe(`Rain advisory until tonight if it stays dry: ${RUNOFF}.`);
    expect(waterSentence(notice({ county: false, endsAt: "2026-11-15T10:00:00Z" }), today, LA))
      .toBe(`Rain advisory until early tomorrow if it stays dry: ${RUNOFF}.`);
    expect(waterSentence(notice({ county: false, endsAt: "2026-11-16T23:00:00Z" }), today, LA))
      .toBe(`Rain advisory until Monday afternoon if it stays dry: ${RUNOFF}.`);
  });

  it("names the 72-hour rule when no end is known", () => {
    expect(waterSentence(notice({ county: false, endsAt: null }), today, LA))
      .toBe(`Rain advisory until 72 hours after the rain stops: ${RUNOFF}.`);
  });
});

describe("withWaterSentence", () => {
  const glance = (count: number) => ({
    sentences: Array.from({ length: count }, (_, index) => `Swell ${index}.`),
    source: Array.from({ length: count }, (_, index) => (index === 0 ? "written" : "code") as "written" | "code"),
  });

  it("adds the sentence last and keeps sentences and sources paired", () => {
    expect(withWaterSentence(glance(2), "Water.")).toEqual({
      sentences: ["Swell 0.", "Swell 1.", "Water."], source: ["written", "code", "code"],
    });
  });

  it("takes the place of the last sentence at the six-sentence cap", () => {
    const result = withWaterSentence(glance(6), "Water.");
    expect(result?.sentences).toEqual(["Swell 0.", "Swell 1.", "Swell 2.", "Swell 3.", "Swell 4.", "Water."]);
    expect(result?.source).toHaveLength(6);
  });

  it("stands alone in a week with no swell sentence", () => {
    expect(withWaterSentence(null, "Water.")).toEqual({ sentences: ["Water."], source: ["code"] });
  });

  it("leaves the glance as it is without a sentence", () => {
    const original = glance(3);
    expect(withWaterSentence(original, null)).toBe(original);
    expect(withWaterSentence(null, null)).toBeNull();
  });
});

describe("loadRegionWaterNotice", () => {
  const beaches = [
    { id: "tj", name: "Tijuana Sloughs", lat: 32.55, lon: -117.13 },
    { id: "ib", name: "Imperial Beach", lat: 32.58, lon: -117.13 },
    { id: "ob", name: "Ocean Beach", lat: 32.75, lon: -117.25 },
    { id: "venice", name: "Venice Beach", lat: 33.98, lon: -118.47 },
  ];
  const client = (rows: Array<{ beach_id: string; status: string }>, error: unknown = null) => {
    const inCalls: string[][] = [];
    return {
      inCalls,
      from: jest.fn(() => ({ select: () => ({ in: async (_column: string, ids: string[]) => {
        inCalls.push(ids);
        return { data: error ? null : rows.filter((row) => ids.includes(row.beach_id)), error };
      } }) })),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearRegionWaterNoticeCache();
    mockCurrent.mockImplementation(async (rows: unknown[]) => rows);
    mockRain.mockImplementation(async (rows: unknown[]) => rows);
  });

  it("reads what the beach cards show: latest future end, County closures only", async () => {
    mockRain.mockImplementation(async () => [
      { beach_id: "tj", status: "closure", county_advisory_status: "closure" },
      { beach_id: "ib", status: "advisory", county_advisory_status: "advisory", county_advisory_kind: "general",
        county_rain_advisory: { started_at: "2026-11-13T12:00:00Z", last_rain_at: null, expires_at: "2026-11-17T12:00:00Z" } },
      { beach_id: "ob", status: "advisory", rain_runoff: { stations: [], expires_at: "2026-11-17T13:00:00Z" } },
      // A sampled closure is not a County closure, and a past end is not an end.
      { beach_id: "venice", status: "closure", rain_runoff: { stations: [], expires_at: "2026-11-14T00:00:00Z" } },
    ]);
    const db = client([{ beach_id: "tj", status: "unknown" }]);
    const notice = await loadRegionWaterNotice(db as never, "San Diego", beaches, now);
    expect(notice).toEqual({ rain: { county: false, endsAt: "2026-11-17T13:00:00Z" }, closedBeaches: ["Tijuana Sloughs"] });
    // Unsampled beaches still get County and rain status.
    expect(mockCurrent.mock.calls[0][0]).toEqual([
      { beach_id: "tj", status: "unknown" },
      expect.objectContaining({ beach_id: "ib", status: "unknown" }),
      expect.objectContaining({ beach_id: "ob", status: "unknown" }),
      expect.objectContaining({ beach_id: "venice", status: "unknown" }),
    ]);
    expect(mockCurrent).toHaveBeenCalledWith(expect.any(Array), db, now);
    expect(mockRain).toHaveBeenCalledWith(expect.any(Array), beaches, db, now);
  });

  it("says Rain advisory when the County speaks for only part of the region", async () => {
    mockRain.mockImplementation(async () => [
      { beach_id: "tj", status: "advisory", county_advisory_status: "advisory", county_advisory_kind: "general",
        county_rain_advisory: { started_at: "2026-11-13T12:00:00Z", last_rain_at: null, expires_at: "2026-11-17T12:00:00Z" } },
      { beach_id: "venice", status: "advisory", rain_runoff: { stations: [], expires_at: "2026-11-17T11:00:00Z" } },
    ]);
    const notice = await loadRegionWaterNotice(client([]) as never, "Orange County", beaches, now);
    expect(notice.rain).toEqual({ county: false, endsAt: "2026-11-17T12:00:00Z" });
  });

  it("says County rain advisory when the County speaks for every rain beach", async () => {
    mockRain.mockImplementation(async () => [
      { beach_id: "tj", status: "closure", county_advisory_status: "closure" },
      { beach_id: "ib", status: "advisory", county_advisory_status: "advisory", county_advisory_kind: "general",
        county_rain_advisory: { started_at: "2026-11-13T12:00:00Z", last_rain_at: null, expires_at: "2026-11-17T12:00:00Z" } },
      { beach_id: "ob", status: "advisory", county_advisory_status: "advisory", county_advisory_kind: "site" },
    ]);
    const notice = await loadRegionWaterNotice(client([]) as never, "San Diego", beaches, now);
    expect(notice).toEqual({ rain: { county: true, endsAt: "2026-11-17T12:00:00Z" }, closedBeaches: ["Tijuana Sloughs"] });
  });

  it("treats an active event past its end as over", async () => {
    mockRain.mockImplementation(async () => [
      { beach_id: "venice", status: "advisory", rain_runoff: { stations: [], expires_at: "2026-11-15T05:00:00Z" } },
    ]);
    const notice = await loadRegionWaterNotice(client([]) as never, "Los Angeles", beaches, now);
    expect(notice).toEqual({ rain: null, closedBeaches: [] });
  });

  it("keeps a reading with no end as an advisory", async () => {
    mockRain.mockImplementation(async () => [{ beach_id: "venice", status: "advisory", rain_runoff: { stations: [] } }]);
    const notice = await loadRegionWaterNotice(client([]) as never, "Los Angeles", beaches, now);
    expect(notice).toEqual({ rain: { county: false, endsAt: null }, closedBeaches: [] });
  });

  it("stops serving a cached advisory at its own end", async () => {
    mockRain.mockImplementation(async () => [
      { beach_id: "venice", status: "advisory", rain_runoff: { stations: [], expires_at: "2026-11-15T05:47:00Z" } },
    ]);
    const db = client([]);
    await loadRegionWaterNotice(db as never, "Los Angeles", beaches, now);
    await loadRegionWaterNotice(db as never, "Los Angeles", beaches, new Date("2026-11-15T05:46:00Z"));
    expect(db.from).toHaveBeenCalledTimes(1);
    await loadRegionWaterNotice(db as never, "Los Angeles", beaches, new Date("2026-11-15T05:48:00Z"));
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("finds no notice in a dry, open region", async () => {
    const notice = await loadRegionWaterNotice(client([]) as never, "Orange County", beaches, now);
    expect(notice).toEqual({ rain: null, closedBeaches: [] });
  });

  it("reads beaches in chunks of 100", async () => {
    const many = Array.from({ length: 230 }, (_, index) => ({ id: `b${index}`, name: `Beach ${index}`, lat: 0, lon: 0 }));
    const db = client([]);
    await loadRegionWaterNotice(db as never, "Big", many, now);
    expect(db.inCalls.map((ids) => ids.length)).toEqual([100, 100, 30]);
  });

  it("caches a region for five minutes", async () => {
    const db = client([]);
    await loadRegionWaterNotice(db as never, "San Diego", beaches, now);
    await loadRegionWaterNotice(db as never, "San Diego", beaches, new Date(now.getTime() + 4 * 60_000));
    expect(db.from).toHaveBeenCalledTimes(1);
    await loadRegionWaterNotice(db as never, "San Diego", beaches, new Date(now.getTime() + 6 * 60_000));
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed read", async () => {
    const failing = client([], { message: "timeout" });
    await expect(loadRegionWaterNotice(failing as never, "San Diego", beaches, now)).rejects.toEqual({ message: "timeout" });
    const db = client([]);
    await expect(loadRegionWaterNotice(db as never, "San Diego", beaches, now)).resolves.toEqual({ rain: null, closedBeaches: [] });
    expect(db.from).toHaveBeenCalledTimes(1);
  });
});
