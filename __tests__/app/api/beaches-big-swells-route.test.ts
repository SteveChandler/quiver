/** @jest-environment node */
import { GET } from "@/app/api/beaches/[id]/big-swells/route";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bigSwellForecastStory } from "@/lib/alerts/swell-events/big-swell-story";
import { compareToBigSwells, type BigSwellBuoy } from "@/lib/big-swells";
import dataset from "@/lib/data/big-swells.json";
import { isSwellStoryCardEnabled } from "@/lib/flags/swell-story";

jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: jest.fn(), createSupabaseServiceRoleClient: jest.fn(() => "service") }));
// The story switch is a database row: off unless a test turns it on, which is today's response.
jest.mock("@/lib/flags/swell-story", () => ({ isSwellStoryCardEnabled: jest.fn(async () => false) }));
jest.mock("@/lib/alerts/swell-events/big-swell-story", () => ({ bigSwellForecastStory: jest.fn() }));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  withRateLimit: (handler: unknown) => handler,
}));
jest.mock("@/lib/data/big-swells.json", () => ({
  stations: [
    {
      id: "44065",
      name: "New York Harbor Entrance",
      lat: 40.368,
      lon: -73.701,
      since: "2008-10-30",
      through: "2026-10-23",
      bigHsM: 3,
      modelRatio: 0.9,
      biggest: [
        { at: "2012-10-30T00:00:00.000Z", hsM: 9.86, periodS: 13.79, dirDeg: 121 },
        { at: "2010-03-13T23:00:00.000Z", hsM: 5.94, periodS: 10, dirDeg: 126 },
      ],
      recent: [{ at: "2026-09-26T08:50:00.000Z", hsM: 4.5, periodS: 10, dirDeg: 108 }],
    },
    {
      id: "51201",
      name: "Waimea Bay, HI (106)",
      lat: 21.671,
      lon: -158.118,
      since: "2001-01-01",
      through: "2026-10-23",
      bigHsM: 4,
      modelRatio: 0.74,
      biggest: [{ at: "2021-12-05T00:00:00.000Z", hsM: 8, periodS: 17, dirDeg: 320 }],
      recent: [],
    },
  ],
}));

const BELMAR = "fb0ee60f-a269-47ed-b244-e8dc64fff891";
const mockClient = createSupabaseServerClient as jest.Mock;

function beachRow(row: { lat: number; lon: number; region?: string | null; timezone?: string | null } | null): void {
  const chain = { select: () => chain, eq: () => chain, is: () => chain, maybeSingle: async () => ({ data: row, error: null }) };
  mockClient.mockResolvedValue({ from: () => chain });
}

function call(id: string): Promise<Response> {
  return GET({} as never, { params: Promise.resolve({ id }) });
}

