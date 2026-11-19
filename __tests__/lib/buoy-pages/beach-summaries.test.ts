/**
 * @jest-environment node
 */

import { getBeachForecastSummaries } from "@/lib/buoy-pages/beach-summaries";
import { mapPins } from "@/lib/buoy-pages/hub-data";
import { getStaticMapImageUrlWithPins } from "@/lib/map-utils";

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => {
    throw new Error("tests pass a client");
  }),
}));

const NOW = new Date("2026-11-11T18:10:00Z");

function fakeClient(tables: Record<string, { data: unknown; error: { message: string } | null }>) {
  return {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const op of ["select", "in", "gte", "lt", "order"]) builder[op] = () => builder;
      builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(tables[table]).then(resolve);
      return builder;
    },
  } as never;
}

const BEACHES = [
  { id: "b1", slug: "blacks", city: "La Jolla", state: "CA", country: "USA" },
  { id: "b2", slug: "no-forecast", city: "Del Mar", state: "CA", country: "USA" },
  { id: "b3", slug: "no-city", city: null, state: "CA", country: "USA" },
];

describe("getBeachForecastSummaries", () => {
  it("labels each beach with its current forecast row and its canonical URL", async () => {
    const client = fakeClient({
      beaches: { data: BEACHES, error: null },
      enhanced_forecasts: {
        data: [
          { beach_id: "b1", forecast_at: "2026-11-11T18:00:00Z", wave_height: "3-4 ft", data_source: "NOAA_WAVEWATCH" },
          { beach_id: "b1", forecast_at: "2026-11-12T18:00:00Z", wave_height: "6-8 ft", data_source: "NOAA_WAVEWATCH" },
        ],
        error: null,
      },
    });
    const summaries = await getBeachForecastSummaries(["b1", "b2", "b3"], NOW, client);
    expect(summaries.get("b1")).toEqual({ href: "/ca/la-jolla/blacks", city: "La Jolla", forecastLabel: "3-4ft" });
    expect(summaries.get("b2")).toEqual({ href: "/ca/del-mar/no-forecast", city: "Del Mar", forecastLabel: null });
    expect(summaries.get("b3")?.href).toBeNull();
  });

  describe("the row nearest the start of the current UTC hour", () => {
    const slots = [
      { beach_id: "b1", forecast_at: "2026-11-19T12:00:00Z", wave_height: "2-3 ft", data_source: "NOAA_WAVEWATCH" },
      { beach_id: "b1", forecast_at: "2026-11-19T15:00:00Z", wave_height: "5-6 ft", data_source: "NOAA_WAVEWATCH" },
    ];
    const labelAt = async (now: string, rows: object[]) => {
      const client = fakeClient({
        beaches: { data: [BEACHES[0]], error: null },
        enhanced_forecasts: { data: rows, error: null },
      });
      return (await getBeachForecastSummaries(["b1"], new Date(now), client)).get("b1")?.forecastLabel ?? null;
    };

    it.each([
      ["2026-11-19T14:30:00Z", "5-6ft"],
      ["2026-11-19T13:30:00Z", "2-3ft"],
      ["2026-11-19T15:00:00Z", "5-6ft"],
    ])("at %s labels the beach %s", async (now, label) => {
      expect(await labelAt(now, slots)).toBe(label);
    });

    it("has no label when no row lies within one slot of the hour", async () => {
      expect(await labelAt("2026-11-19T19:30:00Z", [slots[0]])).toBeNull();
    });

    it("does not label from a FALLBACK nearest row, nor from an older row", async () => {
      expect(await labelAt("2026-11-19T14:30:00Z", [
        slots[0], { ...slots[1], wave_height: null, data_source: "FALLBACK" },
      ])).toBeNull();
    });
  });

  it("throws when the forecast read fails, so the page can say it is unavailable", async () => {
    const client = fakeClient({
      beaches: { data: BEACHES, error: null },
      enhanced_forecasts: { data: null, error: { message: "statement timeout" } },
    });
    await expect(getBeachForecastSummaries(["b1"], NOW, client)).rejects.toThrow(/statement timeout/);
  });

  it("does not query for an empty list", async () => {
    await expect(getBeachForecastSummaries([], NOW, fakeClient({}))).resolves.toEqual(new Map());
  });
});

describe("hub static map", () => {
  it("keeps 250 pins under the Mapbox static URL limit", () => {
    const previous = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = `pk.${"x".repeat(90)}`;
    const stations = Array.from({ length: 400 }, (_, index) => ({ lat: -60 + index * 0.31, lon: -179.9 + index * 0.87 }));
    const pins = mapPins(stations);
    expect(pins).toHaveLength(250);
    const url = getStaticMapImageUrlWithPins(pins.map((pin) => ({ ...pin, color: "0077B6" })), { width: 720, height: 360, padding: 40 });
    expect(url?.length).toBeLessThan(8192);
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = previous;
  });
});
