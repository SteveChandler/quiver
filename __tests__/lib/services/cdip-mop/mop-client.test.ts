/**
 * @jest-environment node
 */
import { readFileSync } from "fs";
import path from "path";
import {
  fetchMopFocusRatio,
  fetchMopHour,
  fetchMopPointMeta,
} from "@/lib/services/cdip-mop/mop-client";

// Recorded from thredds.cdip.ucsd.edu on 2026-10-01. The time axis is trimmed to its last 48 hours;
// every MOP point shares it.
const FIXTURES = path.join(__dirname, "../../../fixtures/cdip-mop");
const fixture = (name: string): string | null => {
  try {
    return readFileSync(path.join(FIXTURES, name), "utf8");
  } catch {
    return null;
  }
};

const AT_15Z = new Date("2026-09-30T15:00:00Z");
// 2026-09-30T15:00Z is index 21 of the trimmed axis (which starts 2026-09-29T18:00Z).
const HOUR_INDEX = 21;

type MockResponse = { ok: boolean; status: number; text: () => Promise<string> };

function mopFetch(overrides: Record<string, string | number> = {}) {
  return jest.fn(async (input: string | URL, _init?: RequestInit): Promise<MockResponse> => {
    const url = String(input);
    const point = /MOP_alongshore\/(\w+)_nowcast\.nc/.exec(url)?.[1] ?? "";
    const query = decodeURIComponent(url.split(".ascii?")[1] ?? "");
    const override = overrides[point];
    if (typeof override === "number") return { ok: false, status: override, text: async () => "error" };
    let body: string | null;
    if (query === "waveTime") body = fixture("D0505-time-last48.ascii");
    else if (query.startsWith("metaLatitude")) body = fixture(`${point}-meta.ascii`);
    else body = override ?? fixture(`${point}-hour-20260930T15.ascii`);
    if (body === null) return { ok: false, status: 404, text: async () => "not found" };
    return { ok: true, status: 200, text: async () => body as string };
  });
}

const asFetch = (mock: ReturnType<typeof mopFetch>) => mock as unknown as typeof fetch;
const hourFixture = fixture("D0505-hour-20260930T15.ascii") as string;

describe("CDIP MOP client", () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn(() => {
      throw new Error("tests must not call the network");
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("parses the recorded La Jolla Shores (D0505) hour for 2026-09-30 15:00Z", async () => {
    const mock = mopFetch();
    const hour = await fetchMopHour("D0505", AT_15Z, asFetch(mock));

    expect(hour).toEqual({
      pointId: "D0505",
      observedAt: "2026-09-30T15:00:00.000Z",
      hsM: expect.closeTo(1.197, 3),
      tpS: 10,
      dpDeg: expect.closeTo(280.48, 2),
      dmDeg: expect.closeTo(280.75, 2),
      swellbandTmS: expect.closeTo(11.85, 2),
    });
    const hourUrl = decodeURIComponent(String(mock.mock.calls[1][0]));
    expect(hourUrl).toContain(`waveHs[${HOUR_INDEX}:1:${HOUR_INDEX}]`);
    expect((mock.mock.calls[1][1]?.headers as Record<string, string>)["User-Agent"]).toBe("Quiver (support@quiversurf.app)");
  });

  it("takes the nearest hour to arrival", async () => {
    const hour = await fetchMopHour("D0505", new Date("2026-09-30T15:20:00Z"), asFetch(mopFetch()));
    expect(hour?.observedAt).toBe("2026-09-30T15:00:00.000Z");
  });

  it("reads the time axis once per point", async () => {
    const mock = mopFetch();
    await fetchMopHour("D0505", AT_15Z, asFetch(mock));
    await fetchMopHour("D0505", new Date("2026-09-30T16:00:00Z"), asFetch(mock));
    expect(mock.mock.calls.filter(([url]) => String(url).endsWith(".ascii?waveTime"))).toHaveLength(1);
  });

  it("returns null on a fill value", async () => {
    const filled = hourFixture.replace(/waveHs\[1\]\n[^\n]+/, "waveHs[1]\n-999.99");
    expect(await fetchMopHour("D0505", AT_15Z, asFetch(mopFetch({ D0505: filled })))).toBeNull();
  });

  it("returns null when the primary flag marks the hour bad", async () => {
    const flagged = hourFixture.replace(/waveFlagPrimary\[1\]\n[^\n]+/, "waveFlagPrimary[1]\n4");
    expect(await fetchMopHour("D0505", AT_15Z, asFetch(mopFetch({ D0505: flagged })))).toBeNull();
  });

  it("returns null without fetching the hour when the nearest hour is more than 1 h away", async () => {
    const mock = mopFetch();
    expect(await fetchMopHour("D0505", new Date("2026-09-29T16:30:00Z"), asFetch(mock))).toBeNull();
    expect(await fetchMopHour("D0505", new Date("2026-10-02T12:00:00Z"), asFetch(mock))).toBeNull();
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("rejects when THREDDS errors, so the cron retries later", async () => {
    await expect(fetchMopHour("D0505", AT_15Z, asFetch(mopFetch({ D0505: 503 })))).rejects.toThrow("503");
  });

  it("reads a point's position and shore normal", async () => {
    await expect(fetchMopPointMeta("D0505", asFetch(mopFetch()))).resolves.toEqual({
      pointId: "D0505",
      lat: expect.closeTo(32.86093, 5),
      lon: expect.closeTo(-117.26124, 5),
      shoreNormalDeg: 288,
    });
  });

  it("divides Hs by the mean of its ±2 alongshore neighbours", async () => {
    await expect(fetchMopFocusRatio("D0505", AT_15Z, asFetch(mopFetch()))).resolves.toBe(1.05);
  });

  it("skips a missing neighbour and needs at least two", async () => {
    await expect(fetchMopFocusRatio("D0505", AT_15Z, asFetch(mopFetch({ D0507: 404 })))).resolves.toBe(1.04);
    await expect(
      fetchMopFocusRatio("D0505", AT_15Z, asFetch(mopFetch({ D0503: 404, D0504: 404, D0507: 404 }))),
    ).resolves.toBeNull();
  });
});