describe("GET /api/beaches/[id]/big-swells", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.clearAllMocks();
  });

  it("compares this week's peak at the buoy with the buoy's measured big swells", async () => {
    beachRow({ lat: 40.176, lon: -74.013 });
    const soon = new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 13) + ":00";
    const later = new Date(Date.now() + 30 * 3_600_000).toISOString().slice(0, 13) + ":00";
    global.fetch = jest.fn(async () =>
      Response.json({
        hourly: { time: [soon, later], wave_height: [2, 4.6], wave_peak_period: [9, 11.5], wave_direction: [90, 110] },
      }),
    ) as typeof fetch;

    const response = await call(BELMAR);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain("models=ecmwf_wam025");
    expect(body.data.buoy).toMatchObject({ id: "44065", distanceKm: 34, since: "2008-10-30" });
    expect(body.data.forecast).toMatchObject({
      hsM: 4.6,
      periodS: 11.5,
      isBig: true,
      rank: null,
      closest: { at: "2026-09-26T08:50:00.000Z", hsM: 4.5 },
    });
  });

  it("still returns the history when the forecast is unavailable", async () => {
    beachRow({ lat: 40.176, lon: -74.013 });
    global.fetch = jest.fn(async () => new Response("down", { status: 503 })) as typeof fetch;

    const body = await (await call(BELMAR)).json();
    expectConsoleWarnings([/Open-Meteo HTTP failure/]);
    expect(body.data.forecast).toBeNull();
    expect(body.data.biggest).toHaveLength(2);
  });

  it("shows history without a forecast where the model can't stand in for the buoy", async () => {
    beachRow({ lat: 21.64, lon: -158.06 });
    global.fetch = jest.fn() as typeof fetch;

    const body = await (await call(BELMAR)).json();
    expect(body.data.buoy.id).toBe("51201");
    expect(body.data.forecast).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty history, not an error, when no buoy is within 100 km", async () => {
    beachRow({ lat: 27.8, lon: -97.4 });
    global.fetch = jest.fn() as typeof fetch;

    const response = await call(BELMAR);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ buoy: null, bigHsM: null, biggest: [], recent: [], forecast: null });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  describe("the swell card's sentence", () => {
    const soon = () => new Date(Date.now() + 30 * 3_600_000).toISOString().slice(0, 13) + ":00";
    const wam = () => {
      const at = soon();
      global.fetch = jest.fn(async () => Response.json({
        hourly: { time: [at], wave_height: [4.6], wave_peak_period: [11.5], wave_direction: [110] },
      })) as typeof fetch;
      return `${at}:00.000Z`;
    };
    const STORY = "A east-southeast mid-period swell arrives and peaks Tuesday: head-high at most spots.";

    it("adds null story fields and builds no region with the switch off", async () => {
      beachRow({ lat: 40.176, lon: -74.013, region: "New Jersey", timezone: "America/New_York" });
      const peakAt = wam();
      const body = await (await call(BELMAR)).json();
      const { story, storySource, ...today } = body.data.forecast;
      expect([story, storySource]).toEqual([null, null]);
      // Everything else is today's forecast object.
      expect(today).toEqual({ model: "ecmwf_wam025", at: peakAt, hsM: 4.6, periodS: 11.5, dirDeg: 110,
        ...compareToBigSwells(4.6, (dataset as unknown as { stations: BigSwellBuoy[] }).stations[0]) });
      expect(bigSwellForecastStory).not.toHaveBeenCalled();
    });

    it("carries the matched region event's server sentence with the switch on", async () => {
      jest.mocked(isSwellStoryCardEnabled).mockResolvedValueOnce(true);
      jest.mocked(bigSwellForecastStory).mockResolvedValueOnce({ story: STORY, storySource: "code" });
      beachRow({ lat: 40.176, lon: -74.013, region: "New Jersey", timezone: "America/New_York" });
      const peakAt = wam();
      const body = await (await call(BELMAR)).json();
      expect(body.data.forecast).toMatchObject({ hsM: 4.6, story: STORY, storySource: "code" });
      expect(bigSwellForecastStory).toHaveBeenCalledWith(expect.objectContaining({ client: "service", region: "New Jersey",
        timezone: "America/New_York", buoyId: "44065", peakAt }));
    });

    it("keeps the response, with null story fields, when the sentence fails", async () => {
      jest.mocked(isSwellStoryCardEnabled).mockResolvedValueOnce(true);
      jest.mocked(bigSwellForecastStory).mockRejectedValueOnce(new Error("region read failed"));
      beachRow({ lat: 40.176, lon: -74.013, region: "New Jersey", timezone: "America/New_York" });
      wam();
      const response = await call(BELMAR);
      expectConsoleWarnings([/\[big-swells\] story failed/]);
      expect(response.status).toBe(200);
      expect((await response.json()).data.forecast).toMatchObject({ hsM: 4.6, story: null, storySource: null });
    });

    it("asks for no sentence without a forecast peak or a region", async () => {
      jest.mocked(isSwellStoryCardEnabled).mockResolvedValue(true);
      beachRow({ lat: 40.176, lon: -74.013, region: null, timezone: null });
      wam();
      expect((await (await call(BELMAR)).json()).data.forecast).toMatchObject({ story: null, storySource: null });
      beachRow({ lat: 40.176, lon: -74.013, region: "New Jersey", timezone: "America/New_York" });
      global.fetch = jest.fn(async () => new Response("down", { status: 503 })) as typeof fetch;
      expect((await (await call(BELMAR)).json()).data.forecast).toBeNull();
      expectConsoleWarnings([/Open-Meteo HTTP failure/]);
      expect(bigSwellForecastStory).not.toHaveBeenCalled();
      jest.mocked(isSwellStoryCardEnabled).mockResolvedValue(false);
    });
  });

  it("returns real error statuses for a bad id or a missing beach", async () => {
    expect((await call("belmar")).status).toBe(400);

    beachRow(null);
    expect((await call(BELMAR)).status).toBe(404);
  });
});
