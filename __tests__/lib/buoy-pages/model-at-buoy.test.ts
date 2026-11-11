/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildModelUrl,
  compareModelToObserved,
  describeComparison,
  fetchModelAtBuoy,
  modelDailyPeaks,
  parseModelResponse,
} from "@/lib/buoy-pages/model-at-buoy";

const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, "../../fixtures/ndbc-wave-stations/buoy-pages/open-meteo-46225.json"), "utf8"),
);

describe("parseModelResponse", () => {
  it("reads a real Open-Meteo ECMWF WAM response for buoy 46225", () => {
    const model = parseModelResponse(FIXTURE);
    expect(model).not.toBeNull();
    expect(model?.gridLat).toBe(33);
    expect(model?.gridLon).toBe(-117.5);
    expect(model?.hours).toHaveLength(288);
    expect(model?.hours[0]).toMatchObject({ t: Date.parse("2026-11-06T00:00:00Z") });
  });

  it("returns null for a land-masked cell (all heights null)", () => {
    expect(
      parseModelResponse({
        latitude: 33,
        longitude: -117,
        hourly: { time: ["2026-11-11T00:00"], wave_height: [null], wave_peak_period: [null], wave_direction: [null] },
      }),
    ).toBeNull();
    expect(parseModelResponse(null)).toBeNull();
  });
});

describe("fetchModelAtBuoy", () => {
  it("asks for past and forecast days with peak period and a 3-hour cache", async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 }));
    const model = await fetchModelAtBuoy(32.933, -117.391, fetchImpl as unknown as typeof fetch);
    expect(model?.hours.length).toBe(288);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { next: { revalidate: number } }];
    expect(url).toBe(buildModelUrl(32.933, -117.391));
    expect(url).toContain("models=ecmwf_wam025");
    expect(url).toContain("past_days=5");
    expect(url).toContain("wave_peak_period");
    expect(init.next.revalidate).toBe(10_800);
  });

  it("returns null on HTTP failure", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchImpl = jest.fn(async () => new Response("rate limited", { status: 429 }));
    await expect(fetchModelAtBuoy(1, 2, fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });
});

describe("comparison", () => {
  const model = {
    gridLat: 0,
    gridLon: 0,
    hours: Array.from({ length: 48 }, (_, index) => ({ t: index * 3_600_000, hs: 1, tp: 12, dir: 270 })),
  };

  it("needs 24 matched hours", () => {
    expect(compareModelToObserved(model, [{ t: 0, hs: 1 }])).toBeNull();
  });

  it("reports the model running low, high or tracking", () => {
    const observed = (hs: number) => Array.from({ length: 48 }, (_, index) => ({ t: index * 3_600_000, hs }));
    expect(describeComparison(compareModelToObserved(model, observed(1.25)))).toBe(
      "Over the last 2 days, the model ran 20% low against the buoy.",
    );
    expect(describeComparison(compareModelToObserved(model, observed(0.8)))).toBe(
      "Over the last 2 days, the model ran 25% high against the buoy.",
    );
    expect(describeComparison(compareModelToObserved(model, observed(1.05)))).toBe(
      "Over the last 2 days, the model tracked the buoy within 10%.",
    );
  });

  it("finds the daily model peak after the newest reading, in station time", () => {
    const parsed = parseModelResponse(FIXTURE);
    if (!parsed) throw new Error("fixture did not parse");
    const peaks = modelDailyPeaks(parsed, Date.parse("2026-11-11T03:26:00Z"), "America/Los_Angeles");
    expect(peaks[0].day).toBe("2026-11-10");
    expect(peaks.length).toBe(8);
    expect(peaks.every((peak) => peak.hs > 0)).toBe(true);
  });
});
