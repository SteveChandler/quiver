import {
  buildForecastBenchmarkQueries,
  classifyForecastBenchmarkRegion,
  extractForecastAnswerContractFacts,
  type ForecastBenchmarkSpot,
} from "@/lib/seo/forecast-authority-benchmark";

const spot = (overrides: Partial<ForecastBenchmarkSpot> = {}): ForecastBenchmarkSpot => ({
  id: "spot-1",
  name: "Oceanside Harbor",
  city: "Oceanside",
  state: "CA",
  country: "USA",
  canonicalPath: "/ca/oceanside/oceanside-harbor",
  ...overrides,
});

describe("forecast authority benchmark", () => {
  it("samples California, Hawaii, East Coast, Gulf, and international inventory", () => {
    const spots = [
      spot(),
      spot({ id: "hi", state: "HI", country: "USA" }),
      spot({ id: "east", state: "NC", country: "USA" }),
      spot({ id: "gulf", state: "TX", country: "USA" }),
      spot({ id: "intl", state: "Jalisco", country: "Mexico" }),
    ];

    expect(spots.map(classifyForecastBenchmarkRegion)).toEqual([
      "California",
      "Hawaii",
      "East Coast",
      "Gulf Coast",
      "International",
    ]);
    expect(buildForecastBenchmarkQueries(spots, 1)).toHaveLength(50);
  });

  it("extracts the server-rendered answer contract from raw HTML", () => {
    const facts = extractForecastAnswerContractFacts(`
      <section data-testid="public-forecast-answer">
        <h2>Today's surf forecast</h2>
        <dt>Surf</dt><span>3-4 ft</span>
        <p>Best window: 6:00–9:00 AM</p>
        <p>Why: morning winds stay light.</p>
        <p>Forecast valid at 2026-08-08T12:00Z</p>
        <p>Source data updated 2026-08-08T10:00Z</p>
        <p>Quiver computed 2026-08-08T10:05Z</p>
        <p>Contributing sources: NOAA</p>
        <p>Score 8/10 · Confidence high</p>
      </section>
    `);

    expect(facts).toEqual({
      answerLayer: true,
      forecastDate: true,
      surfFacts: true,
      bestWindow: true,
      reasoning: true,
      freshness: true,
      provenance: true,
      score: 1,
    });
  });
});
