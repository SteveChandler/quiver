import { getForecastRegion } from "@/lib/data/forecast-regions";

describe("forecast region titles", () => {
  it("uses surf report in the Santa Cruz SEO title", () => {
    expect(getForecastRegion("santa-cruz")?.title).toBe(
      "Santa Cruz Surf Report & 7-Day Forecast"
    );
  });
});
